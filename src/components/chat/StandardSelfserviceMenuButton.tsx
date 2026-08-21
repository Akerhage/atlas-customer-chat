import { useState } from "react";
import { ListTodo } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MenuScrollArea } from "./MenuScrollArea";
import { cn } from "@/lib/utils";
import {
  STANDARD_EMPTY_MESSAGE,
  STANDARD_ESCALATE_VALUE,
  menuChoiceValue,
  type StandardSelfserviceMenuItem,
} from "@/lib/standard-selfservice-machine";

interface StandardSelfserviceMenuButtonProps {
  items: StandardSelfserviceMenuItem[];
  categoryLabel?: string | null;
  unitLabel?: string | null;
  unitChoices?: StandardSelfserviceChoice[];
  categoryChoices?: StandardSelfserviceChoice[];
  onChoice: (value: string) => void;
  onUnitChoice?: (value: string) => void;
}

interface StandardSelfserviceChoice {
  label: string;
  value: string;
}

export function StandardSelfserviceMenuButton({
  items,
  categoryLabel,
  unitLabel,
  unitChoices = [],
  categoryChoices = [],
  onChoice,
  onUnitChoice,
}: StandardSelfserviceMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'unit' | 'category'>('menu');
  const contextLabel = [categoryLabel, unitLabel].filter(Boolean).join(" · ");

  const handleMenuChoice = (value: string) => {
    onChoice(value);
    setOpen(false);
  };

  const handleCategoryChoice = (value: string) => {
    onChoice(value);
    setView('menu');
  };

  const handleUnitChoice = (value: string) => {
    onUnitChoice?.(value);
    setView('category');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setView('menu');
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-xl",
            "flex items-center justify-center",
            "transition-all duration-200",
            "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
          title="Snabbfrågor"
          aria-label="Öppna snabbfrågor"
        >
          <ListTodo className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-popover text-popover-foreground border border-border shadow-xl mb-2"
        align="start"
        side="top"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border">
          <p className="text-sm font-medium">Snabbfrågor</p>
          {contextLabel && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={contextLabel}>
              {contextLabel}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-border p-2">
          <button
            type="button"
            onClick={() => setView('unit')}
            className="rounded-md border border-border px-2 py-2 text-left text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Byt avdelning
          </button>
          <button
            type="button"
            onClick={() => setView('category')}
            className="rounded-md border border-border px-2 py-2 text-left text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Byt kategori
          </button>
        </div>

        <MenuScrollArea reservedPanelChrome>
          <div className="p-2">
            {view === 'unit' && unitChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => handleUnitChoice(choice.value)}
                className="w-full rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {choice.label}
              </button>
            ))}
            {view === 'category' && (categoryChoices.length ? categoryChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => handleCategoryChoice(choice.value)}
                className="w-full rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {choice.label}
              </button>
            )) : (
              <p className="px-2 py-4 text-xs leading-relaxed text-muted-foreground">
                {STANDARD_EMPTY_MESSAGE}
              </p>
            ))}
            {view === 'menu' && (
              <>
            {items.length ? items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMenuChoice(menuChoiceValue(item.id))}
                className="w-full rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </button>
            )) : (
              <p className="px-2 py-4 text-xs leading-relaxed text-muted-foreground">
                {STANDARD_EMPTY_MESSAGE}
              </p>
            )}
              </>
            )}
          </div>
        </MenuScrollArea>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => handleMenuChoice(STANDARD_ESCALATE_VALUE)}
            className="w-full rounded-lg bg-primary px-3 py-2 text-left text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Jag behöver mer hjälp – skapa ärende
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
