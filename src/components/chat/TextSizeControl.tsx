import { ALargeSmall } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CHAT_TEXT_SIZE_STEPS,
  type ChatTextSize,
} from "@/lib/chat-text-size";

interface TextSizeControlProps {
  value: ChatTextSize;
  onChange: (value: ChatTextSize) => void;
}

export function TextSizeControl({ value, onChange }: TextSizeControlProps) {
  const current = CHAT_TEXT_SIZE_STEPS.find(step => step.value === value) ?? CHAT_TEXT_SIZE_STEPS[1];

  return (
    <div className="w-fit">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="chat-text-size-control"
            aria-label={`Textstorlek: ${current.label}`}
            title={`Textstorlek: ${current.label}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ALargeSmall className="h-5 w-5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={8}
          className="w-56 border-border bg-popover p-3 text-popover-foreground shadow-xl"
        >
          <p className="mb-2 text-xs font-semibold text-foreground">Textstorlek</p>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="Välj textstorlek">
            {CHAT_TEXT_SIZE_STEPS.map(step => {
              const active = step.value === value;
              return (
                <button
                  key={step.value}
                  type="button"
                  aria-label={`Textstorlek ${step.label}, ${step.value} pixlar`}
                  aria-pressed={active}
                  onClick={() => onChange(step.value)}
                  className={cn(
                    "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55",
                    active
                      ? "border-primary/45 bg-primary/15 text-primary-ink"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span className="font-semibold leading-none" style={{ fontSize: `${step.value}px` }} aria-hidden="true">A</span>
                  <span className="text-[9px] leading-none">{step.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
