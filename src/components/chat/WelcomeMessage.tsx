import { QuickContextSelector } from "./QuickContextSelector";
import atlasLogo from "@/assets/atlas-logo.png";
import type { ActiveVehicle } from "@/lib/atlas-client";

interface WelcomeMessageProps {
onQuickAction?: (message: string, context?: { vehicle: string; city: string }) => void;
selectedVehicle: ActiveVehicle | null;
selectedCity: string | null;
onVehicleChange: (vehicle: ActiveVehicle | null) => void;
onCityChange: (city: string | null) => void;
offices: any[];
companyName?: string | null;
activeVehicles: ActiveVehicle[];
quickQuestions: string[];
}

export function WelcomeMessage({
onQuickAction,
selectedVehicle,
selectedCity,
onVehicleChange,
onCityChange,
offices,
companyName,
activeVehicles,
quickQuestions,
}: WelcomeMessageProps) {
const displayName = companyName || "Atlas";
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
Chatta med {displayName}. Vi hjälper dig hitta rätt svar eller rätt kontor.
</p>

{onQuickAction && (
<QuickContextSelector
onSendMessage={onQuickAction}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={onVehicleChange}
onCityChange={onCityChange}
offices={offices}
activeVehicles={activeVehicles}
quickQuestions={quickQuestions}
/>
)}
</div>
);
}
