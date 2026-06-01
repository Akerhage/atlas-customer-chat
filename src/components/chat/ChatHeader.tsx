import { XCircle, Headset, Moon, Sun } from "lucide-react";
import {
Tooltip,
TooltipContent,
TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContactFormDialog } from "./ContactFormDialog";
import { TemplatesButton } from "./TemplatesButton";
import type { ActiveVehicle } from "@/lib/atlas-client";

interface ChatHeaderProps {
onEndSession?: () => void;
onRequestHuman: () => void;
isDark: boolean;
onToggleTheme: () => void;
selectedCity?: string | null;
selectedVehicle?: string | null;
offices: any[];
onTemplateSelect: (content: string) => void;
companyName?: string | null;
activeVehicles: ActiveVehicle[];
}

export function ChatHeader({
onEndSession,
onRequestHuman,
isDark,
onToggleTheme,
selectedCity,
selectedVehicle,
offices,
onTemplateSelect,
companyName,
activeVehicles,
}: ChatHeaderProps) {
const displayName = companyName || "Atlas";
return (
<header className="flex items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4 bg-chat-header border-b border-border">
{/* Brand */}
<div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
<div className="relative shrink-0">
<div className="flex h-9 items-center rounded-lg border border-border/70 bg-card/80 px-3 shadow-sm sm:h-10" data-testid="chat-header-logo">
<span className="text-sm font-semibold text-foreground whitespace-nowrap">{displayName}</span>
</div>
{/* Online indicator */}
<div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-chat-header" />
</div>

<div className="hidden min-[440px]:block min-w-0">
<h1 className="font-semibold leading-tight text-foreground">Atlas</h1>
<p className="hidden min-[360px]:block text-xs text-muted-foreground">Din körkortsguide</p>
</div>
</div>

{/* Actions */}
<div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
{/* Snabbsvar (KUNDCHATT-mallar) — döljer sig själv om listan är tom */}
<TemplatesButton onSelect={onTemplateSelect} />

{/* Skicka meddelande (mail) */}
<ContactFormDialog
selectedCity={selectedCity}
selectedVehicle={selectedVehicle}
offices={offices}
activeVehicles={activeVehicles}
/>

{/* Prata med människa */}
<Tooltip>
<TooltipTrigger asChild>
<button
onClick={onRequestHuman}
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
