import { useState } from "react";
import { ListTodo, ChevronDown, MapPin, Car, Bike, CircleDot, Truck, HelpCircle } from "lucide-react";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
DropdownMenuLabel,
DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MenuScrollArea } from "./MenuScrollArea";
import {
Popover,
PopoverContent,
PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ActiveVehicle, QuickQuestionRecord } from "@/lib/atlas-client";
import { COMMON_QUESTIONS, type QuestionCategory } from "@/lib/quick-questions-data";
import { menuChoiceValue, type StandardSelfserviceMenuItem } from "@/lib/standard-selfservice-machine";
import { CANONICAL_VEHICLE_ORDER, VEHICLE_LABELS, officeOffersVehicle } from "@/lib/vehicle-utils";

type VehicleType = ActiveVehicle | null;

interface QuickQuestionsButtonProps {
onSendMessage: (message: string, context?: { vehicle: string | null; city: string; vehicle_choice?: string | null; clear_vehicle?: boolean }) => void;
onStandardChoice?: (value: string) => void;
selectedVehicle: VehicleType;
selectedCity: string | null;
generalMode: boolean;
disabled?: boolean;
offices: any[]; // 🔥 TILLAGD
activeVehicles: ActiveVehicle[];
quickQuestions: Array<string | QuickQuestionRecord>;
standardSelfserviceMenu?: StandardSelfserviceMenuItem[];
aiRepliesEnabled?: boolean;
industryRagEnabled?: boolean;
/** Ordet för frågekontrollen i kontrollraden. */
triggerLabel?: string;
}

// Kontorsspecifika frågor. Paket-/utbudsöversikten ligger numera i respektive
// fordonskategori med deterministisk formulering ("Vilka ...paket erbjuder ni i
// {{stad}}?") — den gamla "Vilka X-utbildningar erbjuder ni"-frågan föll till
// LLM-vägen och dumpade kontorsnamn som "innehåll", så den togs bort här.
// #538 (Patriks IRL-fynd 2026-09-04): raderna skrev ut enhetsordet i BESTÄMD form
// ("kontoret"), som inte går att bilda för ett godtyckligt tenantord utan att
// gissa genus. Enligt Patriks beslut samma dag är ordet därför borttaget ur
// meningen i stället för böjt — texten fungerar för både "kontor" och
// "avdelning" utan logik.
function getOfficeQuestions(): QuestionCategory {
return {
category: "Om oss i {{stad}}",
questions: [
"Var i {{stad}} finns ni och när har ni öppet?",
],
};
}

