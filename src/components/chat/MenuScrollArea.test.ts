import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const quickSource = readFileSync(new URL("./QuickQuestionsButton.tsx", import.meta.url), "utf8");
const standardSource = readFileSync(new URL("./StandardSelfserviceMenuButton.tsx", import.meta.url), "utf8");

describe("content-fit question menu scroll area", () => {
  it.each([
    ["QuickQuestionsButton", quickSource],
    ["StandardSelfserviceMenuButton", standardSource],
  ])("keeps %s on the shared content-fit scroll primitive", (_name, source) => {
    expect(source).toContain("MenuScrollArea");
    expect(source).not.toMatch(/<ScrollArea className="h-/);
  });

  it("reserves mobile height for the Standard menu header, selectors and footer", () => {
    expect(standardSource).toContain("<MenuScrollArea reservedPanelChrome>");
  });

  // KAN-284: menyn kapade aldrig innehåll, men den visade inte att den fortsatte.
  // Radix döljer den inbyggda scrollbaren och monterar sin egen först vid hover —
  // och på Box1 monterades den aldrig. Mätt live: 990 px innehåll under vikningen
  // utan en enda visuell antydan. "auto" visar listen så fort innehållet spiller
  // över, och bara då, så korta listor ser oförändrade ut.
  it("shows a scrollbar whenever the menu overflows", () => {
    const source = readFileSync(new URL("./MenuScrollArea.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/type="auto"/);
    expect(source).not.toMatch(/type="hover"/);
  });
});
