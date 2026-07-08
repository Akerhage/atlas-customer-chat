import { X, ChevronDown, MapPin, Car, Bike, CircleDot, Truck, HelpCircle } from "lucide-react";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatContext } from "@/lib/atlas-client";
import type { ActiveVehicle } from "@/lib/atlas-client";
import { formatCityAreaLabel } from "@/lib/place-format";
import { CANONICAL_VEHICLE_ORDER, VEHICLE_LABELS, officeOffersVehicle } from "@/lib/vehicle-utils";

interface ContextIndicatorProps {
context: ChatContext;
onUpdateContext: (updates: Partial<ChatContext>) => void;
offices: any[]; // 🔥 TILLAGD
activeVehicles: ActiveVehicle[];
}

const VEHICLE_ICONS: Record<ActiveVehicle, any> = { AM: CircleDot, BIL: Car, MC: Bike, LASTBIL: Truck, SLÄP: Car };

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

const normalizeOfficeValue = (value: any) => String(value || '').trim().toLowerCase();

export function ContextIndicator({ context, onUpdateContext, offices, activeVehicles }: ContextIndicatorProps) {
const isGeneralVehicle = context.vehicle_choice === 'OVRIGT' && !context.vehicle;
if (!context.city && !context.area && !context.vehicle && !isGeneralVehicle) {
return null;
}

const singletonOffice = offices.length === 1;
const singletonVehicle = activeVehicles.length === 1;

const locationLabel = formatCityAreaLabel(context.city, context.area);
const selectedOffice = context.city
? offices.find((office) => {
const cityMatches = normalizeOfficeValue(office?.city) === normalizeOfficeValue(context.city);
const areaMatches = normalizeOfficeValue(office?.area) === normalizeOfficeValue(context.area);
const displayMatches = normalizeOfficeValue(getOfficeDisplayName(office)) === normalizeOfficeValue(locationLabel);
if (context.area) return cityMatches && areaMatches;
return displayMatches || (cityMatches && !normalizeOfficeValue(office?.area));
})
: null;

const availableVehicles = CANONICAL_VEHICLE_ORDER
.filter((vehicle) => activeVehicles.includes(vehicle))
.filter((vehicle) => !selectedOffice || officeOffersVehicle(selectedOffice, vehicle));
const currentVehicle = context.vehicle && availableVehicles.includes(context.vehicle as ActiveVehicle)
? {
value: context.vehicle as ActiveVehicle,
label: VEHICLE_LABELS[context.vehicle as ActiveVehicle],
icon: VEHICLE_ICONS[context.vehicle as ActiveVehicle],
}
: null;

return (
<div className="px-3 sm:px-4 py-2 bg-secondary/30 border-t border-border/50">
<div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
<span className="hidden min-[360px]:inline shrink-0 font-medium">Kontext:</span>

{/* City tag - clickable with dropdown */}
{locationLabel && (
<div className="flex min-w-0 items-center gap-0.5">
{singletonOffice ? (
<div
className="flex min-w-0 max-w-[min(12rem,48vw)] items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary"
title={locationLabel}
>
<MapPin className="w-3 h-3 shrink-0" />
<span className="min-w-0 truncate">{locationLabel}</span>
</div>
) : (
<>
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
const nextVehicle = context.vehicle && !officeOffersVehicle(office, context.vehicle as ActiveVehicle)
? null
: context.vehicle;
onUpdateContext({ 
city: office.city || null,
area: office.area || null,
vehicle: nextVehicle
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
</>
)}
</div>
)}

{/* Vehicle tag - clickable with dropdown */}
{isGeneralVehicle && (
<div className="flex min-w-0 items-center gap-0.5">
<div
className="flex min-w-0 max-w-[min(10rem,38vw)] items-center gap-1 rounded-l-full bg-accent/10 px-2 py-1 text-accent"
title="Övrigt / Allmän fråga"
>
<HelpCircle className="w-3 h-3 shrink-0" />
<span className="min-w-0 truncate">Övrigt</span>
</div>
<button
onClick={() => onUpdateContext({ vehicle: null, vehicle_choice: null, clear_vehicle: false })}
className="shrink-0 p-1 rounded-r-full bg-accent/10 text-accent hover:bg-accent/30 transition-colors"
aria-label="Ta bort Övrigt"
>
<X className="w-3 h-3" />
</button>
</div>
)}

{context.vehicle && currentVehicle && (
<div className="flex min-w-0 items-center gap-0.5">
{singletonVehicle ? (
<div
className="flex min-w-0 max-w-[min(10rem,38vw)] items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-accent"
title={currentVehicle.label}
>
<currentVehicle.icon className="w-3 h-3 shrink-0" />
<span className="min-w-0 truncate">{currentVehicle.label}</span>
</div>
) : (
<>
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
{availableVehicles.map((vehicleValue) => {
const VehicleIcon = VEHICLE_ICONS[vehicleValue];
return (
<DropdownMenuItem
key={vehicleValue}
onSelect={() => onUpdateContext({ vehicle: vehicleValue })}
className="cursor-pointer flex items-center gap-2"
>
<VehicleIcon className="w-4 h-4" />
{VEHICLE_LABELS[vehicleValue]}
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
</>
)}
</div>
)}
</div>
</div>
);
}
