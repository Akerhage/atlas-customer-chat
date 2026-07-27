import { useState, useRef, useEffect, useCallback } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { WelcomeMessage } from "./WelcomeMessage";
import { EndSessionDialog } from "./EndSessionDialog";
import { ContextIndicator } from "./ContextIndicator";
import { HumanModeIndicator } from "./HumanModeIndicator";
import {
sendMessage,
getStandardSelfserviceMenu,
answerStandardSelfservice,
resetSession,
getHistory,
connectSocket,
disconnectSocket,
getSessionId,
emitEndChat,
getPublicOffices,
getPublicConfig,
getTenantConfig,
type ChatContext,
type HistoryMessage,
type CustomerReplyEvent,
type SessionStatusEvent,
type SessionWarningEvent,
type ActiveVehicle,
} from "@/lib/atlas-client";
import type { TenantProfile } from "@/lib/tenant-capabilities";
import {
buildCategoryChoices,
buildIntakeOrder,
filterCategoryChoicesForOffice,
isCategoryFirstIntake,
resolveIntakeMode,
resolveOptionalPhone,
resolveWidgetTexts,
type IntakeMode,
type WidgetTexts,
} from "@/lib/intake-machine";
import {
STANDARD_CATEGORY_PREFIX,
STANDARD_CENTRAL_SUPPORT,
STANDARD_CENTRAL_SUPPORT_LABEL,
STANDARD_EMPTY_MESSAGE,
STANDARD_ESCALATE_VALUE,
STANDARD_MENU_PREFIX,
STANDARD_UNIT_PREFIX,
categoryChoiceValue,
isStandardSelfserviceEnabled,
shouldShowStandardSelfserviceMenu,
unitChoiceValue,
valueAfterPrefix,
withEscalationChoice,
withEscalationValue,
type StandardSelfserviceMenuItem,
type StandardSelfserviceStage,
} from "@/lib/standard-selfservice-machine";
import { formatCityAreaLabel } from "@/lib/place-format";
import { toast } from "sonner";

declare global {
interface Window {
selectedCity: string | null;
selectedVehicle: ActiveVehicle | null;
}
}

interface ChatMessage {
id: string;
role: 'user' | 'assistant';
content: string;
timestamp: Date;
senderName?: string | null; // Agentens namn för mänskliga svar (null = Atlas AI)
choices?: { label: string; value: string; icon?: string; fullWidth?: boolean }[];
}

type IntakeStep = 'name' | 'email' | 'phone' | 'office' | 'vehicle' | 'category' | null;
type VehicleType = ActiveVehicle;
type QuickContextPayload = { vehicle: string | null; city: string; vehicle_choice?: string | null; clear_vehicle?: boolean };

interface Office {
id: number;
name: string;
display_name?: string;
city: string;
area: string | null;
routing_tag: string;
categories_offered?: string[];
}

// Convert history role to our internal role
function mapHistoryRole(role: HistoryMessage['role']): 'user' | 'assistant' {
return role === 'user' ? 'user' : 'assistant';
}

function splitCityArea(label: string): Pick<ChatContext, 'city' | 'area'> {
const normalized = label.trim();
const enDashParts = normalized.split(' – ');
if (enDashParts.length === 2) {
return { city: enDashParts[0].trim(), area: enDashParts[1].trim() };
}

const hyphenParts = normalized.split(' - ');
if (hyphenParts.length === 2) {
return { city: hyphenParts[0].trim(), area: hyphenParts[1].trim() };
}

return { city: normalized, area: null };
}

function getOfficeDisplayName(office: Partial<Office>): string {
const city = String(office.city || '').trim();
const area = String(office.area || '').trim();
return String(office.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office.name || office.routing_tag || '').trim();
}

function normalizeOfficeLabel(value: string | null | undefined): string {
return String(value || '').trim().replace(/[\u2013\u2014]/g, '-').replace(/\s*-\s*/g, ' - ').toLowerCase();
}

function findOfficesByLabel(offices: Office[], value: string | null | undefined): Office[] {
const normalized = normalizeOfficeLabel(value);
if (!normalized) return [];
return offices.filter((office) => {
const city = String(office.city || '').trim();
const area = String(office.area || '').trim();
const cityArea = area ? `${city} - ${area}` : city;
return [
office.routing_tag,
office.name,
office.display_name,
cityArea,
city
].some((candidate) => normalizeOfficeLabel(candidate) === normalized);
});
}

function findSafeOfficeFromLiveContext(
offices: Office[],
selectedCity: string | null,
context: ChatContext
): Office | undefined {
const selectedMatches = findOfficesByLabel(offices, selectedCity);
if (selectedMatches.length === 1) return selectedMatches[0];

const contextCity = String(context.city || '').trim();
const contextArea = String(context.area || '').trim();
if (contextCity && contextArea) {
const exactMatches = offices.filter((office) =>
normalizeOfficeLabel(office.city) === normalizeOfficeLabel(contextCity) &&
normalizeOfficeLabel(office.area) === normalizeOfficeLabel(contextArea)
);
if (exactMatches.length === 1) return exactMatches[0];
}

const contextMatches = findOfficesByLabel(
offices,
formatCityAreaLabel(contextCity || null, contextArea || null)
);
return contextMatches.length === 1 ? contextMatches[0] : undefined;
}

function getContextFromOfficeSelection(offices: Office[], value: string | null | undefined): Pick<ChatContext, 'city' | 'area'> {
// Anta ett konkret kontor (inkl. dess area) BARA när etiketten matchar exakt ETT kontor.
// En ren stad-etikett (t.ex. "Stockholm") matchar många kontor — välj aldrig tyst det
// första kontorets area, då poisonas locked_context.area och eskalerings-misroutingen
// (stad-only → första kontoret) återintroduceras via en annan väg.
const matches = findOfficesByLabel(offices, value);
if (matches.length === 1) return { city: matches[0].city || null, area: matches[0].area || null };
return value ? splitCityArea(value) : { city: null, area: null };
}

const VEHICLE_CHOICES: { label: string; value: VehicleType }[] = [
{ label: 'Bil (B)',        value: 'BIL'     },
{ label: 'Motorcykel (A)', value: 'MC'      },
{ label: 'Moped (AM)',     value: 'AM'      },
{ label: 'Lastbil / Buss', value: 'LASTBIL' },
{ label: 'Släp (BE/B96)',  value: 'SLÄP'    },
];

const VEHICLE_HANDOFF_LABELS: Record<VehicleType, string> = {
BIL: 'Bil',
MC: 'MC',
AM: 'Moped',
LASTBIL: 'Lastbil / Buss',
SLÄP: 'Släp',
};

function getSafeVehicle(value: string | null | undefined): VehicleType | null {
return VEHICLE_CHOICES.some((choice) => choice.value === value) ? value as VehicleType : null;
}

const CROSS_TAB_SYNC_CHANNEL = 'atlas_customer_chat_sync';
const CROSS_TAB_SYNC_STORAGE_KEY = 'atlas_customer_chat_sync_event';
const CROSS_TAB_CUSTOMER_MESSAGE = 'customer-message-sent';

interface CrossTabSyncEvent {
id: string;
type: typeof CROSS_TAB_CUSTOMER_MESSAGE;
sessionId: string;
sourceId: string;
createdAt: number;
}

