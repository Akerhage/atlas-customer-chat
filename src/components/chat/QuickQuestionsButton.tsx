import { useState } from "react";
import { ListTodo, ChevronDown, MapPin, Car, Bike, CircleDot, Truck } from "lucide-react";
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

type VehicleType = "BIL" | "MC" | "AM" | "LASTBIL" | null;

interface QuickQuestionsButtonProps {
onSendMessage: (message: string, context?: { vehicle: string; city: string }) => void;
selectedVehicle: VehicleType;
selectedCity: string | null;
onVehicleChange: (vehicle: VehicleType) => void;
onCityChange: (city: string | null) => void;
disabled?: boolean;
offices: any[]; // 🔥 TILLAGD
}

interface QuestionCategory {
category: string;
questions: string[];
}

// Fordonsnamn för snabbfrågetext (kortform, läsbar i meningar)
const VEHICLE_QUESTION_LABELS: Record<"BIL" | "MC" | "AM" | "LASTBIL", string> = {
BIL:     "bilkörkorts",
MC:      "MC-",
AM:      "AM/moped-",
LASTBIL: "lastbils",
};

// Kontorsspecifika frågor – anpassas dynamiskt efter valt fordon
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

// 🔥 GENERELLE FRÅGOR (Kategorier som ska nollställa fordon i sökningen)
const COMMON_QUESTIONS: QuestionCategory[] = [
{
category: "Populära frågor",
questions: [
"Vilka betalningsalternativ finns?",
"Hur lång tid tar det att ta körkort för bil?",
],
},
{
category: "Betalning & Avbokning",
questions: [
"Kan jag betala med Klarna eller delbetalning?",
"Vad gäller om jag blir sjuk och måste avboka?",
"När måste jag senast avboka en körlektion?",
"Hur fungerar ångerrätten?",
],
},
{
category: "Tillstånd & Regler",
questions: [
"Hur ansöker jag om körkortstillstånd?",
"Hur länge gäller ett körkortstillstånd?",
"Krävs läkarintyg för att ta körkort?",
"Får man ha passagerare när man övningskör?",
],
},
];

const QUESTIONS_BY_VEHICLE: Record<"BIL" | "MC" | "AM" | "LASTBIL", QuestionCategory[]> = {
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
"Vad krävs för att få övningsköra privat?", 
"Måste elev och handledare gå kursen samtidigt?"
] 
},
{ 
category: "Paket & Intensiv", 
questions: [
"Vad kostar körkort för bil i {{stad}}?", 
"Vad är skillnaden på Baspaket, Mellanpaket och Totalpaket?",
"Hur fungerar en intensivkurs på 2 veckor?", 
"Vad ingår i ett Totalpaket för bil?"
] 
},
{ 
category: "Risk & Teori", 
questions: [
"När ska man göra Riskettan och Risktvåan?", 
"Vad gör man på Halkbanan (Risk 2)?",
"Hur fungerar appen Mitt Körkort?"
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
"Vad ingår i en intensivvecka för MC?", 
"Får jag låna skyddsutrustning och kläder?", 
"Vad är en Startlektion för MC?", 
"Kör ni på bana eller i trafik?"
] 
},
{ 
category: "Risk & Prov MC", 
questions: [
"Vad är Riskettan för MC?", 
"Vad gör man på Risktvåan för MC?",
"Vad ingår i uppkörningen för MC?"
] 
},
],
LASTBIL: [
{
category: "Körkort för Lastbil",
questions: [
"Vad är skillnaden mellan C, C1 och CE-körkort?",
"Vilka krav måste jag uppfylla för att ta C-körkort?",
"Måste jag ha B-körkort innan jag börjar lastbilsutbildningen?",
"Hur lång tid tar lastbilsutbildningen?",
"Vad kostar C-körkort i {{stad}}?",
],
},
{
category: "YKB & Yrkestrafik",
questions: [
"Vad är YKB och behöver jag det?",
"Vad är skillnaden på YKB grundutbildning och fortbildning?",
"Hur många timmar är YKB-fortbildningen och vad kostar den?",
"Hur ofta måste man förnya YKB?",
],
},
{
category: "Bokning & Kontakt",
questions: [
"Hur bokar jag lastbilsutbildning i {{stad}}?",
"Kan jag betala lastbilsutbildningen med Klarna?",
"Erbjuder ni D-körkort (buss) i {{stad}}?",
],
},
],
};

const VEHICLE_ICONS = { BIL: Car, MC: Bike, AM: CircleDot, LASTBIL: Truck };
const VEHICLE_LABELS = { BIL: "Bil", MC: "MC", AM: "Moped", LASTBIL: "Lastbil" };

