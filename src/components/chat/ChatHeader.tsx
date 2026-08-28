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
humanMode: boolean;
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
humanMode,
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
<header className="chat-header-surface flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-5 sm:py-4">
{/* Brand */}
<div className="flex min-w-0 shrink items-center gap-3">
<div className="relative shrink-0" data-testid="chat-header-logo">
<img
src={logoSrc}
alt={displayName}
className="block h-6 w-auto max-w-[116px] object-contain sm:h-7 sm:max-w-[128px]"
/>
{/* Online indicator */}
<div className="absolute -bottom-0.5 -right-3 h-3 w-3 rounded-full border-2 border-chat-header bg-green-500" data-testid="chat-header-online-indicator" />
</div>

{/* KAN-121: widgeten är fullbredd under 480px, så 380px-gränsen dolde namnet på
    vanliga 360/375px-telefoner. Prototypmätt på alla fem boxnamn: min-360 +
    break-words gav noll horisontell kapning och 65px header vid 360/375/380px.
    320px behåller logotypen ensam och döljer själva titeln med display:none,
    så läget inte kan se ut som en oavsiktlig flexkollaps. Tvåraders-clampen
    ger en riktig ellips när längre namn behöver en tredje rad, och title bär alltid hela namnet.
    Underrubriken ligger kvar på 560px: tvingad visning gav 81px header vid
    440/441px och vid 470px med fem åtgärdsknappar, över widgettaket 72px. */}
<div className="hidden min-[360px]:block min-w-0" data-testid="chat-header-tenant-name">
<h1 className="hidden min-[360px]:line-clamp-2 break-words font-semibold leading-tight text-foreground" title={displayName} data-testid="chat-header-tenant-title">{displayName}</h1>
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
{!humanMode && (
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
)}

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
className="rounded-lg p-1.5 text-[hsl(var(--chat-header-danger))] transition-colors hover:bg-red-500/10 hover:text-[hsl(var(--chat-header-danger-hover))] sm:p-2"
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
