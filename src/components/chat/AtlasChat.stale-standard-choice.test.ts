import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  STANDARD_CATEGORY_PREFIX,
  STANDARD_ESCALATE_VALUE,
  STANDARD_MENU_PREFIX,
  STANDARD_UNIT_PREFIX,
  isInternalStandardChoiceValue,
  resolveStaleStandardChoiceMessage,
} from "@/lib/standard-selfservice-machine";

const source = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// 🔴 KAN-279 rev 2: rev 1:s spec läste bara källtexten och matade aldrig in ett
// värde. Den var grön medan guarden fortfarande läckte i humanMode och under
// intakeStep. Halva den här filen KÖR därför funktionerna på riktiga värden.
// Bara placeringen i komponenten är kvar som källpåstående — repot har varken
// jsdom eller testing-library, så handleChoiceSelected går inte att rendera.

describe("interna Standard-token identifieras", () => {
  it.each([
    STANDARD_ESCALATE_VALUE,
    `${STANDARD_UNIT_PREFIX}ostgatan_huvudkontor`,
    `${STANDARD_CATEGORY_PREFIX}fraktavtal`,
    `${STANDARD_MENU_PREFIX}oppettider`,
  ])("blockerar %s", (value) => {
    expect(isInternalStandardChoiceValue(value)).toBe(true);
  });

  // Positiv kontroll åt andra hållet: guarden får inte svälja riktig kundtext.
  // Trafiks ortsval och legacy-menyernas etiketter ska fortsätta skickas.
  it.each([
    "Göteborg",
    "Huvudkontoret",
    "Centralsupport",
    "Boka Baspaket BIL",
    "Läs mer om Körlektion Bil",
    "standard",
    "",
  ])("släpper igenom %s", (value) => {
    expect(isInternalStandardChoiceValue(value)).toBe(false);
  });
});

describe("meddelandet följer läget, blockeringen gör det aldrig", () => {
  it("humanMode hänvisar till den öppna rutan", () => {
    const text = resolveStaleStandardChoiceMessage({ humanMode: true, intakeStep: null });
    expect(text).toContain("redan kopplad");
    expect(text).not.toContain("#atlas-human");
  });

  it("pågående ärendeintag hänvisar till stegen", () => {
    const text = resolveStaleStandardChoiceMessage({ humanMode: false, intakeStep: "office" });
    expect(text).toContain("skapa ditt ärende");
  });

  it("övriga lägen hänvisar till ärendevägen", () => {
    const text = resolveStaleStandardChoiceMessage({ humanMode: false, intakeStep: null });
    expect(text).toContain("[Skapa ett ärende här i chatten](#atlas-human)");
    expect(text).toContain("headsetikonen");
  });

  it("humanMode vinner över intakeStep", () => {
    const text = resolveStaleStandardChoiceMessage({ humanMode: true, intakeStep: "office" });
    expect(text).toContain("redan kopplad");
  });
});

describe("backstopens placering i handleChoiceSelected", () => {
  const handler = (() => {
    const start = source.indexOf("const handleChoiceSelected = (value: string) => {");
    const end = source.indexOf("const sendEscalationSilently", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
  })();

  // 🔴 Leta på ANROPET, inte på hela villkorsraden. Letar man på den exakta
  // raden blir `guardAt = -1` så fort någon villkorar den, och då kan
  // ovillkorlighetstestet nedan bli grönt av att markören försvann.
  const guardAt = handler.indexOf("isInternalStandardChoiceValue(value)");

  it("ligger före båda läckvägarna", () => {
    expect(guardAt).toBeGreaterThanOrEqual(0);
    // Läckväg 1 (rev 1: nåbar i humanMode).
    expect(guardAt).toBeLessThan(handler.indexOf("handleSendMessage(value, undefined, 'menu');\nreturn;"));
    // Läckväg 2 (rev 1: nåbar under intakeStep === 'office').
    expect(guardAt).toBeLessThan(handler.indexOf("injectUserMessage(value === 'Centralsupport'"));
  });

  it("är OVILLKORAD på läge — annars är KAN-279 öppen igen", () => {
    expect(guardAt).toBeGreaterThanOrEqual(0);
    const lineStart = handler.lastIndexOf("\n", guardAt) + 1;
    const guardLine = handler.slice(lineStart, handler.indexOf("\n", guardAt));
    expect(guardLine).not.toContain("standardSelfserviceAvailable");
    expect(guardLine).not.toContain("humanMode");
    expect(guardLine).not.toContain("intakeStep");
  });

  it("skickar aldrig ett internt token vidare som text", () => {
    expect(handler).not.toContain("handleSendMessage(STANDARD_");
    expect(handler).not.toContain("injectUserMessage(STANDARD_");
  });
});
