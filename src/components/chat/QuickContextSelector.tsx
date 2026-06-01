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

type VehicleType = "BIL" | "MC" | "AM" | "LASTBIL" | null;

interface QuickContextSelectorProps {
onSendMessage: (message: string, context?: { vehicle: string; city: string }) => void;
selectedVehicle: VehicleType;
selectedCity: string | null;
onVehicleChange: (vehicle: VehicleType) => void;
onCityChange: (city: string | null) => void;
offices: any[];
}

interface QuestionCategory {
category: string;
questions: string[];
}

const VEHICLE_QUESTION_LABELS: Record<"BIL" | "MC" | "AM" | "LASTBIL", string> = {
BIL:     "bilkörkorts",
MC:      "MC-",
AM:      "AM/moped-",
LASTBIL: "lastbils",
};

function getOfficeQuestions(vehicle: "BIL" | "MC" | "AM" | "LASTBIL" | null): QuestionCategory {
const fordonsord = vehicle ? VEHICLE_QUESTION_LABELS[vehicle] : "körkorts";
return {
category: "Om kontoret i {{stad}}",
questions: [
`Vilka ${fordonsord}utbildningar erbjuder ni i {{stad}}?`,
"Var i {{stad}} ligger kontoret och när har ni öppet?",
],
};
}

const QUESTIONS_BY_VEHICLE: Record<"BIL" | "MC" | "AM" | "LASTBIL", QuestionCategory[]> = {
AM: [
{
category: "AM-utbildning",
questions: [
"Hur gammal måste man vara för att börja AM-kursen?",
"Vad kostar AM-kursen och vad ingår i priset?",
"Behöver man körkortstillstånd för AM?",
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
"Vad krävs för att få övningsköra privat?",
"Måste elev och handledare gå handledarkursen samtidigt?",
],
},
{
category: "Paket & Pris",
questions: [
"Vad kostar körkort för bil i {{stad}}?",
"Vad är skillnaden på Baspaket, Mellanpaket och Totalpaket?",
"Kan jag betala mitt körkort med Klarna eller delbetalning?",
],
},
{
category: "Teori & Risk",
questions: [
"Hur fungerar teoriprogrammet 'Mitt Körkort'?",
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
"Vad kostar ett körkort för MC i {{stad}}?",
],
},
{
category: "Utbildning & Paket",
questions: [
"Vad ingår i en intensivvecka för MC?",
"Behöver jag ha egen skyddsutrustning för MC-lektioner?",
"Vad är skillnaden mellan MC-totalpaket och lektionspaket?",
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
"Vad kostar ett C Totalpaket i {{stad}}?",
"Vad kostar en C Körlektion i {{stad}}?",
"Vad kostar ett CE Totalpaket i {{stad}}?",
"Vad kostar en CE Körlektion i {{stad}}?",
"Vad kostar ett C1 Paket i {{stad}}?",
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
"Vad kostar YKB-fortbildning i {{stad}}?",
"Hur många delkurser ingår i YKB-fortbildningen?",
"Vad är skillnaden på YKB grundutbildning och fortbildning?",
],
},
],
};

