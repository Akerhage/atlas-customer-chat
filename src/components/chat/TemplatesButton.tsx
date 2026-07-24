import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getCustomerTemplates, type CustomerTemplate } from "@/lib/atlas-client";

interface TemplatesButtonProps {
  onSelect: (content: string) => void;
  title?: string;
  subtitle?: string;
}

const FALLBACK_GROUP = "Övrigt";

interface TemplateGroup {
  name: string;
  items: CustomerTemplate[];
}

export function TemplatesButton({
  onSelect,
  title = "Vårt utbud",
  subtitle = "Här kan du läsa mer om våra paket, vår policy, våra kurser, utbildningar och erbjudanden — klicka för att visa i chatten",
}: TemplatesButtonProps) {
  const [templates, setTemplates] = useState<CustomerTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getCustomerTemplates().then((data) => {
      if (!alive) return;
      setTemplates(data);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Gruppera efter sub_group, sortera mallar alfabetiskt inom varje grupp.
  // Mallar utan sub_group hamnar i en implicit "Övrigt"-grupp som alltid läggs sist.
  const groups = useMemo<TemplateGroup[]>(() => {
    const map = new Map<string, CustomerTemplate[]>();
    for (const tpl of templates) {
      const key = tpl.sub_group?.trim() || FALLBACK_GROUP;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tpl);
    }

    const named: TemplateGroup[] = [];
    let fallback: TemplateGroup | null = null;

    for (const [name, items] of map.entries()) {
      const sorted = [...items].sort((a, b) =>
        a.title.localeCompare(b.title, "sv")
      );
      if (name === FALLBACK_GROUP) {
        fallback = { name, items: sorted };
      } else {
        named.push({ name, items: sorted });
      }
    }

    named.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    if (fallback) named.push(fallback);
    return named;
  }, [templates]);

  // Dölj ikonen helt om inga mallar finns (eller fetch misslyckades)
  if (!loaded || groups.length === 0) return null;

  const handleClick = (tpl: CustomerTemplate) => {
    onSelect(tpl.content);
    setOpen(false);
  };

  // Two-column grid när det finns fler än två grupper, annars en kolumn
  const useGrid = groups.length > 2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={title}
            >
              <Info className="w-5 h-5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{title}</p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        className="w-96 p-0 bg-popover text-popover-foreground border border-border shadow-xl"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        </div>
        <ScrollArea className="max-h-96 [&>[data-radix-scroll-area-viewport]]:max-h-96">
          <div
            className={cn(
              "p-2",
              useGrid ? "grid grid-cols-2 gap-x-2 gap-y-1" : "flex flex-col"
            )}
          >
            {groups.map((group) => (
              <div key={group.name} className="mb-2 last:mb-0">
                {/* Å-W (§I.5-E): emerald-500 var temablind och mätte 2,45:1 mot
                    panelens nästan vita botten. emerald-600 räcker inte heller
                    (3,64:1) - 700 ger 5,30:1. Mörkt tema är friat (8,58:1). */}
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/20 mb-1">
                  {group.name}
                </div>
                {group.items.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleClick(tpl)}
                    className="w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
