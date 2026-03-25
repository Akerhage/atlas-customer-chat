import { QuickContextSelector } from "./QuickContextSelector";

interface WelcomeMessageProps {
onQuickAction?: (message: string, context?: { vehicle: string; city: string }) => void;
selectedVehicle: "BIL" | "MC" | "AM" | "LASTBIL" | null;
selectedCity: string | null;
onVehicleChange: (vehicle: "BIL" | "MC" | "AM" | "LASTBIL" | null) => void;
onCityChange: (city: string | null) => void;
offices: any[]; // 🔥 TILLAGD: Krävs för att skicka vidare till selector
}

export function WelcomeMessage({ 
onQuickAction, 
selectedVehicle, 
selectedCity, 
onVehicleChange, 
onCityChange,
offices // 🔥 TILLAGD
}: WelcomeMessageProps) {
return (
<div className="flex flex-col items-center justify-start px-6 pt-4 pb-8 text-center animate-fade-in-up">
{/* Logo */}
<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow mb-5">
<svg
className="w-9 h-9 text-primary-foreground"
fill="none"
viewBox="0 0 24 24"
stroke="currentColor"
strokeWidth={1.5}
>
<path
strokeLinecap="round"
strokeLinejoin="round"
d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
/>
</svg>
</div>

<h2 className="text-lg font-semibold text-foreground mb-2">
Välkommen till Atlas!
</h2>
<p className="text-sm text-muted-foreground mb-6 max-w-[320px]">
Välj fordonstyp och stad nedan för att hitta svar på vanliga frågor, eller skriv din egen fråga.
</p>

{/* Context-based quick selector */}
{onQuickAction && (
<QuickContextSelector 
onSendMessage={onQuickAction}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={onVehicleChange}
onCityChange={onCityChange}
offices={offices} // 🚀 SKICKAS VIDARE HÄR
/>
)}
</div>
);
}