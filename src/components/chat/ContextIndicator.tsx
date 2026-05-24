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

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

export function ContextIndicator({ context, onUpdateContext, offices }: ContextIndicatorProps) {
if (!context.city && !context.area && !context.vehicle) {
return null;
}

// 🔥 splitCityArea borttagen helt - den behövs inte längre när vi har office-objekt
const currentVehicle = VEHICLES.find((v) => v.value === context.vehicle);

const locationLabel = context.city
? context.area && !context.city.includes(' - ')
? `${context.city} - ${context.area}`
: context.city
: null;

return (
<div className="px-3 sm:px-4 py-2 bg-secondary/30 border-t border-border/50">
<div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
<span className="hidden min-[360px]:inline shrink-0 font-medium">Kontext:</span>

{/* City tag - clickable with dropdown */}
{locationLabel && (
<div className="flex min-w-0 items-center gap-0.5">
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className="group flex min-w-0 max-w-[min(12rem,48vw)] items-center gap-1 px-2 py-1 rounded-l-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
title={locationLabel}
>
<MapPin className="w-3 h-3 shrink-0" />
<span className="min-w-0 truncate">{locationLabel}</span>
<ChevronDown className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
</button>
</DropdownMenuTrigger>
<DropdownMenuContent className="bg-popover border border-border shadow-lg z-50 max-w-[calc(100vw-2rem)]">
<ScrollArea className="h-64">
{offices.map((office) => (
<DropdownMenuItem
key={office.id}
onSelect={() => {
onUpdateContext({ 
city: office.city || null,
area: office.area || null
});
}}
className="cursor-pointer text-sm"
>
{getOfficeDisplayName(office)}
</DropdownMenuItem>
))}
</ScrollArea>
</DropdownMenuContent>
</DropdownMenu>
<button
onClick={() => onUpdateContext({ city: null, area: null })}
className="shrink-0 p-1 rounded-r-full bg-primary/10 text-primary hover:bg-primary/30 transition-colors"
aria-label="Ta bort stad"
>
<X className="w-3 h-3" />
</button>
</div>
)}

{/* Vehicle tag - clickable with dropdown */}
{context.vehicle && currentVehicle && (
<div className="flex min-w-0 items-center gap-0.5">
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button
className="group flex min-w-0 max-w-[min(10rem,38vw)] items-center gap-1 px-2 py-1 rounded-l-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
title={currentVehicle.label}
>
<currentVehicle.icon className="w-3 h-3 shrink-0" />
<span className="min-w-0 truncate">{currentVehicle.label}</span>
<ChevronDown className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
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
className="shrink-0 p-1 rounded-r-full bg-accent/10 text-accent hover:bg-accent/30 transition-colors"
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
