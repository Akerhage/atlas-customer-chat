import atlasLogo from "@/assets/atlas-logo.png";

interface WelcomeMessageProps {
companyName?: string | null;
companyLogoUrl?: string | null;
// 🔴 Enhetsordet löses av ANROPAREN (resolveChatUnitWord) och skickas in redan
// gemenformat för löpande text. Livemätt 2026-09-03: raden nedan hårdkodade
// "kontor" och frågade aldrig resolvern, så sandbox (labels.unit = "Avdelning")
// läste fel ord. Komponenten har ingen tenantprofil och ska varken hämta en
// eller uppfinna en egen upplösning — då blir det två sanningar om samma ord.
unitWord: string;
}

export function WelcomeMessage({
companyName,
unitWord,
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
Välkommen till {displayName}
</h2>
<p className="text-sm text-muted-foreground mb-6 max-w-[340px] leading-relaxed">
Chatta med {displayName}. Vi hjälper dig hitta rätt svar eller rätt {unitWord}.
</p>

{/* 🔴 Den tidigare pillerraden låg HÄR fram till 2026-08-19.
    Den togs bort på Patriks beslut: kontrollraden ovanför skrivfältet bär samma
    val, men genom HELA samtalet. Mätt: denna rad krävde messages.length === 1
    (AtlasChat: showWelcomeWidget) och försvann alltså så fort kunden skickat sitt
    första meddelande — "man får alltid valen" gällde aldrig ens på Box1.

    Den döda komponentfilen och dess hårdkodade frågelista raderades i #356 när
    testsviten flyttades till den levande kontrollraden. */}
</div>
);
}
