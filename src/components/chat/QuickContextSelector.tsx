import { useState } from "react";
import { ChevronDown, Car, Bike, MapPin, HelpCircle, CircleDot, Truck } from "lucide-react";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
DropdownMenuLabel,
DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActiveVehicle } from "@/lib/atlas-client";


type VehicleType = ActiveVehicle | null;

interface QuickContextSelectorProps {
onSendMessage: (message: string, context?: { vehicle: string | null; city: string; vehicle_choice?: string | null; clear_vehicle?: boolean }) => void;
selectedVehicle: VehicleType;
selectedCity: string | null;
onVehicleChange: (vehicle: VehicleType) => void;
onGeneralVehicleSelect: () => void;
generalMode: boolean;
onCityChange: (city: string | null) => void;
offices: any[];
activeVehicles: ActiveVehicle[];
quickQuestions: string[];
}

interface QuestionCategory {
category: string;
questions: string[];
}

// Paket-/utbudsöversikten ligger numera i respektive fordonskategori med
// deterministisk formulering ("Vilka ...paket erbjuder ni i {{stad}}?"). Den
// gamla "Vilka X-utbildningar erbjuder ni"-frågan föll till LLM-vägen och
// dumpade kontorsnamn som "innehåll", så den togs bort här.
function getOfficeQuestions(): QuestionCategory {
return {
category: "Om kontoret i {{stad}}",
questions: [
"Var i {{stad}} ligger kontoret och när har ni öppet?",
],
};
}

const QUESTIONS_BY_VEHICLE: Record<ActiveVehicle, QuestionCategory[]> = {
AM: [
{
category: "AM-utbildning",
questions: [
"Hur gammal måste man vara för att börja AM-kursen?",
"Vad kostar AM-kursen och vad ingår i priset?",
"Får man övningsköra moped privat hemma?",
"Hur fungerar teoriprovet och uppkörningen för moped?",
],
},
],
BIL: [
{
category: "Kom igång med Bil",
questions: [
"Hur tar man körkort för bil – steg för steg?",
"Vad är en Testlektion och hur bokar jag den?",
"Vad krävs för att få övningsköra bil privat?",
"Måste elev och handledare gå handledarkursen samtidigt?",
],
},
{
category: "Paket & Pris",
questions: [
"Vilka körkortspaket erbjuder ni i {{stad}}?",
],
},
{
category: "Teori & Risk",
questions: [
"Hur anmäler jag mig som ny elev?",
"Vad är Riskettan och Risktvåan (halkbanan)?",
"I vilken ordning ska jag göra riskutbildningarna?",
],
},
],
MC: [
{
category: "Behörigheter & Start",
questions: [
"Vad är skillnaden mellan A1, A2 och A-behörighet?",
"Jag är nybörjare på MC – hur börjar jag?",
"Vilka MC-paket erbjuder ni i {{stad}}?",
],
},
{
category: "Utbildning & Paket",
questions: [
"Vad ingår i en intensivvecka för MC?",
"Behöver jag ha egen skyddsutrustning för MC-lektioner?",
"Var sker MC-manöverkörning i {{stad}}?",
],
},
{
category: "Risk & Prov",
questions: [
"Vad är Riskettan och Risktvåan för MC?",
"Hur går MC-körprovet till hos Trafikverket?",
"När startar och slutar MC-säsongen hos er?",
],
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
category: "Lastbil & Buss",
questions: [
"Vad är skillnaden mellan C, C1 och CE-körkort?",
"Vilka krav finns för att ta C-körkort?",
"Måste jag ha B-körkort innan jag börjar lastbilsutbildningen?",
"Hur lång tid tar lastbilsutbildningen?",
],
},
{
category: "YKB & Fortbildning",
questions: [
"Hur många delkurser ingår i YKB-fortbildningen?",
"Vad är skillnaden på YKB grundutbildning och fortbildning?",
],
},
],
SLÄP: [
{
category: "Släp & BE/B96",
questions: [
"Vad kostar släputbildning i {{stad}}?",
],
},
],
};

function getSortedQuestionsForVehicle(
vehicle: ActiveVehicle | null,
city: string,
quickQuestions: string[]
): QuestionCategory[] {
const categories = vehicle ? (QUESTIONS_BY_VEHICLE[vehicle] || []) : [];

const officeCategory: QuestionCategory = {
category: getOfficeQuestions().category.replace(/\{\{stad\}\}/g, city),
questions: getOfficeQuestions().questions,
};

const sortedCategories = [...categories].sort((a, b) => {
const aHasCity = a.questions.some(q => q.includes("{{stad}}"));
const bHasCity = b.questions.some(q => q.includes("{{stad}}"));
if (aHasCity && !bHasCity) return -1;
if (!aHasCity && bHasCity) return 1;
return 0;
});

const categoriesWithSortedQuestions = sortedCategories.map(cat => ({
...cat,
questions: [...cat.questions].sort((a, b) => {
const aHasCity = a.includes("{{stad}}");
const bHasCity = b.includes("{{stad}}");
if (aHasCity && !bHasCity) return -1;
if (!aHasCity && bHasCity) return 1;
return 0;
}),
}));

const tenantQuickQuestions = quickQuestions.map(q => q.trim()).filter(Boolean).slice(0, 20);
if (tenantQuickQuestions.length > 0) {
return [
{ category: "Vanliga frågor", questions: tenantQuickQuestions },
officeCategory,
...categoriesWithSortedQuestions,
];
}

return [officeCategory, ...categoriesWithSortedQuestions];
}

