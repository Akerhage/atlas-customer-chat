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
});