function createCrossTabId(): string {
return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const OFFICE_HOURS_NOTICE_ID = 'office-hours-notice';
const OFFICE_HOURS_REMINDER_PREFIX = 'office-hours-reminder_';
const WIDGET_TEXTS_PROFILE_CACHE_KEY = 'atlas-widget-texts-profile-v1';
const WIDGET_TEXTS_COMPANY_NAME_CACHE_KEY = 'atlas-widget-texts-company-name-v1';

const createWelcomeMessage = (aiRepliesEnabled: boolean, texts = resolveWidgetTexts(undefined)): ChatMessage => ({
id: 'welcome-msg',
role: 'assistant',
content: aiRepliesEnabled ? texts.welcomeAiOn : texts.welcomeAiOff,
timestamp: new Date(),
});

function readCachedTenantProfile(): TenantProfile | null | undefined {
if (typeof window === 'undefined') return undefined;
try {
const raw = window.localStorage.getItem(WIDGET_TEXTS_PROFILE_CACHE_KEY);
if (!raw) return undefined;
const parsed = JSON.parse(raw);
return parsed && typeof parsed === 'object' ? parsed as TenantProfile : undefined;
} catch {
return undefined;
}
}

function readCachedCompanyName(): string | null | undefined {
if (typeof window === 'undefined') return undefined;
try {
const raw = window.localStorage.getItem(WIDGET_TEXTS_COMPANY_NAME_CACHE_KEY);
return typeof raw === 'string' ? raw : undefined;
} catch {
return undefined;
}
}

function readCachedWidgetTexts(): WidgetTexts {
return resolveWidgetTexts(readCachedTenantProfile(), readCachedCompanyName());
}

function cacheWidgetTextInputs(profile: TenantProfile, companyNameRaw: string | null): void {
if (typeof window === 'undefined') return;
try {
window.localStorage.setItem(WIDGET_TEXTS_PROFILE_CACHE_KEY, JSON.stringify(profile));
if (companyNameRaw) {
window.localStorage.setItem(WIDGET_TEXTS_COMPANY_NAME_CACHE_KEY, companyNameRaw);
} else {
window.localStorage.removeItem(WIDGET_TEXTS_COMPANY_NAME_CACHE_KEY);
}
} catch {
// Cache is only a pre-paint optimization; failing it must not affect chat flow.
}
}

export function AtlasChat() {
const initialWidgetTextsRef = useRef<WidgetTexts | null>(null);
if (!initialWidgetTextsRef.current) initialWidgetTextsRef.current = readCachedWidgetTexts();
const initialWidgetTexts = initialWidgetTextsRef.current;
const [messages, setMessages] = useState<ChatMessage[]>([
createWelcomeMessage(true, initialWidgetTexts)
]);
const [offices, setOffices] = useState<Office[]>([]); // 🔥 Håller kontorslistan
const [officesLoaded, setOfficesLoaded] = useState(false);
const [aiRepliesEnabled, setAiRepliesEnabled] = useState(true);
const [publicConfigLoaded, setPublicConfigLoaded] = useState(false);
// 🕒 Chattöppettider (Standard): servern skickar färdig bemanningsstatus.
// Default = bemannad, så trafik-/legacyboxar aldrig får någon notis.
const [chatStaffed, setChatStaffed] = useState(true);
const [chatReopensLabel, setChatReopensLabel] = useState<string | null>(null);
const [contactFormOpen, setContactFormOpen] = useState(false);
const [initialHistoryLoaded, setInitialHistoryLoaded] = useState(false);
const [isTyping, setIsTyping] = useState(false);
const [isDark, setIsDark] = useState(true);
const [showEndDialog, setShowEndDialog] = useState(false);
const [humanMode, setHumanMode] = useState(false);
const [agentNames, setAgentNames] = useState<string[]>([]); // Alla agenter som svarat
const [typingAgentName, setTypingAgentName] = useState<string | null>(null); // Vem skriver just nu
const [assignedAgentName, setAssignedAgentName] = useState<string | null>(null); // Tilldelad handläggare innan första svar
const [isArchived, setIsArchived] = useState(false);
const [closeReason, setCloseReason] = useState<string | null>(null);
const [intakeStep, setIntakeStep] = useState<IntakeStep>(null);
const [intakeData, setIntakeData] = useState<{
name?: string;
email?: string;
phone?: string;
city?: string;
vehicle?: VehicleType | null;
}>({});
const [archivedMessage, setArchivedMessage] = useState<string | null>(null);
const [inactivityWarning, setInactivityWarning] = useState(false);
const [inactivityCountdown, setInactivityCountdown] = useState(300); // 5 min i sekunder
const inactivityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const [context, setContext] = useState<ChatContext>({
city: null,
area: null,
vehicle: null,
});
// Separate state for selection UI (before first message is sent)
const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
const [selectedCity, setSelectedCity] = useState<string | null>(null);
const [generalMode, setGeneralMode] = useState(false);
const [companyName, setCompanyName] = useState<string | null>(null);
const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
const [activeVehicles, setActiveVehicles] = useState<VehicleType[]>(['BIL', 'MC', 'AM', 'LASTBIL', 'SLÄP']);
const [quickQuestions, setQuickQuestions] = useState<string[]>([]);
const [intakeMode, setIntakeMode] = useState<IntakeMode>('legacy');
const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null);
const [tenantConfigLoaded, setTenantConfigLoaded] = useState(false);
const [categoryChoices, setCategoryChoices] = useState<{ label: string; value: string }[]>([]);
const [widgetTexts, setWidgetTexts] = useState<WidgetTexts>(() => initialWidgetTexts);
const [selfserviceStage, setSelfserviceStage] = useState<StandardSelfserviceStage>(null);
const [selfserviceUnitId, setSelfserviceUnitId] = useState<string | null>(null);
const [selfserviceUnitLabel, setSelfserviceUnitLabel] = useState<string | null>(null);
const [selfserviceMenu, setSelfserviceMenu] = useState<StandardSelfserviceMenuItem[]>([]);
const standardSelfserviceStartedRef = useRef(false);
const selfserviceUnitMessageIdRef = useRef<string | null>(null);
const selfserviceCategoryMessageIdRef = useRef<string | null>(null);
const humanModeRef = useRef(humanMode);
const intakeStepRef = useRef(intakeStep);
humanModeRef.current = humanMode;
intakeStepRef.current = intakeStep;

const activeVehicleChoices = VEHICLE_CHOICES.filter(choice => activeVehicles.includes(choice.value));
const getSafeActiveVehicle = (value: string | null | undefined): VehicleType | null => {
const vehicle = getSafeVehicle(value);
return vehicle && activeVehicles.includes(vehicle) ? vehicle : null;
};
const singletonOffice = offices.length === 1 ? offices[0] : null;
const singletonOfficeLabel = singletonOffice ? getOfficeDisplayName(singletonOffice) : null;
const singletonVehicle = activeVehicles.length === 1 ? activeVehicles[0] : null;
const categoryFirstEnabled = isCategoryFirstIntake(intakeMode, categoryChoices.length);
const standardSelfserviceEnabled = isStandardSelfserviceEnabled(tenantProfile, intakeMode);
const selfserviceCategoryLabel = categoryChoices.find(choice => choice.value === selectedCategoryId)?.label || null;
const STANDARD_EMPTY_CATEGORY_MESSAGE =
'Den här avdelningen har inga kategorier ännu. Skapa ett ärende så hjälper vi dig vidare.';

// Hämta kontorslistan från API när chatten bootar
useEffect(() => {
getPublicOffices()
.then(data => setOffices(data))
.catch(err => console.error("Kunde inte ladda kontor:", err))
.finally(() => setOfficesLoaded(true));
}, []);

useEffect(() => {
getTenantConfig().then(config => {
setCompanyName(config.companyName);
setCompanyLogoUrl(config.companyLogoUrl);
setActiveVehicles(config.activeVehicles);
setQuickQuestions(config.quickQuestions);
setTenantProfile(config.tenantProfile);
setIntakeMode(resolveIntakeMode(config.tenantProfile));
setCategoryChoices(buildCategoryChoices(config.categories));
cacheWidgetTextInputs(config.tenantProfile, config.companyNameRaw);
setWidgetTexts(resolveWidgetTexts(config.tenantProfile, config.companyNameRaw));
}).finally(() => setTenantConfigLoaded(true));
}, []);

useEffect(() => {
setMessages((current) => current.map((message) => message.id === 'welcome-msg'
? { ...message, content: aiRepliesEnabled ? widgetTexts.welcomeAiOn : widgetTexts.welcomeAiOff }
: message));
}, [widgetTexts, aiRepliesEnabled]);

useEffect(() => {
if (selectedVehicle && !activeVehicles.includes(selectedVehicle)) {
setSelectedVehicle(null);
setContext(prev => ({ ...prev, vehicle: null }));
}
}, [activeVehicles, selectedVehicle]);

useEffect(() => {
if (!singletonVehicle) return;
if (generalMode) return;
if (selectedVehicle === singletonVehicle && context.vehicle === singletonVehicle) return;
setSelectedVehicle(singletonVehicle);
setContext(prev => ({ ...prev, vehicle: singletonVehicle }));
window.selectedVehicle = singletonVehicle;
}, [singletonVehicle, selectedVehicle, context.vehicle, generalMode]);

useEffect(() => {
if (!singletonOffice || !singletonOfficeLabel) return;
const nextCity = singletonOffice.city || null;
const nextArea = singletonOffice.area || null;
if (selectedCity === singletonOfficeLabel && context.city === nextCity && context.area === nextArea) return;
setSelectedCity(singletonOfficeLabel);
setContext(prev => ({ ...prev, city: nextCity, area: nextArea }));
window.selectedCity = singletonOfficeLabel;
}, [singletonOffice, singletonOfficeLabel, selectedCity, context.city, context.area]);

useEffect(() => {
let cancelled = false;

getPublicConfig()
.then((config) => {
if (cancelled) return;
setAiRepliesEnabled(config.ai_replies_enabled);
setChatStaffed(config.chat_staffed);
setChatReopensLabel(config.chat_reopens_label);
})
.catch((err) => {
if (cancelled) return;
console.error("Kunde inte ladda publik konfiguration:", err);
setAiRepliesEnabled(true);
setChatStaffed(true);
setChatReopensLabel(null);
})
.finally(() => {
if (!cancelled) setPublicConfigLoaded(true);
});

return () => {
cancelled = true;
};
}, []);

// 🔥 FIX: Synka isDark med HTML-elementet (Gör popup-rutor mörka)
useEffect(() => {
if (isDark) {
document.documentElement.classList.add('dark');
} else {
document.documentElement.classList.remove('dark');
}
}, [isDark]);

// Keep context in sync with selections so it can be sent even for manual input
const handleVehicleChange = (vehicle: VehicleType | null) => {
const safeVehicle = vehicle && activeVehicles.includes(vehicle) ? vehicle : null;
setGeneralMode(false);
setSelectedVehicle(safeVehicle);
setContext((prev) => ({ ...prev, vehicle: safeVehicle }));
};

const handleGeneralVehicleSelect = () => {
setGeneralMode(true);
setSelectedVehicle(null);
setContext((prev) => ({ ...prev, vehicle: null, vehicle_choice: 'OVRIGT', clear_vehicle: true }));
window.selectedVehicle = null;
};

const handleCityChange = (locationLabel: string | null) => {
setSelectedCity(locationLabel);
setContext((prev) => {
if (!locationLabel) return { ...prev, city: null, area: null };
const { city, area } = getContextFromOfficeSelection(offices, locationLabel);
return { ...prev, city, area };
});
};
const messagesEndRef = useRef<HTMLDivElement>(null);
const scrollContainerRef = useRef<HTMLDivElement>(null);
const lastMessageCountRef = useRef<number>(0);
const agentTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const tabIdRef = useRef<string>(createCrossTabId());
const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
const lastCrossTabEventIdRef = useRef<string | null>(null);

const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Injicerar ett bot-meddelande lokalt i chatten under intake-flödet.
// VIKTIGT: lastMessageCountRef inkrementeras INTE avsiktligt.
// Intake-meddelanden är efemära – när humanMode startar och
// polling aktiveras ersätts de automatiskt av serverns historik.
const injectBotMessage = (content: string, choices?: { label: string; value: string; fullWidth?: boolean }[]) => {
const id = generateMessageId();
setMessages((prev) => [
...prev,
{
id,
role: 'assistant' as const,
content,
timestamp: new Date(),
choices,
},
]);
return id;
};

// Injicerar ett användarmeddelande lokalt utan att skicka till backend.
// lastMessageCountRef inkrementeras inte av samma anledning som ovan.
const injectUserMessage = (content: string) => {
const id = generateMessageId();
setMessages((prev) => [
...prev,
{
id,
role: 'user' as const,
content,
timestamp: new Date(),
},
]);
return id;
};

// 🕒 Notis när chatten är obemannad. Informerar bara — inget flöde blockeras.
const buildOfficeHoursNotice = () => {
const reopens = chatReopensLabel ? ` — chatten är bemannad igen ${chatReopensLabel}` : '';
return `👋 Just nu är personalen inte på plats${reopens}. Vill du inte vänta? [Skicka ett ärende via mailformuläret](#atlas-contact) så tar vi det så snart vi är tillbaka. Snabbfrågorna och AI-assistenten hjälper dig gärna under tiden.`;
};

// Lägger notisen DIREKT efter välkomstbubblan oavsett vad intake-/selfservice-
// flödet hunnit injicera, och bara en gång per meddelandelista.
const insertOfficeHoursNotice = (content: string) => {
setMessages((prev) => {
if (prev.some((message) => message.id === OFFICE_HOURS_NOTICE_ID)) return prev;
const notice = {
id: OFFICE_HOURS_NOTICE_ID,
role: 'assistant' as const,
content,
timestamp: new Date(),
};
const welcomeIndex = prev.findIndex((message) => message.id === 'welcome-msg');
if (welcomeIndex === -1) return [...prev, notice];
return [...prev.slice(0, welcomeIndex + 1), notice, ...prev.slice(welcomeIndex + 1)];
});
};

// Kortare påminnelse vid eskalering — full notis här skulle upprepa hela texten.
const buildOfficeHoursReminder = () => {
const reopens = chatReopensLabel ? ` och besvaras ${chatReopensLabel}` : '';
return `👋 Kom ihåg att personalen inte är på plats just nu — ditt ärende hamnar i kön${reopens}.`;
};

// Påminnelsen ska finnas när kunden eskalerar långt in i en session, men inte
// upprepas när öppningsnotisen (eller en färsk påminnelse) redan står där —
// kunden trycker headset direkt, eller flera gånger i rad. Regeln: visa bara igen
// om kunden hunnit säga något sedan förra öppettidsmeddelandet. Blockerar aldrig
// eskaleringen.
const injectOfficeHoursReminder = () => {
setMessages((prev) => {
let lastOfficeHours = -1;
for (let i = prev.length - 1; i >= 0; i -= 1) {
const id = prev[i].id;
if (id === OFFICE_HOURS_NOTICE_ID || id.startsWith(OFFICE_HOURS_REMINDER_PREFIX)) { lastOfficeHours = i; break; }
}
if (lastOfficeHours !== -1 && !prev.slice(lastOfficeHours + 1).some((m) => m.role === 'user')) return prev;
return [
...prev,
{
id: `${OFFICE_HOURS_REMINDER_PREFIX}${generateMessageId()}`,
role: 'assistant' as const,
content: buildOfficeHoursReminder(),
timestamp: new Date(),
},
];
});
};

const getOfficeChoices = (): { label: string; value: string }[] => [
{ label: 'Centralsupport', value: 'Centralsupport' },
...offices.map((office) => {
const name = getOfficeDisplayName(office);
return { label: name, value: name };
}),
];

// K7/C: de riktiga enheterna först, utvägen SIST och i helbredd. fullWidth är
// bundlens egen markör för ett chip som inte är ett likvärdigt alternativ i
// raden (samma grepp som "Jag behöver mer hjälp – skapa ärende",
// standard-selfservice-machine.ts:withEscalationValue) — ingen ny komponent.
const getStandardUnitChoices = (): { label: string; value: string; fullWidth?: boolean }[] => [
...offices.map((office) => ({
label: getOfficeDisplayName(office),
value: unitChoiceValue(office.routing_tag),
})),
{ label: STANDARD_CENTRAL_SUPPORT_LABEL, value: unitChoiceValue(STANDARD_CENTRAL_SUPPORT), fullWidth: true },
];

const getCategoryChoicesForOffice = (office: Office | null | undefined) =>
filterCategoryChoicesForOffice(categoryChoices, office?.categories_offered);

const getCategoryChoicesForOfficeLabel = (value: string | null | undefined) => {
if (normalizeOfficeLabel(value) === normalizeOfficeLabel('Centralsupport')) return categoryChoices;
const office = findSafeOfficeFromLiveContext(offices, value, context) || undefined;
return getCategoryChoicesForOffice(office);
};

const getCategoryChoicesForIntake = () => {
const label = intakeData.city || selectedCity || context.city || null;
if (normalizeOfficeLabel(label) === normalizeOfficeLabel('Centralsupport')) return categoryChoices;
const office = findSafeOfficeFromLiveContext(offices, label, context) || singletonOffice || undefined;
return getCategoryChoicesForOffice(office);
};

const hasKnownOfficeForIntake = () => {
const label = selectedCity || context.city || null;
return normalizeOfficeLabel(label) === normalizeOfficeLabel('Centralsupport') ||
Boolean(findSafeOfficeFromLiveContext(offices, label, context) || singletonOffice);
};

const getStandardCategoryChoices = (unitId?: string | null): { label: string; value: string }[] => {
const office = unitId && unitId !== STANDARD_CENTRAL_SUPPORT
? offices.find(candidate => candidate.routing_tag === unitId)
: null;
return getCategoryChoicesForOffice(office).map(choice => ({
label: choice.label,
value: categoryChoiceValue(choice.value),
}));
};

const getStandardCategoryStep = (unitId?: string | null): { content: string; choices: { label: string; value: string }[] } => {
const choices = getStandardCategoryChoices(unitId);
return choices.length
? { content: 'Välj kategori.', choices }
: { content: STANDARD_EMPTY_CATEGORY_MESSAGE, choices: withEscalationValue([]) };
};

const showStandardMenu = (
items: StandardSelfserviceMenuItem[],
  message = 'Välj en snabbfråga eller skapa ett ärende så hjälper vi dig. Du hittar också frågorna i menyn nere vid skrivfältet.'
) => {
setSelfserviceMenu(items);
setSelfserviceStage('menu');
injectBotMessage(
items.length ? message : STANDARD_EMPTY_MESSAGE,
withEscalationChoice(items)
);
};

const showCompactStandardMenuFollowup = (message: string) => {
setSelfserviceStage('menu');
injectBotMessage(message, withEscalationChoice([]));
};

const loadAndShowStandardMenu = async (unitId: string, categoryId: string) => {
if (unitId === STANDARD_CENTRAL_SUPPORT) {
showStandardMenu([]);
return;
}
setIsTyping(true);
try {
const response = await getStandardSelfserviceMenu(unitId, categoryId);
showStandardMenu(response.items);
} catch (error) {
console.error('[AtlasChat] Selfservice menu error:', error);
showStandardMenu([]);
} finally {
setIsTyping(false);
}
};

const beginStandardSelfservice = () => {
standardSelfserviceStartedRef.current = true;
selfserviceUnitMessageIdRef.current = null;
selfserviceCategoryMessageIdRef.current = null;
setIntakeStep(null);
setIntakeData({});
setSelectedCategoryId(null);
setSelfserviceUnitId(null);
setSelfserviceUnitLabel(null);
setSelfserviceMenu([]);
setSelfserviceStage('unit');
injectBotMessage('Välj den avdelning du vill ha hjälp av.', getStandardUnitChoices());
};

const startStandardEscalation = () => {
const city = selfserviceUnitId === STANDARD_CENTRAL_SUPPORT
? 'Centralsupport'
: selfserviceUnitLabel;
if (!city) return;
setSelfserviceStage(null);
setIntakeData({ city, vehicle: null });
setIntakeStep('name');
setGeneralMode(true);
setSelectedVehicle(null);
injectBotMessage('För att skapa ett ärende behöver vi några uppgifter. Vad heter du?');
};

const handleStandardChoice = async (value: string): Promise<boolean> => {
const requestedUnitId = valueAfterPrefix(value, STANDARD_UNIT_PREFIX);
const requestedCategoryId = valueAfterPrefix(value, STANDARD_CATEGORY_PREFIX);
if (!standardSelfserviceEnabled || humanMode) return false;
if (intakeStep && !requestedUnitId && !requestedCategoryId) return false;
if (value === STANDARD_ESCALATE_VALUE) {
startStandardEscalation();
return true;
}

const applyStandardUnitSelection = (unitId: string) => {
const office = unitId === STANDARD_CENTRAL_SUPPORT
? null
: offices.find(candidate => candidate.routing_tag === unitId);
if (unitId !== STANDARD_CENTRAL_SUPPORT && !office) return null;
const label = office ? getOfficeDisplayName(office) : 'Centralsupport';
setSelfserviceUnitId(unitId);
setSelfserviceUnitLabel(label);
setSelectedCity(label);
window.selectedCity = label;
setContext(prev => ({
...prev,
city: office?.city || null,
area: office?.area || null,
unit_id: office?.routing_tag || null,
vehicle: null,
vehicle_choice: 'OVRIGT',
clear_vehicle: true,
category_id: null,
}));
return { label };
};

if (requestedUnitId && selfserviceStage === 'category' && !selectedCategoryId && !intakeStep) {
const selection = applyStandardUnitSelection(requestedUnitId);
if (!selection) return true;
const categoryStep = getStandardCategoryStep(requestedUnitId);
setMessages((current) => current.map((message) => {
if (message.id === selfserviceUnitMessageIdRef.current) {
return { ...message, content: selection.label };
}
if (message.id === selfserviceCategoryMessageIdRef.current) {
return { ...message, content: categoryStep.content, choices: categoryStep.choices };
}
return message;
}));
return true;
}

if (requestedUnitId && selfserviceStage !== 'unit') {
const selection = applyStandardUnitSelection(requestedUnitId);
if (!selection) return true;
setIntakeStep(null);
setIntakeData({});
setGeneralMode(false);
setSelectedCategoryId(null);
setSelectedVehicle(null);
window.selectedVehicle = null;
setSelfserviceMenu([]);
setSelfserviceStage('category');
const unitMessageId = injectUserMessage(selection.label);
const categoryStep = getStandardCategoryStep(requestedUnitId);
const categoryMessageId = injectBotMessage(categoryStep.content, categoryStep.choices);
selfserviceUnitMessageIdRef.current = unitMessageId;
selfserviceCategoryMessageIdRef.current = categoryMessageId;
return true;
}

const isMidIntakeCategoryReselection = Boolean(intakeStep && selectedCategoryId);
if (
requestedCategoryId &&
selfserviceUnitId &&
((selfserviceStage === 'menu' && !intakeStep) || isMidIntakeCategoryReselection)
) {
if (requestedCategoryId === selectedCategoryId) return true;
const category = getStandardCategoryChoices(selfserviceUnitId)
.find(choice => choice.value === value);
if (!category) return true;
setSelfserviceMenu([]);
if (intakeStep) {
setIntakeStep(null);
setIntakeData({});
setGeneralMode(false);
}
setSelectedCategoryId(requestedCategoryId);
setContext(prev => ({ ...prev, category_id: requestedCategoryId }));
injectUserMessage(category.label);
await loadAndShowStandardMenu(selfserviceUnitId, requestedCategoryId);
return true;
}

if (selfserviceStage === 'unit') {
if (!requestedUnitId) return false;
const selection = applyStandardUnitSelection(requestedUnitId);
if (!selection) return true;
selfserviceUnitMessageIdRef.current = injectUserMessage(selection.label);
setSelfserviceStage('category');
const categoryStep = getStandardCategoryStep(requestedUnitId);
selfserviceCategoryMessageIdRef.current = injectBotMessage(categoryStep.content, categoryStep.choices);
return true;
}

if (selfserviceStage === 'category') {
const categoryId = valueAfterPrefix(value, STANDARD_CATEGORY_PREFIX);
if (!categoryId || !selfserviceUnitId) return false;
const category = categoryChoices.find(choice => choice.value === categoryId);
if (!category) return true;
injectUserMessage(category.label);
setSelectedCategoryId(categoryId);
setContext(prev => ({ ...prev, category_id: categoryId }));
await loadAndShowStandardMenu(selfserviceUnitId, categoryId);
return true;
}

if (selfserviceStage === 'menu') {
const itemId = valueAfterPrefix(value, STANDARD_MENU_PREFIX);
if (!itemId) return false;
const item = selfserviceMenu.find(candidate => candidate.id === itemId);
if (!item) {
showStandardMenu(selfserviceMenu);
return true;
}
injectUserMessage(item.label);
setIsTyping(true);
try {
const response = await answerStandardSelfservice(item.action, {
canRecoverSession: () => !humanModeRef.current && !intakeStepRef.current,
});
injectBotMessage(response.presentation || response.answer || STANDARD_EMPTY_MESSAGE);
} catch (error) {
console.error('[AtlasChat] Selfservice answer error:', error);
showCompactStandardMenuFollowup('Svaret kunde inte hämtas just nu. Försök igen via menyn nere vid skrivfältet eller skapa ett ärende.');
} finally {
setIsTyping(false);
}
return true;
}

return false;
};

const startIntake = (legacyMessage: string, categoryMessage = 'Vad gäller ärendet?') => {
const firstStep = buildIntakeOrder(intakeMode, categoryChoices.length, hasKnownOfficeForIntake())[0];
if (firstStep === 'category') {
const choices = getCategoryChoicesForIntake();
if (choices.length === 0) {
setIntakeStep('name');
injectBotMessage(legacyMessage);
return;
}
setIntakeStep('category');
injectBotMessage(categoryMessage, choices);
return;
}
if (firstStep === 'office') {
setIntakeStep('office');
injectBotMessage(widgetTexts.officeQuestion, getOfficeChoices());
return;
}
setIntakeStep('name');
injectBotMessage(legacyMessage);
};

const scrollToBottom = useCallback(() => {
messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, []);

useEffect(() => {
scrollToBottom();
}, [messages, isTyping, scrollToBottom]);

// Socket.io connection for real-time agent replies
const handleAgentReply = useCallback((event: CustomerReplyEvent) => {
const name = event.sender && event.sender !== 'agent' ? event.sender : null;

const agentMessage: ChatMessage = {
id: generateMessageId(),
role: 'assistant',
content: event.message,
timestamp: new Date(),
senderName: name,
};

setMessages((prev) => [...prev, agentMessage]);
lastMessageCountRef.current += 1;
if (agentTypingTimerRef.current) {
clearTimeout(agentTypingTimerRef.current);
agentTypingTimerRef.current = null;
}
setIsTyping(false);
setTypingAgentName(null);
}, []);

// Handle session status changes (archived, etc.)
// FIX: Tog bort messages.length som dependency — det skapade en ny callback-referens
// vid varje nytt meddelande, vilket triggar om useEffect nedan och orsakar en
// disconnect/reconnect-loop där lyssnarna aldrig hann registreras korrekt.
const handleSessionStatus = useCallback((event: SessionStatusEvent) => {
if (event.status === 'archived') {
setIsArchived(true);
setCloseReason(event.close_reason || null);
setArchivedMessage(event.message || (event.close_reason === 'inactivity' ? 'Chatten har stängts automatiskt på grund av inaktivitet.' : (event.close_reason === 'deleted' ? 'Chatten har avslutats.' : 'Chatten är avslutad av handläggaren.')));
if (agentTypingTimerRef.current) {
clearTimeout(agentTypingTimerRef.current);
agentTypingTimerRef.current = null;
}
setIsTyping(false);
setInactivityWarning(false);
if (inactivityTimerRef.current) { clearInterval(inactivityTimerRef.current); inactivityTimerRef.current = null; }
setShowEndDialog(true);
}
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// Handle agent typing indicator
const handleAgentTyping = useCallback((_sessionId: string, agentName: string | null, isTyping: boolean) => {
if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current);
if (!isTyping) {
setIsTyping(false);
setTypingAgentName(null);
agentTypingTimerRef.current = null;
return;
}
setIsTyping(true);
setTypingAgentName(agentName);
agentTypingTimerRef.current = setTimeout(() => {
setIsTyping(false);
setTypingAgentName(null);
agentTypingTimerRef.current = null;
}, 6000);
}, []);

useEffect(() => {
return () => {
if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current);
};
}, []);

// Handle ticket assignment — agent claimed (server emittar team:session_assigned)
const handleSessionAssigned = useCallback((agentName: string | null) => {
setAssignedAgentName(agentName || null);
setAgentNames(agentName ? [agentName] : []);
}, []);

// Handle inactivity warning - start a 5-minute countdown
const handleInactivityWarning = useCallback((event: SessionWarningEvent) => {
const seconds = (event.minutesLeft ?? 5) * 60;
setInactivityWarning(true);
setInactivityCountdown(seconds);

// Rensa eventuell tidigare timer
if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);

inactivityTimerRef.current = setInterval(() => {
setInactivityCountdown((prev) => {
if (prev <= 1) {
clearInterval(inactivityTimerRef.current!);
inactivityTimerRef.current = null;
return 0;
}
return prev - 1;
});
}, 1000);
}, []);

const handleIntakeInput = (input: string) => {
const trimmed = input.trim();

if (['avbryt', 'avbryta', 'cancel'].includes(trimmed.toLowerCase())) {
setIntakeData({});
if (standardSelfserviceEnabled && selfserviceUnitId && selectedCategoryId) {
setIntakeStep(null);
showCompactStandardMenuFollowup('Okej, ärendet avbröts. Fler snabbfrågor finns i menyn nere vid skrivfältet.');
return;
}
setSelectedCategoryId(null);
if (!aiRepliesEnabled) {
startIntake('Okej, vi börjar om. Vad heter du?', 'Okej, vi börjar om. Vad gäller ärendet?');
return;
}
setIntakeStep(null);
showCompactStandardMenuFollowup('Okej, ärendet avbröts. Du hittar alternativen i menyn nere vid skrivfältet.');
return;
}

injectUserMessage(trimmed);

switch (intakeStep) {
case 'name': {
if (trimmed.length < 2) {
injectBotMessage('Vänligen ange ditt namn (minst 2 tecken).');
return;
}
setIntakeData((prev) => ({ ...prev, name: trimmed }));
setIntakeStep('email');
injectBotMessage(`Tack ${trimmed}! Vad är din e-postadress?`);
break;
}
case 'email': {
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(trimmed)) {
injectBotMessage('Det verkar inte vara en giltig e-postadress. Försök igen.');
return;
}
setIntakeData((prev) => ({ ...prev, email: trimmed }));
setIntakeStep('phone');
injectBotMessage('Tack! Vill du lägga till ett mobilnummer? Skriv numret, **"nej"** eller **"hoppa över"**.');
break;
}
case 'phone': {
const phoneResult = resolveOptionalPhone(trimmed);
if (!phoneResult.valid) {
injectBotMessage('Ange ett giltigt mobilnummer (minst 8 siffror), **"nej"** eller **"hoppa över"**.');
return;
}
const safeOffice = findSafeOfficeFromLiveContext(
offices,
categoryFirstEnabled ? (intakeData.city || selectedCity) : selectedCity,
context,
) || singletonOffice || undefined;
const isCentralSupport = categoryFirstEnabled && intakeData.city === 'Centralsupport';
// "Övrigt / Allmän fråga" ska bäras hela vägen — aldrig falla tillbaka på singleton-fordon.
const isGeneral = generalMode || context.vehicle_choice === 'OVRIGT';
const safeVehicle = isGeneral || categoryFirstEnabled ? null : (getSafeActiveVehicle(selectedVehicle) || getSafeActiveVehicle(context.vehicle) || singletonVehicle);
const nextIntakeData = {
...intakeData,
phone: phoneResult.phone,
city: safeOffice ? getOfficeDisplayName(safeOffice) : intakeData.city,
vehicle: isGeneral ? null : (safeVehicle || intakeData.vehicle),
};
setIntakeData(nextIntakeData);

if (categoryFirstEnabled) {
if (!selectedCategoryId) {
const choices = getCategoryChoicesForIntake();
if (choices.length > 0) {
setIntakeStep('category');
injectBotMessage('Vad gäller ärendet?', choices);
return;
}
if (!safeOffice && !isCentralSupport) {
setIntakeStep('office');
injectBotMessage(widgetTexts.officeQuestion, getOfficeChoices());
return;
}
setIntakeStep(null);
finishIntakeHandoff({
...nextIntakeData,
city: isCentralSupport ? 'Centralsupport' : getOfficeDisplayName(safeOffice!),
vehicle: null,
general: true,
});
return;
}
if (!safeOffice && !isCentralSupport) {
setIntakeStep('office');
injectBotMessage(widgetTexts.officeQuestion, getOfficeChoices());
return;
}
setIntakeStep(null);
finishIntakeHandoff({
...nextIntakeData,
city: isCentralSupport ? 'Centralsupport' : getOfficeDisplayName(safeOffice!),
vehicle: null,
general: true,
categoryId: selectedCategoryId,
});
return;
}

if (safeOffice && (safeVehicle || isGeneral)) {
setIntakeStep(null);
finishIntakeHandoff({
...nextIntakeData,
city: getOfficeDisplayName(safeOffice),
vehicle: isGeneral ? null : safeVehicle,
general: isGeneral,
});
return;
}

if (safeOffice && !isGeneral) {
setIntakeStep('vehicle');
injectBotMessage('Vad gäller ärendet?', activeVehicleChoices);
return;
}

setIntakeStep('office');
injectBotMessage(widgetTexts.officeQuestion, getOfficeChoices());
break;
}
case 'office':
case 'vehicle':
case 'category': {
injectBotMessage('Klicka på ett av alternativen ovan för att välja 👆');
break;
}
default:
break;
}
};