const QUESTIONS_BY_VEHICLE: Record<ActiveVehicle, QuestionCategory[]> = {
AM: [{
category: "AM & Mopedutbildning",
questions: [
"Hur gammal måste man vara för att börja AM-kursen?",
"Vad kostar AM-kursen och vad ingår i priset?",
"Måste jag ha körkortstillstånd för moped?",
"Får man övningsköra moped privat?",
"Hur går manöverkörningen till på banan?",
],
}],
BIL: [
{ 
category: "Kom igång med Bil", 
questions: [
"Hur tar man B-körkort steg för steg?", 
"Vad är en Testlektion och hur bokar jag den?", 
"Vad krävs för att få övningsköra bil privat?",
"Behöver elev och handledare gå en kurs?"
] 
},
{ 
category: "Paket & Intensiv", 
questions: [
"Vilka körkortspaket erbjuder ni i {{stad}}?",
"Hur fungerar en intensivkurs på 2 veckor?"
] 
},
{ 
category: "Risk & Teori", 
questions: [
"När ska man göra Riskettan och Risktvåan?", 
"Vad gör man på Halkbanan (Risk 2)?",
"Hur anmäler jag mig som ny elev?"
] 
},
],
MC: [
{ 
category: "MC-Behörigheter", 
questions: [
"Vad är skillnaden mellan A1, A2 och A?", 
"Jag är nybörjare på MC – hur börjar jag?", 
"Kan jag uppgradera A2 till A utan teoriprov?",
"När är MC-säsongen hos er?"
] 
},
{ 
category: "MC-Utbildning",
questions: [
"Vilka MC-paket erbjuder ni i {{stad}}?",
"Vad ingår i en intensivvecka för MC?",
"Får jag låna skyddsutrustning och kläder?", 
"Vad är en Startlektion för MC?", 
"Kör ni på bana eller i trafik?"
] 
},
{ 
category: "Risk & Prov MC", 
questions: [
"Vad är Riskettan och Risktvåan för MC?"
] 
},
],
LASTBIL: [
{
category: "Pris Lastbil i {{stad}}",
questions: [
"Vilka körkortspaket för lastbil erbjuder ni i {{stad}}?",
"Vad kostar en C Körlektion i {{stad}}?",
"Erbjuder ni D-körkort (buss) i {{stad}}?",
],
},
{
category: "Körkort för Lastbil",
questions: [
"Vad är skillnaden mellan C, C1 och CE-körkort?",
"Vilka krav måste jag uppfylla för att ta C-körkort?",
"Måste jag ha B-körkort innan jag börjar lastbilsutbildningen?",
"Hur lång tid tar lastbilsutbildningen?",
],
},
{
category: "YKB & Yrkestrafik",
questions: [
"Vad är YKB och behöver jag det?",
"Vad är skillnaden på YKB grundutbildning och fortbildning?",
"Hur ofta måste man förnya YKB?",
],
},
{
category: "Bokning & Kontakt",
questions: [
"Hur bokar jag lastbilsutbildning i {{stad}}?",
],
},
],
SLÄP: [
{
category: "Släp & BE/B96",
questions: [
"Vad är skillnaden mellan B96 och BE?",
"Vad krävs för att ta BE-körkort?",
"Vad kostar släputbildning i {{stad}}?",
],
},
],
};

const VEHICLE_ICONS = { BIL: Car, MC: Bike, AM: CircleDot, LASTBIL: Truck, SLÄP: Car };

interface NormalizedQuickQuestion {
text: string;
sectionRefBound: boolean;
vehicles: ActiveVehicle[];
scope: "general" | "vehicle";
groupLabel: string;
}

