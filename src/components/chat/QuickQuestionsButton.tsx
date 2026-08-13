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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
Popover,
PopoverContent,
PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ActiveVehicle } from "@/lib/atlas-client";
import { COMMON_QUESTIONS, type QuestionCategory } from "@/lib/quick-questions-data";
import { STANDARD_UNIT_PREFIX, menuChoiceValue, type StandardSelfserviceMenuItem } from "@/lib/standard-selfservice-machine";
import { CANONICAL_VEHICLE_ORDER, VEHICLE_LABELS, officeOffersVehicle } from "@/lib/vehicle-utils";

type VehicleType = ActiveVehicle | null;

interface QuickQuestionsButtonProps {
onSendMessage: (message: string, context?: { vehicle: string | null; city: string; vehicle_choice?: string | null; clear_vehicle?: boolean }) => void;
onStandardChoice?: (value: string) => void;
onStandardUnitChoice?: (value: string) => void;
selectedVehicle: VehicleType;
selectedCity: string | null;
onVehicleChange: (vehicle: VehicleType) => void;
onGeneralVehicleSelect: () => void;
generalMode: boolean;
onCityChange: (city: string | null) => void;
disabled?: boolean;
offices: any[]; // 🔥 TILLAGD
activeVehicles: ActiveVehicle[];
quickQuestions: string[];
standardSelfserviceMenu?: StandardSelfserviceMenuItem[];
standardUnitLabel?: string | null;
standardUnitChoices?: { label: string; value: string }[];
standardCategoryChoices?: { label: string; value: string }[];
aiRepliesEnabled?: boolean;
industryRagEnabled?: boolean;
}

