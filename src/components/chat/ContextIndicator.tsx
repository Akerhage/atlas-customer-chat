import { X, ChevronDown, MapPin, Car, Bike, CircleDot, Truck } from "lucide-react";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatContext } from "@/lib/atlas-client";

interface ContextIndicatorProps {
context: ChatContext;
onUpdateContext: (updates: Partial<ChatContext>) => void;
offices: any[]; // 🔥 TILLAGD
}

const VEHICLES = [
{ value: "AM", label: "Moped (AM)", icon: CircleDot },
{ value: "BIL", label: "Bil (B)", icon: Car },
{ value: "MC", label: "Motorcykel", icon: Bike },
{ value: "LASTBIL", label: "Lastbil / Buss", icon: Truck },
];

export function ContextIndicator({ context, onUpdateContext, offices }: ContextIndicatorProps) {
if (!context.city && !context.area && !context.vehicle) {
return null;
}

// 🔥 splitCityArea borttagen helt - den behövs inte längre när vi har office-objekt
const currentVehicle = VEHICLES.find((v) => v.value === context.vehicle);

const locationLabel = context.city
? context.area && !context.city.includes(' – ')
? `${context.city} – ${context.area}`
: context.city
: null;

return (
<div className="px-4 py-2 bg-secondary/30 border-t border-border/50">
<div className="flex items-center gap-2 text-xs text-muted-foreground">
<span className="font-medium">Kontext:</span>

{/* City tag - clickable with dropdown */}
{locationLabel && (
<div className="flex items-center gap-0.5">
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button className="group flex items-center gap-1 px-2 py-1 rounded-l-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
<MapPin className="w-3 h-3" />
<span>{locationLabel}</span>
<ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover border border-border shadow-lg z-50">
<ScrollArea className="h-64">
{offices.map((office) => (
<DropdownMenuItem
key={office.id}
onSelect={() => {
// 🔥 Vi skickar office.name till 'city' så att knapparna i AtlasChat 
// visar det fullständiga namnet (t.ex. "Göteborg – Ullevi")
onUpdateContext({ 
city: office.name, 
area: office.area 
});
}}
className="cursor-pointer text-sm"
>
{office.name}
</DropdownMenuItem>
))}
</ScrollArea>
</DropdownMenuContent>
</DropdownMenu>
<button
onClick={() => onUpdateContext({ city: null, area: null })}
className="p-1 rounded-r-full bg-primary/10 text-primary hover:bg-primary/30 transition-colors"
aria-label="Ta bort stad"
>
<X className="w-3 h-3" />
</button>
</div>
)}

{/* Vehicle tag - clickable with dropdown */}
{context.vehicle && currentVehicle && (
<div className="flex items-center gap-0.5">
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button className="group flex items-center gap-1 px-2 py-1 rounded-l-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
<currentVehicle.icon className="w-3 h-3" />
<span>{currentVehicle.label}</span>
<ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover border border-border shadow-lg z-50">
{VEHICLES.map((vehicle) => {
const VehicleIcon = vehicle.icon;
return (
<DropdownMenuItem
key={vehicle.value}
onSelect={() => onUpdateContext({ vehicle: vehicle.value })}
className="cursor-pointer flex items-center gap-2"
>
<VehicleIcon className="w-4 h-4" />
{vehicle.label}
</DropdownMenuItem>
);
})}
</DropdownMenuContent>
</DropdownMenu>
<button
onClick={() => onUpdateContext({ vehicle: null })}
className="p-1 rounded-r-full bg-accent/10 text-accent hover:bg-accent/30 transition-colors"
aria-label="Ta bort fordon"
>
<X className="w-3 h-3" />
</button>
</div>
)}
</div>
</div>
);
}