function normalizeQuestionText(value: string): string {
return value.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

function normalizeTenantQuickQuestion(question: string | QuickQuestionRecord): NormalizedQuickQuestion | null {
const text = (typeof question === "string" ? question : question.text).trim();
if (!text) return null;
const vehicles = typeof question === "string" || !Array.isArray(question.vehicles)
? []
: question.vehicles.filter((vehicle, index, arr) => arr.indexOf(vehicle) === index);
return {
text,
sectionRefBound: typeof question !== "string" && Array.isArray(question.section_ref) && question.section_ref.length > 0,
vehicles,
scope: typeof question !== "string" && question.scope === "vehicle" ? "vehicle" : "general",
groupLabel: typeof question !== "string" && question.group_label?.trim()
? question.group_label.trim()
: "Vanliga frågor",
};
}

function groupTenantQuickQuestions(
questions: NormalizedQuickQuestion[],
vehicleContext: ActiveVehicle | null
): QuestionCategory[] {
const grouped = new Map<string, string[]>();
for (const question of questions) {
const values = grouped.get(question.groupLabel) ?? [];
values.push(question.text);
grouped.set(question.groupLabel, values);
}
return Array.from(grouped, ([category, groupedQuestions]) => ({
category,
questions: groupedQuestions,
vehicleContext,
}));
}

export function resolveQuickQuestionContext(
category: QuestionCategory,
generalMode: boolean,
selectedVehicle: VehicleType,
city: string | null
): { vehicle: string | null; city: string; vehicle_choice?: string; clear_vehicle?: boolean } {
const isGeneral = generalMode || category.vehicleContext === null;
const vehicle = isGeneral ? null : (category.vehicleContext ?? selectedVehicle);
return {
vehicle,
city: city || "",
...(isGeneral ? { vehicle_choice: "OVRIGT", clear_vehicle: true } : {}),
};
}

export function listStandardSelfserviceDuplicateQuestions(
categories: QuestionCategory[],
standardSelfserviceMenu: StandardSelfserviceMenuItem[],
selectedCity: string | null
): string[] {
const labels = new Set(standardSelfserviceMenu.map(item => normalizeQuestionText(item.label)));
if (!labels.size) return [];
const duplicates: string[] = [];
for (const category of categories) {
for (const question of category.questions) {
const rendered = selectedCity
? question.replace(/\{\{stad\}\}/g, selectedCity)
: question.replace(/\{\{stad\}\}/g, "").trim();
if (labels.has(normalizeQuestionText(rendered))) duplicates.push(question);
}
}
return duplicates;
}

function filterStandardSelfserviceDuplicates(
categories: QuestionCategory[],
standardSelfserviceMenu: StandardSelfserviceMenuItem[],
selectedCity: string | null
): QuestionCategory[] {
const duplicates = new Set(listStandardSelfserviceDuplicateQuestions(categories, standardSelfserviceMenu, selectedCity));
if (!duplicates.size) return categories;
return categories
.map(category => ({ ...category, questions: category.questions.filter(question => !duplicates.has(question)) }))
.filter(category => category.questions.length || (category.actions?.length || 0) > 0);
}

interface BuildQuickQuestionCategoriesInput {
selectedCity: string | null;
selectedVehicle: VehicleType;
generalMode: boolean;
selectedOffice: any | null;
availableVehicles: ActiveVehicle[];
quickQuestions: Array<string | QuickQuestionRecord>;
standardSelfserviceMenu?: StandardSelfserviceMenuItem[];
aiRepliesEnabled?: boolean;
industryRagEnabled?: boolean;
}

export function buildQuickQuestionCategories({
selectedCity,
selectedVehicle,
generalMode,
selectedOffice,
availableVehicles,
quickQuestions,
standardSelfserviceMenu = [],
aiRepliesEnabled = true,
industryRagEnabled = true,
}: BuildQuickQuestionCategoriesInput): QuestionCategory[] {
// #324/Patriks beslut 2026-08-19: listan är en LISTA, inte en väljare i förklädnad.
//
// Tidigare föll sektionen tillbaka på enhets- respektive kategorivalen när menyn var
// tom, så samma sektion var ibland "här är tjänsterna" och ibland "välj avdelning".
// Det var den ena halvan av de två väljare som inte kände till varandra — mätt på
// sandbox 2026-08-19: ett klick på enhetsraden här nollställde fordonet och raderade
// 5 rubriker / 21 frågor ur listan kunden tittade på, inklusive företagets egna.
//
// 🔴 Enhet och kategori väljs numera ENBART i kontrollraden (ChatContextBar).
// Lägg inte tillbaka dem här.
const selfserviceActions = standardSelfserviceMenu.map(item => ({
label: item.label,
value: menuChoiceValue(item.id),
}));
const selfserviceCategory: QuestionCategory | null = selfserviceActions.length
? {
category: "Priser & tjänster",
questions: [],
actions: selfserviceActions,
}
: null;
const tenantQuickQuestions = quickQuestions
.map(normalizeTenantQuickQuestion)
.filter((question): question is NormalizedQuickQuestion => Boolean(question));
const tenantQuestionsAllowed = aiRepliesEnabled && industryRagEnabled !== false
? tenantQuickQuestions
: tenantQuickQuestions.filter(question => question.sectionRefBound);
const tenantVehicleQuestions = selectedVehicle
? tenantQuestionsAllowed.filter(question => question.scope === "vehicle" && question.vehicles.includes(selectedVehicle))
: [];
const tenantGeneralQuestions = tenantQuestionsAllowed.filter(question => question.scope === "general");
const tenantVehicleCategories = groupTenantQuickQuestions(tenantVehicleQuestions, selectedVehicle);
const tenantGeneralCategories = groupTenantQuickQuestions(tenantGeneralQuestions, null);
const prefix = selfserviceCategory ? [selfserviceCategory] : [];
if (!aiRepliesEnabled || industryRagEnabled === false) {
return [...prefix, ...tenantVehicleCategories, ...tenantGeneralCategories];
}

const officeCategory: QuestionCategory | null = selectedCity ? {
category: getOfficeQuestions().category.replace(/\{\{stad\}\}/g, selectedCity),
questions: getOfficeQuestions().questions,
vehicleContext: selectedVehicle,
} : null;

const vehicleCategories = selectedVehicle
? (QUESTIONS_BY_VEHICLE[selectedVehicle] || []).map(category => ({ ...category, vehicleContext: selectedVehicle }))
: [];
const generalCategories = COMMON_QUESTIONS.map(category => ({ ...category, vehicleContext: null }));

// Fas 5: självservice -> valt kontor -> valt fordons scope -> generellt scope.
// Servern äger scope och gruppetikett för tenantens kurerade frågor; klienten
// härleder inget av detta ur frågetexten.
const categories = [
...prefix,
...(officeCategory ? [officeCategory] : []),
...tenantVehicleCategories,
...vehicleCategories,
...tenantGeneralCategories,
...generalCategories,
];
return filterStandardSelfserviceDuplicates(categories, standardSelfserviceMenu, selectedCity);
}

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

export function QuickQuestionsButton({
onSendMessage,
onStandardChoice,
selectedVehicle,
selectedCity,
generalMode,
disabled = false,
offices, // 🔥 TILLAGD
activeVehicles,
quickQuestions,
standardSelfserviceMenu = [],
aiRepliesEnabled = true,
industryRagEnabled = true,
triggerLabel = "Frågor & tjänster",
}: QuickQuestionsButtonProps) {
const [open, setOpen] = useState(false);
const singletonOffice = offices.length === 1 ? offices[0] : null;
const singletonOfficeLabel = singletonOffice ? getOfficeDisplayName(singletonOffice) : null;
const singletonVehicle = activeVehicles.length === 1 ? activeVehicles[0] : null;
const effectiveSelectedCity = selectedCity || singletonOfficeLabel;
const selectedOffice = effectiveSelectedCity
? offices.find((o) => getOfficeDisplayName(o) === effectiveSelectedCity)
: null;
const rawSelectedVehicle = generalMode ? null : (selectedVehicle || singletonVehicle);
const effectiveSelectedVehicle = rawSelectedVehicle && (Boolean(singletonVehicle) || !selectedOffice || officeOffersVehicle(selectedOffice, rawSelectedVehicle))
? rawSelectedVehicle
: null;
const availableVehicles = CANONICAL_VEHICLE_ORDER
.filter((type) => activeVehicles.includes(type) && (Boolean(singletonVehicle) || !selectedOffice || officeOffersVehicle(selectedOffice, type)));

const availableOffices = effectiveSelectedVehicle && !singletonOffice
? offices.filter((o) => officeOffersVehicle(o, effectiveSelectedVehicle))
: offices;

const handleOpenChange = (isOpen: boolean) => {
setOpen(isOpen);
};

const handleQuestionClick = (question: string, category: QuestionCategory) => {
// Byt ut {{stad}} mot vald stad, eller ta bort det om ingen stad är vald
const finalQuestion = effectiveSelectedCity
? question.replace(/\{\{stad\}\}/g, effectiveSelectedCity)
: question.replace(/\{\{stad\}\}/g, "").trim();

// Skicka till ChatInput (som skickar till AtlasChat)
onSendMessage(finalQuestion, resolveQuickQuestionContext(
category,
generalMode,
effectiveSelectedVehicle,
effectiveSelectedCity
));

setOpen(false);
};

// #324 steg 1 (2026-08-18) höll panelen öppen genom stegen enhet → kategori → frågor,
// eftersom ett steg inte är ett svar. Patriks beslut 2026-08-19 gick ett steg längre:
// stegen ligger inte längre i listan alls utan i kontrollraden ovanför skrivfältet.
// Här återstår bara SLUTVAL — en menyrad eller en eskalering — och de stänger panelen.
const handleStandardActionClick = (value: string) => {
onStandardChoice?.(value);
setOpen(false);
};

const questionCategories = buildQuickQuestionCategories({
selectedCity: effectiveSelectedCity,
selectedVehicle: effectiveSelectedVehicle,
generalMode,
selectedOffice,
availableVehicles,
quickQuestions,
standardSelfserviceMenu,
aiRepliesEnabled,
industryRagEnabled,
});

// 🔴 Enhets- och fordonsväljarna som låg här är BORTTAGNA (Patriks beslut 2026-08-19).
// De bor i ChatContextBar tillsammans med denna knapp, så att kunden ser alla tre
// valen samtidigt och kan ändra sig när som helst. Att ha dem både här och i raden
// vore just den "meny-i-menyn" som var hela invändningen.
const hasContent = questionCategories.length > 0;
const expectedItemCount = questionCategories.reduce(
  (total, category) => total + category.questions.length + (category.actions?.length ?? 0),
  0
);

return (
<Popover open={open} onOpenChange={handleOpenChange}>
<PopoverTrigger asChild>
<button
type="button"
disabled={disabled || !hasContent}
data-testid="chat-context-questions"
title={triggerLabel}
className={cn(
// KAN-119: måtten hålls medvetet identiska med ChatContextSelect i ChatContextBar.tsx —
// de tre pillarna delar en rad och måste krympa likadant i widgetbredd.
"group flex min-w-0 max-w-[min(11rem,44vw)] items-center gap-0.5 min-[440px]:gap-1 rounded-full border px-1.5 min-[440px]:px-2 py-1 text-xs transition-colors",
"bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80",
(disabled || !hasContent) && "opacity-50 cursor-not-allowed hover:bg-secondary"
)}
>
<ListTodo className="w-3 h-3 shrink-0" />
<span className="min-w-0 truncate">{triggerLabel}</span>
{/* KAN-119: döljs under 440px, se ChatContextBar.tsx */}
<ChevronDown className="hidden min-[440px]:block w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
</button>
</PopoverTrigger>
<PopoverContent className="w-80 p-0 bg-popover text-popover-foreground border border-border shadow-xl" align="start" side="top" sideOffset={8}>

{/* LISTA MED FRÅGOR */}
{/* Den delade scrollkomponenten innehållsanpassar korta listor och behåller
    60dvh-taket, Radix-viewporten samt hjul/touch-scroll för långa listor. */}
<MenuScrollArea>
<div className="p-2" data-expected-item-count={expectedItemCount}>
{questionCategories.map((cat, idx) => (
<div key={`${cat.category}-${idx}`}>
{idx > 0 && <DropdownMenuSeparator className="my-2" />}
<p className="text-[10px] text-muted-foreground font-medium px-2 py-1 uppercase tracking-wide">{cat.category}</p>
{cat.questions.map((q) => (
<button
key={q}
data-quick-question-item="question"
onClick={() => handleQuestionClick(q, cat)}
className={cn(
"w-full text-left px-2 py-2 text-xs rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
q.includes("{{stad}}") && !effectiveSelectedCity && "opacity-50 cursor-not-allowed"
)}
>
{effectiveSelectedCity ? q.replace(/\{\{stad\}\}/g, effectiveSelectedCity) : q.replace(/\{\{stad\}\}/g, "...")}
</button>
))}
{(cat.actions ?? []).map((action) => (
<button
key={action.value}
data-quick-question-item="action"
onClick={() => handleStandardActionClick(action.value)}
className="w-full text-left px-2 py-2 text-xs rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
>
{action.label}
</button>
))}
</div>
))}
</div>
</MenuScrollArea>
</PopoverContent>
</Popover>
);
}