const VEHICLE_ICONS = {
BIL: Car,
MC: Bike,
AM: CircleDot,
LASTBIL: Truck,
SLÄP: Car,
};

const VEHICLE_LABELS = {
BIL: "Bil (B)",
MC: "Motorcykel",
AM: "Moped (AM)",
LASTBIL: "Lastbil / Buss",
SLÄP: "Släp (BE/B96)",
};

// Mappar vår fordonskod till etiketten som används i kontorens services_offered.
const VEHICLE_TO_SERVICE_LABEL: Record<ActiveVehicle, string> = {
BIL: "bil",
MC: "mc",
AM: "am",
LASTBIL: "lastbil",
SLÄP: "släp",
};

// Erbjuder kontoret fordonet? Tom/utelämnad services_offered tolkas permissivt (visa) —
// backend-vakten är skyddsnät, så vi döljer aldrig ett legitimt kontor av misstag.
// Matchar på fordonstoken som exakt sträng ELLER som hela ord i en längre service-sträng,
// t.ex. "BIL" i ["BIL"] och "bil" i ["B automat bil"] matchar båda "bil"-token.
function officeOffersVehicle(office: any, vehicle: ActiveVehicle): boolean {
const so = Array.isArray(office?.services_offered)
? office.services_offered.map((s: any) => String(s).toLowerCase().trim())
: [];
if (so.length === 0) return true;
const token = VEHICLE_TO_SERVICE_LABEL[vehicle];
const re = new RegExp(`(^|[\\s\\-/])${token}($|[\\s\\-/])`, 'i');
return so.some(s => s === token || re.test(s));
}

