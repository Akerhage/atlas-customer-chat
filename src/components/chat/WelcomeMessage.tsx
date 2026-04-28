import { QuickContextSelector } from "./QuickContextSelector";

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
offices
}: WelcomeMessageProps) {
return (
<div className="flex flex-col items-center justify-start px-6 pt-4 pb-8 text-center animate-fade-in-up">
{/* Logo - Grön i både ljust och mörkt tema */}
<div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-glow mb-6">
<svg
className="w-9 h-9 text-white"
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

<h2 className="text-xl font-semibold text-foreground mb-2">
Välkommen till Atlas!
</h2>
<p className="text-sm text-muted-foreground mb-8 max-w-[340px]">
Välj fordonstyp och stad nedan för att hitta svar på vanliga frågor, eller skriv din egen fråga.
</p>

{/* Quick Context Selector - dina tre knappar */}
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

{/* Informationsruta om AI */}
<div className="w-full max-w-md mt-10 mx-auto">
<div className="rounded-2xl bg-card border border-border p-6 text-sm leading-relaxed text-center shadow-sm">
<p className="text-muted-foreground">
Du pratar just nu med <span className="text-foreground font-medium">Atlas AI</span> som kan hjälpa dig med vanliga frågor.
</p>

<div className="mt-5 pt-4 border-t border-border">
<p className="font-medium text-foreground mb-1.5">
Vill du prata direkt med en människa?
</p>
<p className="text-muted-foreground text-sm">
Skriv <span className="font-medium text-primary">"jag vill prata med en människa"</span> eller klicka på
headset-ikonen <span className="text-primary">uppe till höger</span>.
</p>
</div>
</div>
</div>
</div>
);
}
