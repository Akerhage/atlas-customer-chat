import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Repot har varken jsdom eller testing-library, så knappen kan inte renderas i test. Beteendet bärs av de rena
// funktionerna i intake-machine.test.ts; här binds kopplingen i komponenten: varje valfritt kontaktsteg ska ERBJUDA
// knappen, och klicket får bara verka när kundens aktuella steg är det steg knappen hör till.
const source = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("intake: Hoppa över-knapp på valfria kontaktsteg", () => {
  it("erbjuder knappen i alla fyra e-post/mobil-frågor", () => {
    const emailPrompts = source.split("\n").filter((line) => line.includes("e-postadress") && line.includes("injectBotMessage("));
    const phonePrompts = source.split("\n").filter((line) => line.includes("mobilnummer") && line.includes("injectBotMessage("));
    expect(emailPrompts).toHaveLength(2);
    expect(phonePrompts).toHaveLength(2);
    for (const line of emailPrompts) expect(line).toContain("buildIntakeSkipChoices('email')");
    for (const line of phonePrompts) expect(line).toContain("buildIntakeSkipChoices('phone')");
  });

  it("kunden behöver inte längre uppmanas skriva nej eller hoppa över", () => {
    const promptLines = source.split("\n").filter((line) => line.includes("injectBotMessage(") && (line.includes("e-postadress") || line.includes("mobilnummer")));
    for (const line of promptLines) {
      expect(line).not.toMatch(/\*\*"nej"\*\*/);
      expect(line).toContain("Hoppa över");
    }
  });

  it("klicket routas som att skriva hoppa över, men bara i rätt steg", () => {
    const start = source.indexOf("const skipStep = resolveIntakeSkipChoice(value);");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 260);
    expect(block).toContain("if (intakeStep === skipStep) handleIntakeInput('Hoppa över');");
    expect(block).toContain("return;");
    // Grenen ska ligga FÖRE standardgrenarna och backstoppen, annars kan värdet nå handleSendMessage.
    expect(start).toBeLessThan(source.indexOf("void handleStandardChoice(value).then("));
    expect(start).toBeLessThan(source.indexOf("isInternalStandardChoiceValue(value)"));
  });
});
