import type { ComponentProps } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// KAN-131: båda frågemenyerna ska växa med innehållet upp till samma tak.
// Maxhöjden måste ligga på både Radix-roten och viewporten: då behåller korta
// listor sin innehållshöjd, medan långa listor får en faktisk scrollviewport.
const QUESTION_MENU_SCROLL_CLASS =
  "max-h-[min(20rem,60dvh)] [&>[data-radix-scroll-area-viewport]]:max-h-[min(20rem,60dvh)]";
const QUESTION_MENU_WITH_PANEL_CHROME_SCROLL_CLASS =
  "max-h-[min(20rem,45dvh)] [&>[data-radix-scroll-area-viewport]]:max-h-[min(20rem,45dvh)]";

interface MenuScrollAreaProps extends ComponentProps<typeof ScrollArea> {
  reservedPanelChrome?: boolean;
}

export function MenuScrollArea({ className, reservedPanelChrome = false, ...props }: MenuScrollAreaProps) {
  return (
    <ScrollArea
      // KAN-284: Radix döljer den inbyggda scrollbaren och monterar sin egen först
      // vid hover. Mätt live på Box1 (Ullevi + MC) monterades den aldrig — listan
      // bar 990 px innehåll under vikningen utan någon visuell antydan om att den
      // fortsatte. Med "auto" ritas listen så snart innehållet spiller över, och
      // bara då, så korta menyer ser oförändrade ut.
      type="auto"
      data-testid="question-menu-scroll"
      className={cn(
        reservedPanelChrome ? QUESTION_MENU_WITH_PANEL_CHROME_SCROLL_CLASS : QUESTION_MENU_SCROLL_CLASS,
        className,
      )}
      {...props}
    />
  );
}
