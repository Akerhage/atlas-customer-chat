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
resetSession,
getHistory,
connectSocket,
disconnectSocket,
getSessionId,
emitEndChat,
getPublicOffices,
getPublicConfig,
type ChatContext,
type HistoryMessage,
type CustomerReplyEvent,
type SessionStatusEvent,
type SessionWarningEvent,
} from "@/lib/atlas-client";
import { toast } from "sonner";

declare global {
interface Window {
selectedCity: string | null;
selectedVehicle: "BIL" | "MC" | "AM" | "LASTBIL" | null;
}
}

interface ChatMessage {
id: string;
role: 'user' | 'assistant';
content: string;
timestamp: Date;
senderName?: string | null; // Agentens namn för mänskliga svar (null = Atlas AI)
choices?: { label: string; value: string }[];
}

type IntakeStep = 'name' | 'email' | 'phone' | 'office' | 'vehicle' | null;
type VehicleType = "BIL" | "MC" | "AM" | "LASTBIL";

interface Office {
id: number;
name: string;
display_name?: string;
city: string;
area: string | null;
routing_tag: string;
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

function findOfficeByLabel(offices: Office[], value: string | null | undefined): Office | undefined {
return findOfficesByLabel(offices, value)[0];
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
const office = findOfficeByLabel(offices, value);
if (office) return { city: office.city || null, area: office.area || null };
return value ? splitCityArea(value) : { city: null, area: null };
}

function formatCityAreaLabel(city: string | null | undefined, area: string | null | undefined): string | null {
if (!city) return null;
return area ? `${city} - ${area}` : city;
}

const VEHICLE_CHOICES: { label: string; value: VehicleType }[] = [
{ label: 'Bil (B)',        value: 'BIL'     },
{ label: 'Motorcykel (A)', value: 'MC'      },
{ label: 'Moped (AM)',     value: 'AM'      },
{ label: 'Lastbil / Buss', value: 'LASTBIL' },
];

const VEHICLE_HANDOFF_LABELS: Record<VehicleType, string> = {
BIL: 'Bil',
MC: 'MC',
AM: 'Moped',
LASTBIL: 'Lastbil / Buss',
};

function getSafeVehicle(value: string | null | undefined): VehicleType | null {
return VEHICLE_CHOICES.some((choice) => choice.value === value) ? value as VehicleType : null;
}

const AI_ON_WELCOME_MESSAGE_CONTENT = `Hej och välkommen till oss! 👋

Jag är företagets smarta AI-assistent!

Du kan fråga mig allt som rör ditt körkort och vårt utbud.

Jag har stenkoll på våra priser, produkter, utbildningar och kontor, men även på allmän information som rör körkort.

Vill du hellre prata med en människa?

Skriv bara *"jag vill prata med en människa"*.

Eller klicka på headsetikonen i menyn ovanför chatten.

Vad kan jag hjälpa dig med idag?`;

const AI_OFF_WELCOME_MESSAGE_CONTENT = `Hej och välkommen till oss! 👋

Har du frågor att ställa till oss är du varmt välkommen att ställa dem här.

Här kan du välja att ställa frågor till vår Centralsupport i Stockholm.

Du kan också mejla eller chatta direkt med ditt lokala kontor.

Jag guidar dig genom att fylla i ditt namn och skicka ärendet rätt.

Några korta steg, sedan är du igång!

Vi börjar med ditt namn.

Vad heter du?`;

const getWelcomeMessageContent = (aiRepliesEnabled: boolean) =>
aiRepliesEnabled ? AI_ON_WELCOME_MESSAGE_CONTENT : AI_OFF_WELCOME_MESSAGE_CONTENT;

const createWelcomeMessage = (aiRepliesEnabled: boolean): ChatMessage => ({
id: 'welcome-msg',
role: 'assistant',
content: getWelcomeMessageContent(aiRepliesEnabled),
timestamp: new Date(),
});

export function AtlasChat() {
const [messages, setMessages] = useState<ChatMessage[]>([
createWelcomeMessage(true)
]);
const [offices, setOffices] = useState<Office[]>([]); // 🔥 Håller kontorslistan
const [aiRepliesEnabled, setAiRepliesEnabled] = useState(true);
const [publicConfigLoaded, setPublicConfigLoaded] = useState(false);
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
vehicle?: VehicleType;
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
const [selectedVehicle, setSelectedVehicle] = useState<"BIL" | "MC" | "AM" | "LASTBIL" | null>(null);
const [selectedCity, setSelectedCity] = useState<string | null>(null);

// Hämta kontorslistan från API när chatten bootar
useEffect(() => {
getPublicOffices()
.then(data => setOffices(data))
.catch(err => console.error("Kunde inte ladda kontor:", err));
}, []);

useEffect(() => {
let cancelled = false;

getPublicConfig()
.then((config) => {
if (cancelled) return;
setAiRepliesEnabled(config.ai_replies_enabled);
})
.catch((err) => {
if (cancelled) return;
console.error("Kunde inte ladda publik konfiguration:", err);
setAiRepliesEnabled(true);
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
const handleVehicleChange = (vehicle: "BIL" | "MC" | "AM" | "LASTBIL" | null) => {
setSelectedVehicle(vehicle);
setContext((prev) => ({ ...prev, vehicle }));
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

const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Injicerar ett bot-meddelande lokalt i chatten under intake-flödet.
// VIKTIGT: lastMessageCountRef inkrementeras INTE avsiktligt.
// Intake-meddelanden är efemära – när humanMode startar och
// polling aktiveras ersätts de automatiskt av serverns historik.
const injectBotMessage = (content: string, choices?: { label: string; value: string }[]) => {
setMessages((prev) => [
...prev,
{
id: generateMessageId(),
role: 'assistant' as const,
content,
timestamp: new Date(),
choices,
},
]);
};

// Injicerar ett användarmeddelande lokalt utan att skicka till backend.
// lastMessageCountRef inkrementeras inte av samma anledning som ovan.
const injectUserMessage = (content: string) => {
setMessages((prev) => [
...prev,
{
id: generateMessageId(),
role: 'user' as const,
content,
timestamp: new Date(),
},
]);
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
setArchivedMessage(event.message || (event.close_reason === 'inactivity' ? 'Chatten har stängts automatiskt på grund av inaktivitet.' : 'Chatten är avslutad av handläggaren.'));
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
if (!aiRepliesEnabled) {
setIntakeStep('name');
injectBotMessage('Okej, vi börjar om. Vad heter du?');
return;
}
setIntakeStep(null);
injectBotMessage('Okej, vi avbröt det. Skriv gärna om du har fler frågor!');
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
injectBotMessage('Tack! Vill du lägga till ett mobilnummer? Skriv numret eller **"hoppa över"**.');
break;
}
case 'phone': {
const skipWords = ['hoppa över', 'hoppa over', 'skip', '-', 'nej', 'ingen'];
const isSkip = skipWords.includes(trimmed.toLowerCase());
const digits = trimmed.replace(/\D/g, '').slice(0, 10);
if (!isSkip && digits.length < 8) {
injectBotMessage('Ange ett giltigt mobilnummer (minst 8 siffror) eller skriv **"hoppa över"**.');
return;
}
const safeOffice = findSafeOfficeFromLiveContext(offices, selectedCity, context);
const safeVehicle = getSafeVehicle(selectedVehicle) || getSafeVehicle(context.vehicle);
const nextIntakeData = {
...intakeData,
phone: isSkip ? undefined : digits,
city: safeOffice ? getOfficeDisplayName(safeOffice) : intakeData.city,
vehicle: safeVehicle || intakeData.vehicle,
};
setIntakeData(nextIntakeData);

if (safeOffice && safeVehicle) {
setIntakeStep(null);
finishIntakeHandoff({
...nextIntakeData,
city: getOfficeDisplayName(safeOffice),
vehicle: safeVehicle,
});
return;
}

if (safeOffice) {
setIntakeStep('vehicle');
injectBotMessage('Vad gäller ärendet?', VEHICLE_CHOICES);
return;
}

setIntakeStep('office');
const officeChoices: { label: string; value: string }[] = [
{ label: 'Centralsupport', value: 'Centralsupport' },
...offices.map((o) => {
const name = getOfficeDisplayName(o);
return { label: name, value: name };
}),
];
injectBotMessage('Vilket kontor vill du kontakta?', officeChoices);
break;
}
case 'office':
case 'vehicle': {
injectBotMessage('Klicka på ett av alternativen ovan för att välja 👆');
break;
}
default:
break;
}
};

// Connect socket on mount, disconnect on unmount
useEffect(() => {
connectSocket(handleAgentReply, handleSessionStatus, handleAgentTyping, handleInactivityWarning, handleSessionAssigned);

return () => {
if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
disconnectSocket();
};
}, [handleAgentReply, handleSessionStatus, handleAgentTyping, handleInactivityWarning, handleSessionAssigned]);

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
setArchivedMessage(history.close_reason === 'inactivity' ? 'Chatten har stängts automatiskt på grund av inaktivitet.' : 'Chatten är avslutad av handläggaren.');
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
if (!publicConfigLoaded || !initialHistoryLoaded || aiRepliesEnabled || humanMode || isArchived) return;

setMessages([createWelcomeMessage(false)]);
setIntakeStep('name');
setIntakeData({});
setContext({ city: null, area: null, vehicle: null });
setSelectedVehicle(null);
setSelectedCity(null);
setIsTyping(false);
lastMessageCountRef.current = 0;
}, [publicConfigLoaded, initialHistoryLoaded, aiRepliesEnabled, humanMode, isArchived]);

// Lightweight polling fallback for human mode only.
// Socket.io is the primary channel, but this catches missed events (network glitches, reconnects).
useEffect(() => {
if (!humanMode || isArchived) return;

const pollInterval = setInterval(() => {
pollHistory();
}, 5000); // Poll every 5 seconds in human mode

return () => clearInterval(pollInterval);
}, [humanMode, isArchived, pollHistory]);


const handleSendMessage = async (content: string, contextData?: { vehicle: string; city: string }) => {
if (!aiRepliesEnabled && !humanMode) {
if (!intakeStep) {
setIntakeStep('name');
injectBotMessage('Då sätter vi igång — vad heter du?');
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
setIntakeStep('name');
injectBotMessage('För att kunna koppla dig till rätt person behöver jag några uppgifter. Vad heter du?');
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
messageContext = { 
vehicle: contextData.vehicle as "BIL" | "MC" | "AM" | "LASTBIL" | null,
...getContextFromOfficeSelection(offices, contextData.city)
};
} else {
// Använd nuvarande val från fönstret
const cityArea = selectedCity ? getContextFromOfficeSelection(offices, selectedCity) : { city: null, area: null };
messageContext = {
vehicle: selectedVehicle ?? null,
city: cityArea.city,
area: cityArea.area,
};
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

// 4. Uppdatera context OCH de visuella knapparna om servern ändrat kontext
if (response.locked_context) {
const newV = response.locked_context.vehicle as "BIL" | "MC" | "AM" | "LASTBIL" | null;
const newCity = response.locked_context.city;
const newArea = response.locked_context.area;

// A) Uppdatera intern context-state (för nästa sökning)
setContext({
city: newCity ?? context.city ?? null,
area: newArea ?? context.area ?? null,
vehicle: newV ?? context.vehicle ?? null,
});

// B) SYNK TILL UI: Uppdatera fordonstyp-knappen
if (newV && newV !== selectedVehicle && !(selectedVehicle === 'LASTBIL' && newV === 'BIL')) {
setSelectedVehicle(newV);
window.selectedVehicle = newV;
}

// C) SYNK TILL UI: Uppdatera stads-knappen
if (newCity) {
const uiCityLabel = formatCityAreaLabel(newCity, newArea);

if (uiCityLabel && uiCityLabel !== selectedCity) {
setSelectedCity(uiCityLabel);
window.selectedCity = uiCityLabel;

toast.info(`Vi har anpassat dina val till ${uiCityLabel} och ${newV || 'fordon'}.`, {
duration: 3000,
});
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
setMessages([createWelcomeMessage(aiRepliesEnabled)]);
setContext({ city: null, area: null, vehicle: null });
setSelectedVehicle(null);
setSelectedCity(null);
setHumanMode(false);
setIntakeStep(aiRepliesEnabled ? null : 'name');
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
connectSocket(handleAgentReply, handleSessionStatus, handleAgentTyping, handleInactivityWarning, handleSessionAssigned);
};

const handleQuickAction = (message: string, contextData?: { vehicle: string; city: string }) => {
if (contextData) {
handleVehicleChange(contextData.vehicle as "BIL" | "MC" | "AM" | "LASTBIL");
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
if (!aiRepliesEnabled) {
if (!intakeStep) {
setIntakeStep('name');
injectBotMessage('Då sätter vi igång — vad heter du?');
}
return;
}
// ✅ Starta det interaktiva chattflödet istället
setIntakeStep('name');
injectBotMessage('För att kunna koppla dig till rätt person behöver jag några uppgifter. Vad heter du?');
};

const finishIntakeHandoff = ({
name,
email,
phone,
city,
vehicle,
}: {
name?: string;
email?: string;
phone?: string;
city?: string;
vehicle?: VehicleType;
}) => {
if (!name || !email || !city || !vehicle) return;

injectBotMessage(`Tack! Kopplar dig nu till **${city}** för ${VEHICLE_HANDOFF_LABELS[vehicle]}... 🔗`);

setSelectedCity(city);
setSelectedVehicle(vehicle);
setHumanMode(true);

let routingCity: string | null = null;
let routingArea: string | null = null;

if (city !== 'Centralsupport') {
const ctxResult = getContextFromOfficeSelection(offices, city);
routingCity = ctxResult.city || null;
routingArea = ctxResult.area || null;
}

const selectedOffice = city === 'Centralsupport' ? null : findOfficeByLabel(offices, city);
const targetAgentId = selectedOffice ? selectedOffice.routing_tag : null;

if (!selectedOffice && city !== 'Centralsupport') {
const split = splitCityArea(city);
routingCity = split.city;
routingArea = split.area;
}

sendEscalationSilently({
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
};

if (intakeStep === 'office') {
injectUserMessage(value);
const safeVehicle = getSafeVehicle(intakeData.vehicle);
if (safeVehicle) {
setIntakeStep(null);
finishIntakeHandoff({
...intakeData,
city: value,
vehicle: safeVehicle,
});
return;
}

setIntakeData((prev) => ({ ...prev, city: value }));
setIntakeStep('vehicle');
injectBotMessage('Vad gäller ärendet?', VEHICLE_CHOICES);

} else if (intakeStep === 'vehicle') {
injectUserMessage(vehicleLabels[value] || value);
setIntakeStep(null);

const finalVehicle = getSafeVehicle(value);
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
lastMessageCountRef.current += 1;

if (response.locked_context) {
const newV = response.locked_context.vehicle as "BIL" | "MC" | "AM" | "LASTBIL" | null;
const newCity = response.locked_context.city;
const newArea = response.locked_context.area;
setContext({
city: newCity ?? context.city ?? null,
area: newArea ?? context.area ?? null,
vehicle: newV ?? context.vehicle ?? null,
});
if (newV && newV !== selectedVehicle) {
setSelectedVehicle(newV);
window.selectedVehicle = newV;
}
if (newCity) {
const uiCityLabel = formatCityAreaLabel(newCity, newArea);
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
const handleInputSend = (message: string, contextData?: { vehicle: string; city: string }) => {
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
<div className={`flex flex-col h-full ${isDark ? 'bg-chat-bg dark' : 'bg-zinc-50'} `}>
<ChatHeader
onReset={messages.length > 1 ? handleReset : undefined}
onEndSession={handleEndSession}
onRequestHuman={handleRequestHuman}
isDark={isDark}
onToggleTheme={handleToggleTheme}
// 🔥 FIX 3: Dina rader här är kvar
selectedCity={selectedCity}
selectedVehicle={selectedVehicle}
offices={offices} // 🚀 NY: Dynamisk lista tillagd
onTemplateSelect={handleTemplateSelect}
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
{' '}— skriv något för att hålla den öppen.
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
onQuickAction={handleQuickAction}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={handleVehicleChange}
onCityChange={handleCityChange}
offices={offices}
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
{aiRepliesEnabled && !humanMode && (
<ContextIndicator 
context={context}
offices={offices} // 🚀 NY: Dynamisk lista tillagd
onUpdateContext={(updates) => {
// 1. Uppdatera Huvud-Context (Backend)
setContext(prev => ({ ...prev, ...updates }));

// 2. Uppdatera UI-State (Knapparna/ChatInput) - DETTA SAKNADES (BEVARAT)
if (updates.vehicle !== undefined) {
const v = updates.vehicle as "BIL" | "MC" | "AM" | "LASTBIL" | null;
setSelectedVehicle(v); 
window.selectedVehicle = v;
}

if (updates.city !== undefined) {
const c = formatCityAreaLabel(updates.city as string | null, updates.area as string | null);
setSelectedCity(c); 
window.selectedCity = c;
}
}}
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

disabled={isTyping}
placeholder={!aiRepliesEnabled && !humanMode ? "Skriv ditt svar..." : (humanMode ? "Skriv till support..." : "Skriv ett meddelande...")}
showQuickQuestions={aiRepliesEnabled && !humanMode && messages.length > 1}
selectedVehicle={selectedVehicle}
onVehicleChange={handleVehicleChange}
onCityChange={handleCityChange}
selectedCity={selectedCity}
offices={offices}
humanMode={humanMode}
aiRepliesEnabled={aiRepliesEnabled}
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