// Polling for human mode - fetch history and sync messages
const pollHistory = useCallback(async () => {
try {
const history = await getHistory();

// Update human mode and archived state
setHumanMode(history.human_mode);

// Check if session is archived (persistent state from backend)
if (history.is_archived) {
setIsArchived(true);
setCloseReason(history.close_reason || null);
setArchivedMessage(history.close_reason === 'inactivity' ? 'Chatten har stängts automatiskt på grund av inaktivitet.' : (history.close_reason === 'deleted' ? 'Chatten har avslutats.' : 'Chatten är avslutad av handläggaren.'));
}

// Always sync messages from server - compare by content, not just count
const serverMsgCount = history.messages.length;

if (serverMsgCount > 0 && serverMsgCount !== lastMessageCountRef.current) {
setMessages((prevMessages) => {
// Behåll välkomstbubblan i toppen om den finns
const welcomeMsg = prevMessages.find(m => m.id === 'welcome-msg');

const newMessages: ChatMessage[] = history.messages.map((msg, index) => {
const existingMsg = prevMessages.find(
(prev) =>
prev.content === msg.content &&
prev.role === mapHistoryRole(msg.role)
);

return {
id: existingMsg?.id || `history_${index}_${Date.now()}`,
role: mapHistoryRole(msg.role),
content: msg.content,
timestamp: existingMsg?.timestamp || new Date(),
};
});

return welcomeMsg ? [welcomeMsg, ...newMessages] : newMessages;
});

lastMessageCountRef.current = serverMsgCount;
setIsTyping(false);
}
} catch (error) {
console.error('[AtlasChat] Polling error:', error);
// Don't show error toast for polling failures - silent retry
}
}, []);