export function QuickContextSelector({
onSendMessage,
selectedVehicle,
selectedCity,
onVehicleChange,
onGeneralVehicleSelect,
generalMode,
onCityChange,
offices,
activeVehicles,
quickQuestions,
}: QuickContextSelectorProps) {

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

const singletonOffice = offices.length === 1 ? offices[0] : null;
const singletonOfficeLabel = singletonOffice ? getOfficeDisplayName(singletonOffice) : null;
const singletonVehicle = activeVehicles.length === 1 ? activeVehicles[0] : null;
const effectiveSelectedCity = selectedCity || singletonOfficeLabel;
const effectiveSelectedVehicle = generalMode ? null : (selectedVehicle || singletonVehicle);

// Bidirektionell filtrering: dölj fordon/kontor som inte hör ihop.
// Är ett kontor valt → visa bara fordon kontoret erbjuder.
// Är ett fordon valt → visa bara kontor som erbjuder det fordonet.
const selectedOffice = effectiveSelectedCity
? offices.find((o) => getOfficeDisplayName(o) === effectiveSelectedCity)
: null;

const availableVehicles = (["AM", "BIL", "MC", "LASTBIL", "SLÄP"] as ActiveVehicle[]).filter(
(type) => activeVehicles.includes(type) && (Boolean(singletonVehicle) || !selectedOffice || officeOffersVehicle(selectedOffice, type))
);

const availableOffices = effectiveSelectedVehicle && !singletonOffice
? offices.filter((o) => officeOffersVehicle(o, effectiveSelectedVehicle))
: offices;

const handleQuestionClick = (question: string) => {
if ((effectiveSelectedVehicle || generalMode) && effectiveSelectedCity) {
const formattedQuestion = question.replace(/\{\{stad\}\}/g, effectiveSelectedCity);
onSendMessage(formattedQuestion, generalMode
? { vehicle: null, city: effectiveSelectedCity, vehicle_choice: 'OVRIGT', clear_vehicle: true }
: { vehicle: effectiveSelectedVehicle, city: effectiveSelectedCity });
}
};

const resetSelection = () => {
onVehicleChange(null);
onCityChange(null);
};

return (
<div className="flex flex-col items-center gap-2 px-2 py-1 animate-fade-in-up" data-testid="quick-context-selector">
<div className="flex min-h-[84px] w-full flex-wrap items-start justify-center gap-2">
{/* City — väljs först */}
{!singletonOffice && (
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex min-w-0 max-w-[9.5rem] items-center gap-2 px-3 py-2 text-sm rounded-full transition-colors border ${
effectiveSelectedCity
? "bg-primary text-primary-foreground border-primary"
: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border/50"
}`}
>
<MapPin className="w-4 h-4 shrink-0" />
<span className="min-w-0 truncate">{effectiveSelectedCity || "Kontor/Stad"}</span>
<ChevronDown className="w-3 h-3 shrink-0" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover border border-border shadow-lg z-50 max-h-72 overflow-y-auto chat-scrollbar">
{availableOffices.map((office) => (
<DropdownMenuItem
key={office.id}
onSelect={() => {
onCityChange(getOfficeDisplayName(office));
}}
className="cursor-pointer"
>
{getOfficeDisplayName(office)}
</DropdownMenuItem>
))}
</DropdownMenuContent>
</DropdownMenu>
)}

{/* Vehicle Type — väljs efter kontor */}
{(
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex min-w-0 max-w-[9.5rem] items-center gap-2 px-3 py-2 text-sm rounded-full transition-colors border ${
effectiveSelectedVehicle || generalMode
? "bg-primary text-primary-foreground border-primary"
: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border/50"
}`}
>
{generalMode ? (
<HelpCircle className="w-4 h-4" />
) : effectiveSelectedVehicle ? (
<>
{(() => {
const Icon = VEHICLE_ICONS[effectiveSelectedVehicle];
return <Icon className="w-4 h-4" />;
})()}
</>
) : (
<Car className="w-4 h-4" />
)}
<span className="min-w-0 truncate">{generalMode ? "Övrigt" : (effectiveSelectedVehicle ? VEHICLE_LABELS[effectiveSelectedVehicle] : "Fordonstyp")}</span>
<ChevronDown className="w-3 h-3 shrink-0" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover text-popover-foreground border border-border shadow-lg z-50">
<DropdownMenuItem
onSelect={onGeneralVehicleSelect}
className="flex items-center gap-2 cursor-pointer"
>
<HelpCircle className="w-4 h-4" />
Övrigt / Allmän fråga
</DropdownMenuItem>
<DropdownMenuSeparator />
{availableVehicles.map((type) => {
const Icon = VEHICLE_ICONS[type];
return (
<DropdownMenuItem
key={type}
onSelect={() => {
onVehicleChange(type);
}}
className="flex items-center gap-2 cursor-pointer"
>
<Icon className="w-4 h-4" />
{VEHICLE_LABELS[type]}
</DropdownMenuItem>
);
})}
</DropdownMenuContent>
</DropdownMenu>
)}

{/* Questions - only show if vehicle selected */}
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex min-w-0 max-w-[9.5rem] items-center gap-2 px-3 py-2 text-sm rounded-full transition-colors border ${
(effectiveSelectedVehicle || generalMode) && effectiveSelectedCity
? "bg-accent text-accent-foreground border-accent hover:bg-accent/80"
: "bg-muted text-muted-foreground border-border/50 cursor-not-allowed opacity-60"
}`}
disabled={!(effectiveSelectedVehicle || generalMode) || !effectiveSelectedCity}
>
<HelpCircle className="w-4 h-4 shrink-0" />
Välj fråga
<ChevronDown className="w-3 h-3 shrink-0" />
</button>
</DropdownMenuTrigger>
{(effectiveSelectedVehicle || generalMode) && effectiveSelectedCity && (
<DropdownMenuContent
className="bg-popover border border-border shadow-lg z-50 w-80"
align="center"
>
<ScrollArea className="h-80">
{getSortedQuestionsForVehicle(generalMode ? null : effectiveSelectedVehicle, effectiveSelectedCity, quickQuestions).map((cat, catIdx) => (
<div key={cat.category}>
{catIdx > 0 && <DropdownMenuSeparator />}
<DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
{cat.category}
</DropdownMenuLabel>
{cat.questions.map((question, idx) => (
<DropdownMenuItem
key={idx}
onClick={() => handleQuestionClick(question)}
className="cursor-pointer text-sm py-2 whitespace-normal"
>
{question.replace(/\{\{stad\}\}/g, effectiveSelectedCity)}
</DropdownMenuItem>
))}
</div>
))}
</ScrollArea>
</DropdownMenuContent>
)}
</DropdownMenu>
</div>

<div className="flex min-h-5 items-center justify-center gap-2 text-xs text-muted-foreground">
<p>
{!effectiveSelectedCity
? "Välj kontor/stad först"
: !effectiveSelectedVehicle
? generalMode ? "Övrigt valt – skriv eller välj en allmän fråga" : "Välj fordonstyp eller Övrigt"
: "Välj en fråga eller skriv fritt"}
</p>
{(selectedVehicle || selectedCity || generalMode) && (!singletonOffice || !singletonVehicle || generalMode) && (
<button
onClick={resetSelection}
className="shrink-0 text-muted-foreground hover:text-foreground underline text-xs"
>
Återställ
</button>
)}
</div>
</div>
);
}
