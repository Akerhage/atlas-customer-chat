import { QuickContextSelector } from "./QuickContextSelector";
import atlasLogo from "@/assets/atlas-logo.png";

interface WelcomeMessageProps {
onQuickAction?: (message: string, context?: { vehicle: string; city: string }) => void;
selectedVehicle: "BIL" | "MC" | "AM" | "LASTBIL" | null;
selectedCity: string | null;
onVehicleChange: (vehicle: "BIL" | "MC" | "AM" | "LASTBIL" | null) => void;
onCityChange: (city: string | null) => void;
offices: any[];
}

export function WelcomeMessage({
onQuickAction,
selectedVehicle,
selectedCity,
onVehicleChange,
onCityChange,
offices,
}: WelcomeMessageProps) {
return (
<div className="flex flex-col items-center justify-start px-5 pt-4 pb-7 text-center animate-fade-in-up" data-testid="welcome-message">
{/* Logo */}
<div className="w-16 h-16 rounded-2xl bg-card border border-border/70 flex items-center justify-center shadow-sm mb-5 p-2">
<img
src={atlasLogo}
alt="Atlas"
data-testid="atlas-welcome-brand"
className="h-full w-full object-contain"
/>
</div>

<h2 className="text-xl font-semibold text-foreground mb-2">
Välkommen till Atlas!
</h2>
<p className="text-sm text-muted-foreground mb-6 max-w-[340px] leading-relaxed">
Chatta med My Driving Academy och Mårtenssons Trafikskola. Vi hjälper dig hitta rätt svar eller rätt kontor.
</p>

{onQuickAction && (
<QuickContextSelector
onSendMessage={onQuickAction}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={onVehicleChange}
onCityChange={onCityChange}
offices={offices}
/>
)}
</div>
);
}