// Connect socket on mount, disconnect on unmount
useEffect(() => {
connectSocket(handleAgentReply, handleSessionStatus, handleAgentTyping, handleInactivityWarning, handleSessionAssigned, pollHistory);

return () => {
if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
disconnectSocket();
};
}, [handleAgentReply, handleSessionStatus, handleAgentTyping, handleInactivityWarning, handleSessionAssigned, pollHistory]);

const handleCrossTabSync = useCallback((event: CrossTabSyncEvent | null) => {
if (!event || event.type !== CROSS_TAB_CUSTOMER_MESSAGE) return;
if (!event.id || event.id === lastCrossTabEventIdRef.current) return;
if (event.sourceId === tabIdRef.current) return;
if (event.sessionId !== getSessionId()) return;

lastCrossTabEventIdRef.current = event.id;
pollHistory();
}, [pollHistory]);

const notifySiblingTabs = useCallback(() => {
const event: CrossTabSyncEvent = {
id: `${tabIdRef.current}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
type: CROSS_TAB_CUSTOMER_MESSAGE,
sessionId: getSessionId(),
sourceId: tabIdRef.current,
createdAt: Date.now(),
};

try {
broadcastChannelRef.current?.postMessage(event);
} catch (error) {
console.warn('[AtlasChat] Cross-tab BroadcastChannel sync failed:', error);
}

try {
localStorage.setItem(CROSS_TAB_SYNC_STORAGE_KEY, JSON.stringify(event));
} catch (error) {
console.warn('[AtlasChat] Cross-tab storage sync failed:', error);
}
}, []);

useEffect(() => {
if (typeof BroadcastChannel !== 'undefined') {
try {
broadcastChannelRef.current = new BroadcastChannel(CROSS_TAB_SYNC_CHANNEL);
broadcastChannelRef.current.onmessage = (messageEvent) => {
handleCrossTabSync(messageEvent.data as CrossTabSyncEvent);
};
} catch (error) {
console.warn('[AtlasChat] BroadcastChannel unavailable:', error);
broadcastChannelRef.current = null;
}
}

const handleStorageSync = (storageEvent: StorageEvent) => {
if (storageEvent.key !== CROSS_TAB_SYNC_STORAGE_KEY || !storageEvent.newValue) return;
try {
handleCrossTabSync(JSON.parse(storageEvent.newValue) as CrossTabSyncEvent);
} catch (error) {
console.warn('[AtlasChat] Invalid cross-tab storage sync event:', error);
}
};

window.addEventListener('storage', handleStorageSync);

return () => {
window.removeEventListener('storage', handleStorageSync);
if (broadcastChannelRef.current) {
broadcastChannelRef.current.close();
broadcastChannelRef.current = null;
}
};
}, [handleCrossTabSync]);

// Hydrate initial state from backend once on mount.
// This ensures we detect human_mode even if /message doesn't include it,
// and it also restores any existing conversation on refresh.
useEffect(() => {
let cancelled = false;

pollHistory().finally(() => {
if (!cancelled) setInitialHistoryLoaded(true);
});

return () => {
cancelled = true;
};
}, [pollHistory]);

useEffect(() => {
if (!publicConfigLoaded || !initialHistoryLoaded || !tenantConfigLoaded || !officesLoaded || humanMode || isArchived) return;

if (standardSelfserviceEnabled) {
if (standardSelfserviceStartedRef.current) return;
setMessages([createWelcomeMessage(aiRepliesEnabled, widgetTexts)]);
setContext({ city: null, area: null, vehicle: null });
setSelectedVehicle(null);
setSelectedCity(null);
setGeneralMode(false);
setIsTyping(false);
lastMessageCountRef.current = 0;
beginStandardSelfservice();
return;
}

if (aiRepliesEnabled) return;

setMessages([createWelcomeMessage(aiRepliesEnabled, widgetTexts)]);
setSelectedCategoryId(null);
startIntake('Vad heter du?');
setIntakeData({});
setContext({ city: null, area: null, vehicle: null });
setSelectedVehicle(null);
setSelectedCity(null);
setIsTyping(false);
lastMessageCountRef.current = 0;
}, [publicConfigLoaded, initialHistoryLoaded, tenantConfigLoaded, officesLoaded, standardSelfserviceEnabled, aiRepliesEnabled, humanMode, isArchived, widgetTexts, intakeMode, categoryChoices]); // eslint-disable-line react-hooks/exhaustive-deps

// 🕒 Chattöppettider: visa notisen när chatten öppnas utanför bemannad tid.
// Körs EFTER bootstrap-effekten ovan (som nollställer meddelandelistan) så att
// notisen överlever starten av intake-/selfservice-flödet. I human mode och
// arkiverat läge äger serverhistoriken tråden — då injiceras ingenting.
useEffect(() => {
if (!publicConfigLoaded || !initialHistoryLoaded || !tenantConfigLoaded || !officesLoaded) return;
if (chatStaffed || humanMode || isArchived) return;
insertOfficeHoursNotice(buildOfficeHoursNotice());
}, [publicConfigLoaded, initialHistoryLoaded, tenantConfigLoaded, officesLoaded, chatStaffed, chatReopensLabel, humanMode, isArchived]); // eslint-disable-line react-hooks/exhaustive-deps

// Lightweight polling fallback for human mode only.
// Socket.io is the primary channel, but this catches missed events (network glitches, reconnects).
useEffect(() => {
if (!humanMode || isArchived) return;

const pollInterval = setInterval(() => {
pollHistory();
}, 5000); // Poll every 5 seconds in human mode

return () => clearInterval(pollInterval);
}, [humanMode, isArchived, pollHistory]);


const handleSendMessage = async (content: string, contextData?: QuickContextPayload) => {
if (!aiRepliesEnabled && !humanMode) {
if (!intakeStep) {
startIntake('Då sätter vi igång — vad heter du?');
return;
}
handleIntakeInput(content);
return;
}

// 🔥 TRIGGER-INTERCEPT: Endast exakt frasen — matchar server-sidans HUMAN_TRIGGERS.
// Headset-knappen och texttriggern startar samma inline-intake i chatten.
const HUMAN_TRIGGERS = ["jag vill prata med en människa"];
const isHumanTrigger = HUMAN_TRIGGERS.some(phrase => content.toLowerCase().trim() === phrase);
if (isHumanTrigger && !humanMode) {
// ✅ Starta det interaktiva chattflödet istället
startIntake('För att kunna koppla dig till rätt person behöver jag några uppgifter. Vad heter du?');
return;
}

// Rensa inaktivitetsvarning när kunden skriver
if (inactivityWarning) {
setInactivityWarning(false);
setInactivityCountdown(300);
if (inactivityTimerRef.current) {
clearInterval(inactivityTimerRef.current);
inactivityTimerRef.current = null;
}
}

// 1. Bygg context: Prioritera data från snabbknapp (contextData), annars använd sidans val
let messageContext: ChatContext;

if (contextData) {
// Snabbvalet skickade med specifik stad/fordon - ANVÄND DET
const useGeneralVehicle = contextData.clear_vehicle === true || contextData.vehicle_choice === 'OVRIGT' || contextData.vehicle === null;
messageContext = { 
vehicle: useGeneralVehicle ? null : getSafeActiveVehicle(contextData.vehicle),
...getContextFromOfficeSelection(offices, contextData.city)
};
if (useGeneralVehicle) {
messageContext.vehicle_choice = 'OVRIGT';
messageContext.clear_vehicle = true;
}
} else {
// Använd nuvarande val från fönstret
const cityLabel = selectedCity || singletonOfficeLabel;
const cityArea = cityLabel ? getContextFromOfficeSelection(offices, cityLabel) : { city: null, area: null };
messageContext = {
vehicle: generalMode ? null : (selectedVehicle ?? singletonVehicle ?? null),
city: cityArea.city,
area: cityArea.area,
};
if (generalMode) {
messageContext.vehicle_choice = 'OVRIGT';
messageContext.clear_vehicle = true;
}
}

// 2. Lägg till användarens meddelande i listan
const userMessage: ChatMessage = {
id: Date.now().toString(),
role: 'user',
content,
timestamp: new Date(),
};

setMessages((prev) => [...prev, userMessage]);
setIsTyping(true);

try {
// 3. SKICKA TILL SERVER
const response = await sendMessage(content, messages.length <= 1, messageContext);
notifySiblingTabs();

if (response.is_archived) {
setIsArchived(true);
setCloseReason(response.close_reason || 'deleted');
setArchivedMessage(response.close_reason === 'inactivity' ? 'Chatten har stängts automatiskt på grund av inaktivitet.' : 'Chatten har avslutats.');
setHumanMode(false);
setIsTyping(false);
return;
}

// 4. Uppdatera context OCH de visuella knapparna om servern ändrat kontext
if (response.locked_context) {
const newV = getSafeActiveVehicle(response.locked_context.vehicle);
const vehicleChoice = (response.locked_context as any).vehicle_choice;
const newCity = response.locked_context.city;
const newArea = response.locked_context.area;
const mergedArea = newCity ? (newArea ?? null) : (newArea ?? context.area ?? null);

// A) Uppdatera intern context-state (för nästa sökning)
setContext({
city: newCity ?? context.city ?? null,
area: mergedArea,
vehicle: newV ?? (vehicleChoice === 'OVRIGT' ? null : getSafeActiveVehicle(context.vehicle) ?? null),
vehicle_choice: vehicleChoice === 'OVRIGT' ? 'OVRIGT' : null,
clear_vehicle: vehicleChoice === 'OVRIGT',
});

// B) SYNK TILL UI: Uppdatera fordonstyp-knappen
if (newV && newV !== selectedVehicle && !(selectedVehicle === 'LASTBIL' && newV === 'BIL')) {
setGeneralMode(false);
setSelectedVehicle(newV);
window.selectedVehicle = newV;
} else if (vehicleChoice === 'OVRIGT') {
setGeneralMode(true);
setSelectedVehicle(null);
window.selectedVehicle = null;
}

// C) SYNK TILL UI: Uppdatera stads-knappen
if (newCity) {
const uiCityLabel = formatCityAreaLabel(newCity, mergedArea);

if (uiCityLabel && uiCityLabel !== selectedCity) {
setSelectedCity(uiCityLabel);
window.selectedCity = uiCityLabel;

const isSingleton = !!singletonOffice && !!singletonVehicle;
if (!isSingleton) {
toast.info(`Vi har anpassat dina val till ${uiCityLabel} och ${newV || 'fordon'}.`, {
duration: 3000,
});
}
}
}
}

// 5. Hantera Human Mode
if (response.human_mode) {
setHumanMode(true);
if (!response.answer || response.answer.trim() === '') {
setIsTyping(false);
return;
}
}

// 6. Lägg till Atlas svar
if (response.answer && response.answer.trim() !== '') {
const assistantMessage: ChatMessage = {
id: (Date.now() + 1).toString(),
role: 'assistant',
content: response.answer,
timestamp: new Date(),
choices: response.choices,
};
setMessages((prev) => [...prev, assistantMessage]);
}
} catch (error) {
console.error('[AtlasChat] Error sending message:', error);
if (!humanMode) {
toast.error("Kunde inte skicka meddelandet. Försök igen.");
}
} finally {
setIsTyping(false);
}
};

const handleReset = () => {
setMessages([createWelcomeMessage(aiRepliesEnabled, widgetTexts)]);
setContext({ city: null, area: null, vehicle: null });
setSelectedVehicle(null);
setSelectedCity(null);
setGeneralMode(false);
setHumanMode(false);
setSelectedCategoryId(null);
setSelfserviceStage(null);
setSelfserviceUnitId(null);
setSelfserviceUnitLabel(null);
setSelfserviceMenu([]);
standardSelfserviceStartedRef.current = false;
if (standardSelfserviceEnabled) {
setIntakeStep(null);
beginStandardSelfservice();
} else if (aiRepliesEnabled) {
setIntakeStep(null);
} else {
startIntake('Vad heter du?');
}
setIntakeData({});
setAgentNames([]);
setTypingAgentName(null);
setAssignedAgentName(null);
setIsArchived(false);
setCloseReason(null);
setArchivedMessage(null);
lastMessageCountRef.current = 0;

// Reset the session id AND ensure the socket joins the new session room.
disconnectSocket();
resetSession();
connectSocket(handleAgentReply, handleSessionStatus, handleAgentTyping, handleInactivityWarning, handleSessionAssigned, pollHistory);
};

const handleQuickAction = (message: string, contextData?: QuickContextPayload) => {
if (contextData) {
if (contextData.clear_vehicle === true || contextData.vehicle_choice === 'OVRIGT' || contextData.vehicle === null) {
handleGeneralVehicleSelect();
} else {
handleVehicleChange(getSafeActiveVehicle(contextData.vehicle));
}
handleCityChange(contextData.city);
}
handleSendMessage(message, contextData);
};

const handleEndSession = () => {
// Emit socket event to notify server that customer ended the chat
emitEndChat();
setCloseReason(null);

if (messages.length > 1) {
setShowEndDialog(true);
} else {
toast.success("Ärendet har avslutats. Tack för att du kontaktade oss!");
}
};

const handleConfirmEnd = () => {
setShowEndDialog(false);
toast.success("Ärendet har avslutats. Tack för att du kontaktade oss!");
handleReset();
};

const handleRequestHuman = () => {
if (humanMode) return;
// 🕒 Påminnelse utanför öppettid — informerar men blockerar inte eskaleringen.
if (!chatStaffed) injectOfficeHoursReminder();
if (standardSelfserviceEnabled) {
if (selfserviceUnitId && selectedCategoryId) {
startStandardEscalation();
} else if (selfserviceStage === 'unit') {
injectBotMessage('Välj först den avdelning du vill skapa ärendet hos.', getStandardUnitChoices());
} else {
injectBotMessage('Välj först kategori.', getStandardCategoryChoices(selfserviceUnitId));
}
return;
}
if (!aiRepliesEnabled) {
if (!intakeStep) {
startIntake('Då sätter vi igång — vad heter du?');
}
return;
}
// ✅ Starta det interaktiva chattflödet istället
startIntake('För att kunna koppla dig till rätt person behöver jag några uppgifter. Vad heter du?');
};

const finishIntakeHandoff = ({
name,
email,
phone,
city,
vehicle,
general = false,
categoryId,
}: {
name?: string;
email?: string;
phone?: string;
city?: string;
vehicle?: VehicleType | null;
general?: boolean;
categoryId?: string;
}) => {
// Kund som valt "Övrigt / Allmän fråga" eskalerar utan fordon (general=true).
if (!name || !email || !city || (!vehicle && !general)) return;

const selectedOffice = city === 'Centralsupport' ? undefined : findSafeOfficeFromLiveContext(offices, city, context);
const split = splitCityArea(city);
let routingCity: string | null = null;
let routingArea: string | null = null;
let handoffCityLabel = city;

if (selectedOffice) {
routingCity = selectedOffice.city || null;
routingArea = selectedOffice.area || null;
handoffCityLabel = getOfficeDisplayName(selectedOffice);
} else if (city !== 'Centralsupport') {
routingCity = (context.city && context.area) ? context.city : (split.city || null);
routingArea = (context.city && context.area) ? context.area || null : split.area || null;
const formatted = formatCityAreaLabel(routingCity, routingArea);
if (formatted) handoffCityLabel = formatted;
}

const targetAgentId = selectedOffice ? selectedOffice.routing_tag : null;

injectBotMessage(general
? `Tack! Kopplar dig nu till **${handoffCityLabel}**... 🔗`
: `Tack! Kopplar dig nu till **${handoffCityLabel}** för ${VEHICLE_HANDOFF_LABELS[vehicle as VehicleType]}... 🔗`);

setSelectedCity(handoffCityLabel);
if (general) {
setGeneralMode(true);
setSelectedVehicle(null);
window.selectedVehicle = null;
} else {
setSelectedVehicle(vehicle as VehicleType);
}
setHumanMode(true);

sendEscalationSilently(general
? {
vehicle: null,
vehicle_choice: 'OVRIGT',
clear_vehicle: true,
city: routingCity,
area: routingArea,
agent_id: targetAgentId,
...(categoryId ? { category_id: categoryId } : {}),
...(categoryId && targetAgentId ? { unit_id: targetAgentId } : {}),
name,
email,
phone,
}
: {
vehicle,
city: routingCity,
area: routingArea,
agent_id: targetAgentId,
name,
email,
phone,
});

setIntakeData({});
};

const handleChoiceSelected = (value: string) => {
const vehicleLabels: Record<string, string> = {
BIL: 'Bil (B)',
MC: 'Motorcykel (A)',
AM: 'Moped (AM)',
LASTBIL: 'Lastbil / Buss',
SLÄP: 'Släp (BE/B96)',
};

if (standardSelfserviceEnabled && !humanMode && !intakeStep) {
void handleStandardChoice(value);
return;
}
if (
standardSelfserviceEnabled &&
!humanMode &&
intakeStep &&
(valueAfterPrefix(value, STANDARD_UNIT_PREFIX) || valueAfterPrefix(value, STANDARD_CATEGORY_PREFIX))
) {
void handleStandardChoice(value);
return;
}

if (!intakeStep) {
handleSendMessage(value);
return;
}

if (intakeStep === 'office') {
injectUserMessage(value);
if (categoryFirstEnabled) {
const selectedOffice = value === 'Centralsupport'
? undefined
: findSafeOfficeFromLiveContext(offices, value, context);
setIntakeData((prev) => ({ ...prev, city: value }));
setSelectedCity(value);
window.selectedCity = value;
setContext(prev => ({
...prev,
city: selectedOffice?.city || (value === 'Centralsupport' ? 'Centralsupport' : prev.city),
area: selectedOffice?.area || null,
unit_id: selectedOffice?.routing_tag || null,
vehicle: null,
vehicle_choice: 'OVRIGT',
clear_vehicle: true,
}));
setIntakeStep('category');
const categoryChoicesForOffice = getCategoryChoicesForOfficeLabel(value);
if (categoryChoicesForOffice.length === 0) {
setIntakeStep('name');
injectBotMessage('Vad heter du?');
return;
}
injectBotMessage('Vad gäller ärendet?', categoryChoicesForOffice);
return;
}
// Övrigt-kund tvingas aldrig välja fordon efter kontorsvalet — avsluta direkt som Övrigt.
const isGeneral = generalMode || context.vehicle_choice === 'OVRIGT';
const safeVehicle = isGeneral ? null : getSafeActiveVehicle(intakeData.vehicle);
if (safeVehicle || isGeneral) {
setIntakeStep(null);
finishIntakeHandoff({
...intakeData,
city: value,
vehicle: isGeneral ? null : safeVehicle,
general: isGeneral,
});
return;
}

setIntakeData((prev) => ({ ...prev, city: value }));
if (intakeMode === 'category_first' && categoryChoices.length > 0) {
const categoryChoicesForOffice = getCategoryChoicesForOfficeLabel(value);
if (categoryChoicesForOffice.length === 0) {
setIntakeStep('name');
injectBotMessage('Vad heter du?');
return;
}
setIntakeStep('category');
injectBotMessage('Vad gäller ärendet?', categoryChoicesForOffice);
return;
}
setIntakeStep('vehicle');
injectBotMessage('Vad gäller ärendet?', activeVehicleChoices);

} else if (intakeStep === 'category') {
const categoryLabel = categoryChoices.find((choice) => choice.value === value)?.label || value;
injectUserMessage(categoryLabel);
setSelectedCategoryId(value);
const selectedIntakeCity = intakeData.city || selectedCity;
const isCentralSupport = normalizeOfficeLabel(selectedIntakeCity) === normalizeOfficeLabel('Centralsupport');
if (isCentralSupport) {
setIntakeData((prev) => ({ ...prev, city: 'Centralsupport' }));
setIntakeStep('name');
injectBotMessage('Vad heter du?');
return;
}
const safeOffice = findSafeOfficeFromLiveContext(offices, selectedIntakeCity, context) || singletonOffice || undefined;
if (safeOffice) {
setIntakeData((prev) => ({ ...prev, city: getOfficeDisplayName(safeOffice) }));
setIntakeStep('name');
injectBotMessage('Vad heter du?');
return;
}
setIntakeStep('office');
injectBotMessage(widgetTexts.officeQuestion, getOfficeChoices());

} else if (intakeStep === 'vehicle') {
injectUserMessage(vehicleLabels[value] || value);
setIntakeStep(null);

const finalVehicle = getSafeActiveVehicle(value);
if (!finalVehicle) return;
finishIntakeHandoff({
...intakeData,
vehicle: finalVehicle,
});
}
};

// Tyst eskalering — skickar eskaleringsmeddelandet till backend utan att
// visa "Jag vill prata med en människa"-bubblan eller backendsvaret i UI.
// Intake-flödet visar redan "Kopplar dig nu till X..." som bekräftelse.
const sendEscalationSilently = async (contextWithContact: ChatContext & { name?: string; email?: string; phone?: string }) => {
try {
const response = await sendMessage('Jag vill prata med en människa', false, contextWithContact);
notifySiblingTabs();
lastMessageCountRef.current += 1;

if (response.locked_context) {
const newV = getSafeActiveVehicle(response.locked_context.vehicle);
const vehicleChoice = (response.locked_context as any).vehicle_choice;
const newCity = response.locked_context.city;
const newArea = response.locked_context.area;
const mergedArea = newCity ? (newArea ?? null) : (newArea ?? context.area ?? null);
setContext({
city: newCity ?? context.city ?? null,
area: mergedArea,
vehicle: newV ?? (vehicleChoice === 'OVRIGT' ? null : getSafeActiveVehicle(context.vehicle) ?? null),
vehicle_choice: vehicleChoice === 'OVRIGT' ? 'OVRIGT' : null,
clear_vehicle: vehicleChoice === 'OVRIGT',
});
if (newV && newV !== selectedVehicle) {
setGeneralMode(false);
setSelectedVehicle(newV);
window.selectedVehicle = newV;
} else if (vehicleChoice === 'OVRIGT') {
setGeneralMode(true);
setSelectedVehicle(null);
window.selectedVehicle = null;
}
if (newCity) {
const uiCityLabel = formatCityAreaLabel(newCity, mergedArea);
if (uiCityLabel && uiCityLabel !== selectedCity) {
setSelectedCity(uiCityLabel);
window.selectedCity = uiCityLabel;
}
}
}

if (response.human_mode) {
setHumanMode(true);
}
} catch (error) {
console.error('[AtlasChat] Escalation error:', error);
}
};

const handleToggleTheme = () => {
setIsDark(prev => !prev);
};

// Snabbsvar (KUNDCHATT-mallar) — injicerar mallens content som ett lokalt
// assistant-meddelande. Påverkar inte socket-flödet eller backend-historiken.
const handleTemplateSelect = (content: string) => {
const templateMessage: ChatMessage = {
id: generateMessageId(),
role: 'assistant',
content,
timestamp: new Date(),
senderName: null,
};
setMessages((prev) => [...prev, templateMessage]);
};

const showWelcomeWidget = aiRepliesEnabled && messages.length === 1 && messages[0].id === 'welcome-msg' && !isTyping;
const hasCustomerMessage = messages.some((message) => message.role === 'user');
const selfserviceFreeTextBlocked = standardSelfserviceEnabled && !humanMode && !intakeStep;
const showStandardSelfserviceMenuButton = shouldShowStandardSelfserviceMenu({
stage: selfserviceStage,
humanMode,
intakeActive: Boolean(intakeStep),
isArchived,
});
const handleInputSend = (message: string, contextData?: QuickContextPayload) => {
if (standardSelfserviceEnabled && !humanMode && !intakeStep) {
return;
}
if (!aiRepliesEnabled && !humanMode) {
handleIntakeInput(message);
return;
}

if (intakeStep) {
handleIntakeInput(message);
return;
}

handleSendMessage(message, contextData);
};

return (
<div className={`flex flex-col h-full bg-chat-bg ${isDark ? 'dark' : ''}`} data-testid="atlas-chat-shell">
<ChatHeader
onEndSession={hasCustomerMessage ? handleEndSession : undefined}
onRequestHuman={handleRequestHuman}
isDark={isDark}
onToggleTheme={handleToggleTheme}
selectedCity={selectedCity}
selectedVehicle={selectedVehicle}
generalMode={generalMode}
offices={offices}
onTemplateSelect={handleTemplateSelect}
companyName={companyName}
companyLogoUrl={companyLogoUrl}
activeVehicles={activeVehicles}
subtitle={widgetTexts.headerSubtitle}
templatesTitle={widgetTexts.templatesTitle}
templatesSubtitle={widgetTexts.templatesSubtitle}
intakeMode={intakeMode}
categoryChoices={categoryChoices}
formLabels={{ unit: widgetTexts.formUnitLabel, category: widgetTexts.formCategoryLabel }}
contactFormOpen={contactFormOpen}
onContactFormOpenChange={setContactFormOpen}
/>

{/* Human mode indicator */}
{humanMode && !isArchived && (
<HumanModeIndicator
agentNames={agentNames}
assignedAgentName={assignedAgentName}
status={assignedAgentName ? 'active' : 'waiting'}
/>
)}

{/* Inaktivitetsvarning — visas 5 min innan chatten stängs automatiskt */}
{inactivityWarning && !isArchived && (
<div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 text-center">
<div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
</svg>
<span className="text-sm font-medium">
Chatten stängs automatiskt pga inaktivitet om{' '}
<span className="tabular-nums font-bold">
{Math.floor(inactivityCountdown / 60)}:{String(inactivityCountdown % 60).padStart(2, '0')}
</span>
{' '}— {selfserviceFreeTextBlocked ? 'välj ett alternativ' : 'skriv något'} för att hålla den öppen.
</span>
</div>
</div>
)}

{/* Archived indicator */}
{isArchived && (
<div className="bg-muted/80 border-b border-border px-4 py-3 text-center">
<div className="flex items-center justify-center gap-2 text-muted-foreground">
<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
</svg>
<span className="font-medium">{archivedMessage || 'Chatten är avslutad av handläggaren.'}</span>
</div>
</div>
)}

{/* Messages area */}
<div ref={scrollContainerRef} className="flex-1 overflow-y-auto chat-scrollbar px-4 py-4">
<div className="flex flex-col gap-3">
{/* Välkomst-widget (logga + snabbknappar) visas bara innan kunden skickat något */}
{showWelcomeWidget && (
<WelcomeMessage
onQuickAction={intakeMode === 'legacy' ? handleQuickAction : undefined}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={handleVehicleChange}
onGeneralVehicleSelect={handleGeneralVehicleSelect}
generalMode={generalMode}
onCityChange={handleCityChange}
offices={offices}
companyName={companyName}
companyLogoUrl={companyLogoUrl}
activeVehicles={activeVehicles}
quickQuestions={quickQuestions}
/>
)}

{/* Alla meddelanden renderas alltid, inklusive välkomstbubblan */}
{messages.map((message, index) => (
<ChatBubble
key={message.id}
content={message.content}
isUser={message.role === 'user'}
timestamp={message.timestamp}
isLatest={index === messages.length - 1}
senderName={message.senderName}
choices={message.choices}
onChoiceSelect={handleChoiceSelected}
onRequestHuman={handleRequestHuman}
onOpenContactForm={() => setContactFormOpen(true)}
/>
))}

<div className="min-h-[52px]">
<div className={isTyping ? "opacity-100 transition-opacity duration-150" : "opacity-0 pointer-events-none transition-opacity duration-200"}>
<TypingIndicator agentName={typingAgentName} />
</div>
</div>
<div ref={messagesEndRef} />
</div>
</div>

{/* Context indicator - interactive */}
{intakeMode === 'legacy' && aiRepliesEnabled && !humanMode && (
<ContextIndicator 
context={context}
offices={offices} // 🚀 NY: Dynamisk lista tillagd
onUpdateContext={(updates) => {
// 1. Uppdatera Huvud-Context (Backend)
const safeUpdates = updates.vehicle !== undefined
? { ...updates, vehicle: getSafeActiveVehicle(updates.vehicle as string | null) }
: updates;
setContext(prev => ({ ...prev, ...safeUpdates }));

// 2. Uppdatera UI-State (Knapparna/ChatInput) - DETTA SAKNADES (BEVARAT)
if (updates.vehicle !== undefined) {
const v = getSafeActiveVehicle(updates.vehicle as string | null);
if (v) setGeneralMode(false);
setSelectedVehicle(v); 
window.selectedVehicle = v;
}

if (updates.vehicle_choice !== undefined) {
setGeneralMode(updates.vehicle_choice === 'OVRIGT');
if (updates.vehicle_choice === 'OVRIGT') {
setSelectedVehicle(null);
window.selectedVehicle = null;
}
}

if (updates.city !== undefined) {
const c = formatCityAreaLabel(updates.city as string | null, updates.area as string | null);
setSelectedCity(c); 
window.selectedCity = c;
}
}}
activeVehicles={activeVehicles}
/>
)}

{/* Input - disabled when archived */}
{isArchived ? (
<div className="px-4 py-4 border-t border-border bg-muted/50">
<p className="text-sm text-muted-foreground text-center">Denna konversation är avslutad.</p>
</div>
) : (
<ChatInput
onSend={handleInputSend}

disabled={isTyping || selfserviceFreeTextBlocked}
// K7/§5: den långa varianten ("Välj ett alternativ ovan eller skapa ett
// ärende") wrappade till två rader i mobil viewport och andra raden KLIPPTES
// — mätt på 390px: textarea scrollHeight 56 > clientHeight 36, medan desktop
// (402px bred) fick 36 = 36. Kortare text ryms på en rad i båda.
placeholder={selfserviceFreeTextBlocked
? "Välj ett alternativ ovan"
: (!aiRepliesEnabled && !humanMode ? "Skriv ditt svar..." : (humanMode ? "Skriv till support..." : "Skriv ett meddelande..."))}
showQuickQuestions={intakeMode === 'legacy' && aiRepliesEnabled && !humanMode && messages.length > 1}
showStandardSelfserviceMenu={showStandardSelfserviceMenuButton}
standardSelfserviceMenu={selfserviceMenu}
// K7/C: 'Centralsupport' är en SENTINEL internt (jämförs mot intakeData.city
// och selectedCity på flera ställen, t.ex. rad 979 och 575) — den byts inte.
// Kunden ska däremot aldrig läsa ordet, så vi mappar först vid renderingen.
standardUnitLabel={selfserviceUnitId === STANDARD_CENTRAL_SUPPORT ? STANDARD_CENTRAL_SUPPORT_LABEL : selfserviceUnitLabel}
standardCategoryLabel={selfserviceCategoryLabel}
onStandardMenuChoice={(value) => { void handleStandardChoice(value); }}
selectedVehicle={selectedVehicle}
onVehicleChange={handleVehicleChange}
onGeneralVehicleSelect={handleGeneralVehicleSelect}
generalMode={generalMode}
onCityChange={handleCityChange}
selectedCity={selectedCity}
offices={offices}
humanMode={humanMode}
aiRepliesEnabled={aiRepliesEnabled}
activeVehicles={activeVehicles}
quickQuestions={quickQuestions}
/>
)}

{/* End Session Dialog */}
<EndSessionDialog
open={showEndDialog}
onOpenChange={setShowEndDialog}
messages={messages}
onConfirm={handleConfirmEnd}
closeReason={closeReason}
/>

</div>
);
}