export function QuickQuestionsButton({
onSendMessage,
selectedVehicle,
selectedCity,
onVehicleChange,
onCityChange,
disabled = false,
offices // 🔥 TILLAGD
}: QuickQuestionsButtonProps) {
const [open, setOpen] = useState(false);

const handleOpenChange = (isOpen: boolean) => {
setOpen(isOpen);
};

const handleQuestionClick = (question: string, category: string) => {
// 🧠 SMART LOGIK:
// 1. Kategorier som "Betalning", "Tillstånd" och "Populära" är generella.
//    Dessa skickar vi med vehicle: null för att RAG ska söka i basfakta-filer.
// 2. Fordonsspecifika frågor skickas med vehicle: VALD_FORDON.

const generalCategories = ["Populära frågor", "Betalning & Avbokning", "Tillstånd & Regler"];
const isGeneral = generalCategories.includes(category);

// Om generell -> skicka null. Om fordonsspecifik -> skicka vald fordonstyp (om vald).
const vehiclePayload = isGeneral ? null : (selectedVehicle as string);

// Byt ut {{stad}} mot vald stad, eller ta bort det om ingen stad är vald
const finalQuestion = selectedCity 
? question.replace(/\{\{stad\}\}/g, selectedCity) 
: question.replace(/\{\{stad\}\}/g, "").trim();

// Skicka till ChatInput (som skickar till AtlasChat)
onSendMessage(finalQuestion, {
vehicle: vehiclePayload as any, 
city: selectedCity || ""
});

setOpen(false);
};

const getQuestions = (): QuestionCategory[] => {
// Om inget är valt, visa bara generella frågor
if (!selectedVehicle || !selectedCity) {
return COMMON_QUESTIONS;
}

const officeCategory: QuestionCategory = {
category: getOfficeQuestions(selectedVehicle).category.replace(/\{\{stad\}\}/g, selectedCity),
questions: getOfficeQuestions(selectedVehicle).questions,
};

const vehicleCategories = QUESTIONS_BY_VEHICLE[selectedVehicle] || [];

// Ordning: Kontorsfrågor -> Fordonsfrågor -> Generella
return [officeCategory, ...vehicleCategories, ...COMMON_QUESTIONS];
};

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
<div className="flex gap-2">
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button className={cn("flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors border", selectedCity ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary hover:bg-secondary/80")}>
<MapPin className="w-3 h-3" />
<span className="max-w-[80px] truncate">{selectedCity || "Välj stad"}</span>
<ChevronDown className="w-3 h-3" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="max-h-60 overflow-y-auto">
{/* 🚀 Dynamisk loop: Renderar kontoren direkt från databasen */}
{offices.map((office) => (
<DropdownMenuItem 
key={office.id} 
onClick={() => onCityChange(office.name)}
className={cn(selectedCity === office.name && "bg-primary/10")}
>
{office.name}
</DropdownMenuItem>
))}
</DropdownMenuContent>
</DropdownMenu>

<DropdownMenu>
<DropdownMenuTrigger asChild>
<button className={cn("flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors border", selectedVehicle ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary hover:bg-secondary/80")}>
{selectedVehicle ? <><Car className="w-3 h-3" /><span>{VEHICLE_LABELS[selectedVehicle]}</span></> : <><span>Fordon</span></>}
<ChevronDown className="w-3 h-3" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent>
{(["BIL", "MC", "AM", "LASTBIL"] as const).map((type) => (
<DropdownMenuItem key={type} onClick={() => onVehicleChange(type)} className={cn(selectedVehicle === type && "bg-primary/10")}>
{VEHICLE_LABELS[type]}
</DropdownMenuItem>
))}
</DropdownMenuContent>
</DropdownMenu>
</div>
</div>

{/* LISTA MED FRÅGOR */}
<ScrollArea className="h-80">
<div className="p-2">
{getQuestions().map((cat, idx) => (
<div key={cat.category}>
{idx > 0 && <DropdownMenuSeparator className="my-2" />}
<p className="text-[10px] text-muted-foreground font-medium px-2 py-1 uppercase tracking-wide">{cat.category}</p>
{cat.questions.map((q) => (
<button
key={q}
onClick={() => handleQuestionClick(q, cat.category)}
className={cn(
"w-full text-left px-2 py-2 text-xs rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
q.includes("{{stad}}") && !selectedCity && "opacity-50 cursor-not-allowed"
)}
>
{selectedCity ? q.replace(/\{\{stad\}\}/g, selectedCity) : q.replace(/\{\{stad\}\}/g, "...")}
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