function getSortedQuestionsForVehicle(
vehicle: "BIL" | "MC" | "AM" | "LASTBIL",
city: string
): QuestionCategory[] {
const categories = QUESTIONS_BY_VEHICLE[vehicle];

const officeCategory: QuestionCategory = {
category: getOfficeQuestions(vehicle).category.replace(/\{\{stad\}\}/g, city),
questions: getOfficeQuestions(vehicle).questions,
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

return [officeCategory, ...categoriesWithSortedQuestions];
}

const VEHICLE_ICONS = {
BIL: Car,
MC: Bike,
AM: CircleDot,
LASTBIL: Truck,
};

const VEHICLE_LABELS = {
BIL: "Bil (B)",
MC: "Motorcykel",
AM: "Moped (AM)",
LASTBIL: "Lastbil / Buss",
};

// Mappar vår fordonskod till etiketten som används i kontorens services_offered.
const VEHICLE_TO_SERVICE_LABEL: Record<"BIL" | "MC" | "AM" | "LASTBIL", string> = {
BIL: "bil",
MC: "mc",
AM: "am",
LASTBIL: "lastbil",
};

// Erbjuder kontoret fordonet? Tom/utelämnad services_offered tolkas permissivt (visa) —
// backend-vakten är skyddsnät, så vi döljer aldrig ett legitimt kontor av misstag.
function officeOffersVehicle(office: any, vehicle: "BIL" | "MC" | "AM" | "LASTBIL"): boolean {
const so = Array.isArray(office?.services_offered)
? office.services_offered.map((s: any) => String(s).toLowerCase().trim())
: [];
if (so.length === 0) return true;
return so.includes(VEHICLE_TO_SERVICE_LABEL[vehicle]);
}

export function QuickContextSelector({
onSendMessage,
selectedVehicle,
selectedCity,
onVehicleChange,
onCityChange,
offices,
}: QuickContextSelectorProps) {

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

// Bidirektionell filtrering: dölj fordon/kontor som inte hör ihop.
// Är ett kontor valt → visa bara fordon kontoret erbjuder.
// Är ett fordon valt → visa bara kontor som erbjuder det fordonet.
const selectedOffice = selectedCity
? offices.find((o) => getOfficeDisplayName(o) === selectedCity)
: null;

const availableVehicles = (["AM", "BIL", "MC", "LASTBIL"] as const).filter(
(type) => !selectedOffice || officeOffersVehicle(selectedOffice, type)
);

const availableOffices = selectedVehicle
? offices.filter((o) => officeOffersVehicle(o, selectedVehicle))
: offices;

const handleQuestionClick = (question: string) => {
if (selectedVehicle && selectedCity) {
const formattedQuestion = question.replace(/\{\{stad\}\}/g, selectedCity);
onSendMessage(formattedQuestion, { vehicle: selectedVehicle, city: selectedCity });
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
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex min-w-0 max-w-[9.5rem] items-center gap-2 px-3 py-2 text-sm rounded-full transition-colors border ${
selectedCity
? "bg-primary text-primary-foreground border-primary"
: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border/50"
}`}
>
<MapPin className="w-4 h-4 shrink-0" />
<span className="min-w-0 truncate">{selectedCity || "Kontor/Stad"}</span>
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

{/* Vehicle Type — väljs efter kontor */}
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex min-w-0 max-w-[9.5rem] items-center gap-2 px-3 py-2 text-sm rounded-full transition-colors border ${
selectedVehicle
? "bg-primary text-primary-foreground border-primary"
: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border/50"
}`}
>
{selectedVehicle ? (
<>
{(() => {
const Icon = VEHICLE_ICONS[selectedVehicle];
return <Icon className="w-4 h-4" />;
})()}
</>
) : (
<Car className="w-4 h-4" />
)}
<span className="min-w-0 truncate">{selectedVehicle ? VEHICLE_LABELS[selectedVehicle] : "Fordonstyp"}</span>
<ChevronDown className="w-3 h-3 shrink-0" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover text-popover-foreground border border-border shadow-lg z-50">
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

{/* Questions - only show if vehicle selected */}
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex min-w-0 max-w-[9.5rem] items-center gap-2 px-3 py-2 text-sm rounded-full transition-colors border ${
selectedVehicle && selectedCity
? "bg-accent text-accent-foreground border-accent hover:bg-accent/80"
: "bg-muted text-muted-foreground border-border/50 cursor-not-allowed opacity-60"
}`}
disabled={!selectedVehicle || !selectedCity}
>
<HelpCircle className="w-4 h-4 shrink-0" />
Välj fråga
<ChevronDown className="w-3 h-3 shrink-0" />
</button>
</DropdownMenuTrigger>
{selectedVehicle && selectedCity && (
<DropdownMenuContent
className="bg-popover border border-border shadow-lg z-50 w-80"
align="center"
>
<ScrollArea className="h-80">
{getSortedQuestionsForVehicle(selectedVehicle, selectedCity).map((cat, catIdx) => (
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
{question.replace(/\{\{stad\}\}/g, selectedCity)}
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
{!selectedCity
? "Välj kontor/stad först"
: !selectedVehicle
? "Välj fordonstyp för relevanta frågor"
: "Välj en fråga eller skriv fritt"}
</p>
{(selectedVehicle || selectedCity) && (
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
