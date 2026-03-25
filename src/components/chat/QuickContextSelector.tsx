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

const OFFICE_QUESTIONS: QuestionCategory = {
category: "Om kontoret i {{stad}}",
questions: [
"Vilka körkortsutbildningar erbjuder ni i {{stad}}?",
"Var i {{stad}} ligger kontoret och när har ni öppet?",
],
};

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
category: "Lastbil & Buss",
questions: [
"Vad kostar C-körkort i {{stad}}?",
"Vad är skillnaden mellan C, C1 och CE-körkort?",
"Vilka krav finns för att ta C-körkort?",
"Vad är YKB och behöver jag det?",
"Erbjuder ni lastbilsutbildning i {{stad}}?",
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
category: OFFICE_QUESTIONS.category.replace(/\{\{stad\}\}/g, city),
questions: OFFICE_QUESTIONS.questions,
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

export function QuickContextSelector({
onSendMessage,
selectedVehicle,
selectedCity,
onVehicleChange,
onCityChange,
offices,
}: QuickContextSelectorProps) {

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
<div className="flex flex-col items-center gap-3 px-4 py-2 animate-fade-in-up">
{(selectedVehicle || selectedCity) && (
<div className="flex items-center gap-2 text-xs text-muted-foreground">
{selectedVehicle && (
<span className="px-2 py-1 rounded-full bg-primary/10 text-primary">
{VEHICLE_LABELS[selectedVehicle]}
</span>
)}
{selectedCity && (
<span className="px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
{selectedCity}
</span>
)}
<button
onClick={resetSelection}
className="text-muted-foreground hover:text-foreground underline text-xs"
>
Återställ
</button>
</div>
)}

<div className="flex flex-wrap justify-center gap-2">
{/* Vehicle Type */}
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-colors border ${
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
{selectedVehicle ? VEHICLE_LABELS[selectedVehicle] : "Fordonstyp"}
<ChevronDown className="w-3 h-3" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover text-popover-foreground border border-border shadow-lg z-50">
{(["AM", "BIL", "MC", "LASTBIL"] as const).map((type) => {
const Icon = VEHICLE_ICONS[type];
return (
<DropdownMenuItem
key={type}
onSelect={() => {
console.log('[QuickContextSelector] Vehicle selected:', type);
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

{/* City */}
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-colors border ${
selectedCity
? "bg-primary text-primary-foreground border-primary"
: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border/50"
}`}
>
<MapPin className="w-4 h-4" />
{selectedCity || "Kontor/Stad"}
<ChevronDown className="w-3 h-3" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover border border-border shadow-lg z-50">
<ScrollArea className="h-72">
{offices.map((office) => (
<DropdownMenuItem
key={office.id}
onSelect={() => {
console.log('[QuickContextSelector] City selected:', office.name);
onCityChange(office.name);
}}
className="cursor-pointer"
>
{office.name}
</DropdownMenuItem>
))}
</ScrollArea>
</DropdownMenuContent>
</DropdownMenu>

{/* Questions - only show if vehicle selected */}
{selectedVehicle && (
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-colors border ${
selectedCity
? "bg-accent text-accent-foreground border-accent hover:bg-accent/80"
: "bg-muted text-muted-foreground border-border/50 cursor-not-allowed opacity-60"
}`}
disabled={!selectedCity}
>
<HelpCircle className="w-4 h-4" />
Välj fråga
<ChevronDown className="w-3 h-3" />
</button>
</DropdownMenuTrigger>
{selectedCity && (
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
)}
</div>

{!selectedVehicle && (
<p className="text-xs text-muted-foreground mt-1">
Välj fordonstyp för att se relevanta frågor
</p>
)}
{selectedVehicle && !selectedCity && (
<p className="text-xs text-muted-foreground mt-1">
Välj kontor/stad för att kunna ställa frågor
</p>
)}
</div>
);
}