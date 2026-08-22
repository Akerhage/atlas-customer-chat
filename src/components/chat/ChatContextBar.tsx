import type { ReactNode } from "react";
import { ChevronDown, MapPin, Tag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ChatContextChoice {
  label: string;
  value: string;
}

interface ChatContextBarProps {
  unitWord: string;
  categoryWord: string;
  unitLabel?: string | null;
  unitChoices?: ChatContextChoice[];
  onUnitChoice: (value: string) => void;
  categoryLabel?: string | null;
  categoryChoices?: ChatContextChoice[];
  onCategoryChoice: (value: string) => void;
  /** Tredje kontrollen — frågelistan. Skickas in så att listlogiken bor kvar där den redan finns. */
  questionsControl?: ReactNode;
  disabled?: boolean;
}

/**
 * Kundchattens kontrollrad — EN modell på alla boxar (Patriks beslut 2026-08-19).
 *
 * Bakgrund, mätt 2026-08-19 mot alla fem boxar: samma produkt visade fem olika
 * uppsättningar kontroller. Box1 hade en pillerrad som försvann efter första
 * meddelandet, Box4 hade inga piller alls, Box2/Box3 tappade kontorsväljaren helt
 * eftersom de har en enda enhet, och inuti snabbfrågepanelen fanns TVÅ väljare som
 * inte kände till varandra. Patrik: "alla boxar har sin egna lilla värld och logik
 * och det blir ganska svårt för mig att avgöra vad som är bäst."
 *
 * 🔴 Två regler bär hela poängen och ska inte "förenklas" bort:
 *
 * 1. **Raden visas alltid** — genom hela samtalet, inte bara i välkomstläget.
 *    Att kunna ändra sig när som helst är hela skillnaden mot stegen utan utgång.
 * 2. **Väljaren visas även när det bara finns ETT alternativ** (Patriks beslut,
 *    fråga 4). Att dölja den vid singleton var mätt orsak till att boxarna såg
 *    olika ut. En kontroll som försvinner ibland gör modellen obedömbar.
 *
 * Orden kommer från tenantens egna labels när de finns, annars från edition
 * (resolveChatUnitWord / resolveChatCategoryWord) — gissa dem inte här.
 */
export function ChatContextBar({
  unitWord,
  categoryWord,
  unitLabel = null,
  unitChoices = [],
  onUnitChoice,
  categoryLabel = null,
  categoryChoices = [],
  onCategoryChoice,
  questionsControl,
  disabled = false,
}: ChatContextBarProps) {
  return (
    <div
      className="px-3 sm:px-4 py-2 bg-secondary/30 border-t border-border/50"
      data-testid="chat-context-bar"
    >
      {/* KAN-119: raden bröt till två rader i den inbäddade widgeten (380px) — i ALLA
          lägen, även det tomma. Mätt: pillarna behövde 381px mot radens 356px. nowrap
          plus snävare mellanrum i widgetbredd håller dem på en rad; flexbox krymper dem
          via min-w-0 och de har redan title + truncate om texten inte får plats. */}
      <div className="flex flex-nowrap items-center gap-1 min-[440px]:gap-1.5 text-xs">
        <ChatContextSelect
          icon={<MapPin className="w-3 h-3 shrink-0" />}
          word={unitWord}
          selectedLabel={unitLabel}
          choices={unitChoices}
          onChoice={onUnitChoice}
          disabled={disabled}
          testId="chat-context-unit"
        />
        <ChatContextSelect
          icon={<Tag className="w-3 h-3 shrink-0" />}
          word={categoryWord}
          selectedLabel={categoryLabel}
          choices={categoryChoices}
          onChoice={onCategoryChoice}
          disabled={disabled}
          testId="chat-context-category"
        />
        {questionsControl}
      </div>
    </div>
  );
}

interface ChatContextSelectProps {
  icon: ReactNode;
  word: string;
  selectedLabel: string | null;
  choices: ChatContextChoice[];
  onChoice: (value: string) => void;
  disabled: boolean;
  testId: string;
}

function ChatContextSelect({
  icon,
  word,
  selectedLabel,
  choices,
  onChoice,
  disabled,
  testId,
}: ChatContextSelectProps) {
  const hasSelection = Boolean(selectedLabel);
  // Vald post visas med sitt namn; annars uppmaningen. Ordet står i uppmaningen så
  // att kunden ser VAD som ska väljas även innan något är valt.
  const buttonText = selectedLabel || `Välj ${word.toLowerCase()}`;
  // 🔴 Kontrollen renderas ÄVEN utan alternativ (se komponentens regel 2). Den blir
  // då inaktiv i stället för att försvinna, så raden har samma form på alla boxar.
  const isDisabled = disabled || choices.length === 0;

  const trigger = (
    <button
      type="button"
      disabled={isDisabled}
      data-testid={testId}
      title={buttonText}
      className={cn(
        "group flex min-w-0 max-w-[min(11rem,44vw)] items-center gap-0.5 min-[440px]:gap-1 rounded-full border px-1.5 min-[440px]:px-2 py-1 transition-colors",
        hasSelection
          ? "bg-primary/20 text-primary-ink border-primary/55 shadow-sm hover:bg-primary/25"
          : "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80",
        isDisabled && "opacity-50 cursor-not-allowed hover:bg-secondary"
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{buttonText}</span>
      {/* KAN-119: chevronen är det som inte får plats i widgetbredd. Den döljs under
          440px så alla tre pillarna ryms otruncerade på en rad; i den bredare vyn står
          den kvar och signalerar att pillret öppnar en meny. */}
      <ChevronDown className="hidden min-[440px]:block w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
    </button>
  );

  if (isDisabled) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      {/* KAN-117: listan måste kunna scrollas när en tenant har många enheter (Box1: 47).
          ScrollArea gav aldrig scroll här — dess viewport är `h-full` (ui/scroll-area.tsx:11),
          och mot en förälder med enbart `max-height` beräknas `h-full` till `auto`. Innehållet
          växte alltså fritt och roten `overflow-hidden` klippte det. Native max-height +
          overflow-y-auto på själva menyn scrollar, och kollapsar fortfarande för korta listor. */}
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="bg-popover border border-border shadow-lg z-50 max-w-[calc(100vw-2rem)] max-h-64 overflow-y-auto chat-scrollbar"
      >
        <div>
          {choices.map((choice) => (
            <DropdownMenuItem
              key={choice.value}
              onSelect={() => onChoice(choice.value)}
              className={cn(
                "cursor-pointer text-sm",
                choice.label === selectedLabel && "bg-primary/20 text-primary-ink"
              )}
            >
              {choice.label}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