// Kontorsspecifika frågor. Paket-/utbudsöversikten ligger numera i respektive
// fordonskategori med deterministisk formulering ("Vilka ...paket erbjuder ni i
// {{stad}}?") — den gamla "Vilka X-utbildningar erbjuder ni"-frågan föll till
// LLM-vägen och dumpade kontorsnamn som "innehåll", så den togs bort här.
function getOfficeQuestions(): QuestionCategory {
return {
category: "Om kontoret i {{stad}}",
questions: [
"Var i {{stad}} ligger kontoret och när har ni öppet?",
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
"Måste elev och handledare gå kursen samtidigt?"
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

const TENANT_QUESTION_VEHICLE_PATTERNS: Record<ActiveVehicle, RegExp[]> = {
BIL: [/\bbil(?:en|ar|körkort|korkort|utbildning|lektion|paket)?\b/i, /\bb[-\s]?körkort\b/i],
MC: [/\bmc\b/i, /\bmotorcykel/i, /\ba1\b/i, /\ba2\b/i, /\brisk\s*2\s*för\s*mc\b/i, /\brisktvåan\s+för\s+mc\b/i],
AM: [/\bam\b/i, /\bmoped/i, /\bklass\s*[12]\b/i, /\bförarbevis/i],
LASTBIL: [/\blastbil/i, /\bc1e?\b/i, /\bce\b/i, /\bykb\b/i, /\bbuss\b/i, /\bd[-\s]?körkort\b/i],
SLÄP: [/\bsläp/i, /\bsläpvagn/i, /\bBE\b/, /\bb96\b/i, /\butökat\s+b\b/i],
};

function getQuestionVehicleHints(question: string): ActiveVehicle[] {
return (Object.keys(TENANT_QUESTION_VEHICLE_PATTERNS) as ActiveVehicle[]).filter((vehicle) =>
TENANT_QUESTION_VEHICLE_PATTERNS[vehicle].some((pattern) => pattern.test(question))
);
}

function filterTenantQuickQuestions(questions: string[], allowedVehicles: ActiveVehicle[] | null): string[] {
if (!allowedVehicles || allowedVehicles.length === 0) return questions;
return questions.filter((question) => {
const hints = getQuestionVehicleHints(question);
if (hints.length === 0) return true;
return hints.some((hint) => allowedVehicles.includes(hint));
});
}

interface BuildQuickQuestionCategoriesInput {
selectedCity: string | null;
selectedVehicle: VehicleType;
generalMode: boolean;
selectedOffice: any | null;
availableVehicles: ActiveVehicle[];
quickQuestions: string[];
standardSelfserviceMenu?: StandardSelfserviceMenuItem[];
standardUnitLabel?: string | null;
standardUnitChoices?: { label: string; value: string }[];
standardCategoryChoices?: { label: string; value: string }[];
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
standardUnitLabel = null,
standardUnitChoices = [],
standardCategoryChoices = [],
aiRepliesEnabled = true,
industryRagEnabled = true,
}: BuildQuickQuestionCategoriesInput): QuestionCategory[] {
const selfserviceActions = standardSelfserviceMenu.length
? standardSelfserviceMenu.map(item => ({
label: item.label,
value: menuChoiceValue(item.id),
}))
: standardUnitLabel
? standardCategoryChoices
: standardUnitChoices;
const selfserviceCategory: QuestionCategory | null = selfserviceActions.length
? {
category: "Priser & tjänster",
questions: [],
actions: selfserviceActions,
}
: null;
const tenantQuestionVehicleFilter = generalMode
? null
: selectedVehicle
? [selectedVehicle]
: selectedOffice
? availableVehicles
: null;
const tenantQuickQuestions = filterTenantQuickQuestions(
quickQuestions.map(q => q.trim()).filter(Boolean).slice(0, 20),
tenantQuestionVehicleFilter
);
const tenantCategory: QuestionCategory | null = tenantQuickQuestions.length
? { category: "Vanliga frågor", questions: tenantQuickQuestions }
: null;

// Tenantens egna snabbfrågor kan vara kontors-/fordonsspecifika även om texten
// saknar tydliga tokens. Visa dem först när både plats och fordon är kända.
const canShowTenantQuestions = Boolean(selectedCity && selectedVehicle);
const prefix = selfserviceCategory ? [selfserviceCategory] : [];

if (!aiRepliesEnabled) {
return prefix;
}

// #250: endast explicit false stänger widgetens inbyggda RAG-frågor.
// Tenantens egna snabbfrågor och den deterministiska självservicen är egna
// system och ska därför överleva Branschkunskap AV.
const ragQuestionsEnabled = industryRagEnabled !== false;
if (!ragQuestionsEnabled) {
return canShowTenantQuestions && tenantCategory
? [...prefix, tenantCategory]
: prefix;
}

// Om plats eller fordon saknas, visa bara bevisat generella frågor plus den
// deterministiska självservicesektionen. Den måste byggas före denna retur.
if (!selectedVehicle || !selectedCity) {
return [...prefix, ...COMMON_QUESTIONS];
}

const officeCategory: QuestionCategory = {
category: getOfficeQuestions().category.replace(/\{\{stad\}\}/g, selectedCity),
questions: getOfficeQuestions().questions,
};

const vehicleCategories = QUESTIONS_BY_VEHICLE[selectedVehicle] || [];

// Ordning: självservice -> fordonsfrågor -> tenantens egna -> kontorsfrågor -> generella.
return canShowTenantQuestions && tenantCategory
? [...prefix, ...vehicleCategories, tenantCategory, officeCategory, ...COMMON_QUESTIONS]
: [...prefix, ...vehicleCategories, officeCategory, ...COMMON_QUESTIONS];
}

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

export function QuickQuestionsButton({
onSendMessage,
onStandardChoice,
onStandardUnitChoice,
selectedVehicle,
selectedCity,
onVehicleChange,
onGeneralVehicleSelect,
generalMode,
onCityChange,
disabled = false,
offices, // 🔥 TILLAGD
activeVehicles,
quickQuestions,
standardSelfserviceMenu = [],
standardUnitLabel = null,
standardUnitChoices = [],
standardCategoryChoices = [],
aiRepliesEnabled = true,
industryRagEnabled = true,
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

const handleQuestionClick = (question: string, category: string) => {
// 🧠 SMART LOGIK:
// 1. Kategorier som "Betalning", "Tillstånd" och "Populära" är generella.
//    Dessa skickar vi med vehicle: null för att RAG ska söka i basfakta-filer.
// 2. Fordonsspecifika frågor skickas med vehicle: VALD_FORDON.

const generalCategories = ["Populära frågor", "Betalning & Avbokning", "Tillstånd & Regler"];
const isGeneral = generalMode || generalCategories.includes(category);

// Om generell -> skicka null. Om fordonsspecifik -> skicka vald fordonstyp (om vald).
const vehiclePayload = isGeneral ? null : (effectiveSelectedVehicle as string);

// Byt ut {{stad}} mot vald stad, eller ta bort det om ingen stad är vald
const finalQuestion = effectiveSelectedCity
? question.replace(/\{\{stad\}\}/g, effectiveSelectedCity)
: question.replace(/\{\{stad\}\}/g, "").trim();

// Skicka till ChatInput (som skickar till AtlasChat)
onSendMessage(finalQuestion, {
vehicle: vehiclePayload as any, 
city: effectiveSelectedCity || "",
...(isGeneral ? { vehicle_choice: 'OVRIGT', clear_vehicle: true } : {})
});

setOpen(false);
};

const handleStandardActionClick = (value: string) => {
if (value.startsWith(STANDARD_UNIT_PREFIX) && onStandardUnitChoice) {
onStandardUnitChoice(value);
} else {
onStandardChoice?.(value);
}
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
standardUnitLabel,
standardUnitChoices,
standardCategoryChoices,
aiRepliesEnabled,
industryRagEnabled,
});

return (
<Popover open={open} onOpenChange={handleOpenChange}>
<PopoverTrigger asChild>
<button
disabled={disabled}
className={cn(
"flex-shrink-0 w-9 h-9 rounded-xl",
"flex items-center justify-center",
"transition-all duration-200",
"bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
disabled && "opacity-50 cursor-not-allowed"
)}
title="Snabbfrågor"
>
<ListTodo className="w-4 h-4" />
</button>
</PopoverTrigger>
<PopoverContent className="w-80 p-0 bg-popover text-popover-foreground border border-border shadow-xl mb-2" align="start" side="top" sideOffset={8}>

{/* TOPP: VAL AV STAD & FORDON */}
<div className="p-3 border-b border-border">
<p className="text-sm font-medium mb-2">Snabbfrågor</p>
{(!singletonOffice || !singletonVehicle || singletonVehicle || generalMode) && (
<div className="flex gap-2">
{!singletonOffice && (
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button className={cn("flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors border", effectiveSelectedCity ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary hover:bg-secondary/80")}>
<MapPin className="w-3 h-3" />
<span className="max-w-[80px] truncate">{effectiveSelectedCity || "Välj stad"}</span>
<ChevronDown className="w-3 h-3" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="max-h-60 overflow-y-auto">
{/* 🚀 Dynamisk loop: Renderar kontoren direkt från databasen */}
{availableOffices.map((office) => (
<DropdownMenuItem 
key={office.id} 
onClick={() => onCityChange(getOfficeDisplayName(office))}
className={cn(selectedCity === getOfficeDisplayName(office) && "bg-primary/10")}
>
{getOfficeDisplayName(office)}
</DropdownMenuItem>
))}
</DropdownMenuContent>
</DropdownMenu>
)}

{(
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button className={cn("flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors border", effectiveSelectedVehicle || generalMode ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary hover:bg-secondary/80")}>
{generalMode ? <><HelpCircle className="w-3 h-3" /><span>Övrigt</span></> : effectiveSelectedVehicle ? <><Car className="w-3 h-3" /><span className="max-w-[6.5rem] truncate">{VEHICLE_LABELS[effectiveSelectedVehicle]}</span></> : <><span>Fordon</span></>}
<ChevronDown className="w-3 h-3" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent>
<DropdownMenuItem onClick={onGeneralVehicleSelect} className={cn(generalMode && "bg-primary/10")}>
<span className="inline-flex items-center gap-2"><HelpCircle className="w-3 h-3" />Övrigt / Allmän fråga</span>
</DropdownMenuItem>
<DropdownMenuSeparator />
{availableVehicles.map((type) => (
<DropdownMenuItem key={type} onClick={() => onVehicleChange(type)} className={cn(selectedVehicle === type && "bg-primary/10")}>
{VEHICLE_LABELS[type]}
</DropdownMenuItem>
))}
</DropdownMenuContent>
</DropdownMenu>
)}
</div>
)}
</div>

{/* LISTA MED FRÅGOR */}
<ScrollArea className="h-80">
<div className="p-2">
{questionCategories.map((cat, idx) => (
<div key={cat.category}>
{idx > 0 && <DropdownMenuSeparator className="my-2" />}
<p className="text-[10px] text-muted-foreground font-medium px-2 py-1 uppercase tracking-wide">{cat.category}</p>
{cat.questions.map((q) => (
<button
key={q}
onClick={() => handleQuestionClick(q, cat.category)}
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
onClick={() => handleStandardActionClick(action.value)}
className="w-full text-left px-2 py-2 text-xs rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
>
{action.label}
</button>
))}
</div>
))}
</div>
</ScrollArea>
</PopoverContent>
</Popover>
);
}
