import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("AtlasChat stale Standard choices", () => {
  it.each([
    "STANDARD_ESCALATE_VALUE",
    "STANDARD_UNIT_PREFIX",
    "STANDARD_CATEGORY_PREFIX",
    "STANDARD_MENU_PREFIX",
  ])("guards %s before the plain message fallback", (constantName) => {
    const helper = sliceBetween(
      "export function isInternalStandardChoiceValue",
      "export function isStaleStandardChoiceSelection",
    );
    const staleGuard = sliceBetween(
      "export function isStaleStandardChoiceSelection",
      "function mapHistoryRole",
    );
    const choiceHandler = sliceBetween(
      "const handleChoiceSelected = (value: string) => {",
      "if (intakeStep === 'office') {",
    );

    expect(helper).toContain(constantName);
    expect(staleGuard).toContain("!standardSelfserviceAvailable");
    expect(staleGuard).toContain("!humanMode");
    expect(staleGuard).toContain("!intakeStep");
    expect(staleGuard).toContain("isInternalStandardChoiceValue(value)");
    expect(choiceHandler.indexOf("isStaleStandardChoiceSelection({"))
      .toBeLessThan(choiceHandler.indexOf("if (!intakeStep) {"));
    expect(choiceHandler).toContain("injectBotMessage(");
    expect(choiceHandler).toContain("[Skapa ett ärende här i chatten](#atlas-human)");
    expect(choiceHandler).not.toContain("handleSendMessage(STANDARD_");
  });

  it("keeps ordinary legacy choices on the plain message fallback", () => {
    const choiceHandler = sliceBetween(
      "const handleChoiceSelected = (value: string) => {",
      "if (intakeStep === 'office') {",
    );
    const fallbackStart = choiceHandler.indexOf("if (!intakeStep) {");
    const fallbackEnd = choiceHandler.indexOf("return;", fallbackStart);
    expect(fallbackStart).toBeGreaterThanOrEqual(0);
    expect(fallbackEnd).toBeGreaterThan(fallbackStart);
    const fallbackBlock = choiceHandler.slice(fallbackStart, fallbackEnd);

    expect(fallbackBlock).toContain("handleSendMessage(value);");
    expect(source).not.toContain("value === 'Göteborg'");
  });
});
