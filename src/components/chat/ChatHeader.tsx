import { XCircle, Headset, Moon, Sun } from "lucide-react";
import {
Tooltip,
TooltipContent,
TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContactFormDialog } from "./ContactFormDialog";
import { TemplatesButton } from "./TemplatesButton";
import atlasLogo from "@/assets/atlas-logo.png";
import { resolveTenantAssetUrl, type ActiveVehicle } from "@/lib/atlas-client";
import type { IntakeMode } from "@/lib/intake-machine";

interface ChatHeaderProps {
onEndSession?: () => void;
onRequestHuman: () => void;
isDark: boolean;
onToggleTheme: () => void;
selectedCity?: string | null;
selectedVehicle?: string | null;
generalMode?: boolean;
offices: any[];
onTemplateSelect: (content: string) => void;
companyName?: string | null;
supportDisplayName?: string | null;
companyLogoUrl?: string | null;
activeVehicles: ActiveVehicle[];
subtitle?: string;
templatesTitle?: string;
templatesSubtitle?: string;
subtitleLoading?: boolean;
intakeMode: IntakeMode;
categoryChoices: { label: string; value: string }[];
formLabels: { unit: string; category: string };
// Styrd öppning av mailformuläret (chattens "skicka ett ärende"-länk).
contactFormOpen?: boolean;
onContactFormOpenChange?: (open: boolean) => void;
}

export function ChatHeader({
onEndSession,
onRequestHuman,
isDark,
onToggleTheme,
selectedCity,
selectedVehicle,
generalMode = false,
offices,
onTemplateSelect,
companyName,
supportDisplayName,
companyLogoUrl,
activeVehicles,
subtitle = "Din körkortsguide",
templatesTitle = "Kundinformation",
templatesSubtitle = "Här kan du läsa mer om våra paket, vår policy, våra kurser, utbildningar och erbjudanden — klicka för att visa i chatten",
subtitleLoading = false,
intakeMode,
categoryChoices,
formLabels,
contactFormOpen,
onContactFormOpenChange,
}: ChatHeaderProps) {
const displayName = companyName || "Atlas";
const logoSrc = resolveTenantAssetUrl(companyLogoUrl) || atlasLogo;
return (
<header className="flex items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4 bg-chat-header border-b border-border">
{/* Brand */}
<div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
<div className="relative shrink-0">
<div className="flex h-9 w-[116px] items-center rounded-lg border border-border/70 bg-card/80 px-2 shadow-sm sm:h-10 sm:w-[128px]" data-testid="chat-header-logo">
<img
src={logoSrc}
alt={displayName}
className="max-h-6 w-full object-contain sm:max-h-7"
/>
</div>
{/* Online indicator */}
<div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-chat-header" />
</div>

{/* KAN-121: widgeten är fullbredd under 480px, så 380px-gränsen dolde namnet på
    vanliga 360/375px-telefoner. Prototypmätt på alla fem boxnamn: min-360 +
    break-words gav noll horisontell kapning och 65px header vid 360/375/380px;
    320px behåller logotypen ensam. Tvåraders-clampen ger en riktig ellips när
    längre namn behöver en tredje rad, och title bär alltid hela namnet.
    Underrubriken ligger kvar på 560px: tvingad visning gav 81px header vid
    440/441px och vid 470px med fem åtgärdsknappar, över widgettaket 72px. */}
<div className="hidden min-[360px]:block min-w-0">
<h1 className="line-clamp-2 break-words font-semibold leading-tight text-foreground" title={displayName}>{displayName}</h1>
<p className="hidden min-h-4 min-[560px]:block truncate text-xs text-muted-foreground">{subtitleLoading ? '' : subtitle}</p>
</div>
</div>

{/* Actions */}
<div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
{/* Snabbsvar (KUNDCHATT-mallar) — döljer sig själv om listan är tom */}
<TemplatesButton onSelect={onTemplateSelect} title={templatesTitle} subtitle={templatesSubtitle} />

{/* Skicka meddelande (mail) */}
<ContactFormDialog
selectedCity={selectedCity}
selectedVehicle={selectedVehicle}
generalMode={generalMode}
offices={offices}
supportDisplayName={supportDisplayName}
activeVehicles={activeVehicles}
intakeMode={intakeMode}
categoryChoices={categoryChoices}
formLabels={formLabels}
open={contactFormOpen}
onOpenChange={onContactFormOpenChange}
/>

{/* Prata med människa */}
<Tooltip>
<TooltipTrigger asChild>
<button
onClick={onRequestHuman}
aria-label="Prata med människa"
className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
>
<Headset className="w-5 h-5" />
</button>
</TooltipTrigger>
<TooltipContent>
<p>Prata med människa</p>
</TooltipContent>
</Tooltip>

{/* Tema-växlare */}
{onToggleTheme && (
<Tooltip>
<TooltipTrigger asChild>
<button
onClick={onToggleTheme}
aria-label={isDark ? "Ljust tema" : "Mörkt tema"}
className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
>
{isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
</button>
</TooltipTrigger>
<TooltipContent>
<p>{isDark ? "Ljust tema" : "Mörkt tema"}</p>
</TooltipContent>
</Tooltip>
)}

{/* Avsluta ärende - visas först när ett faktiskt ärende/samtal påbörjats */}
{onEndSession && (
<Tooltip>
<TooltipTrigger asChild>
<button
onClick={onEndSession}
aria-label="Avsluta ärende"
className="p-1.5 sm:p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
>
<XCircle className="w-5 h-5" />
</button>
</TooltipTrigger>
<TooltipContent>
<p>Avsluta ärende</p>
</TooltipContent>
</Tooltip>
)}
</div>
</header>
);
}
