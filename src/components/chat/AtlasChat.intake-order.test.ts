import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const atlasClientSource = readFileSync(new URL("../../lib/atlas-client.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const intakeMachineSource = readFileSync(new URL("../../lib/intake-machine.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function blockHashIn(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return createHash("sha256").update(src.slice(start, end)).digest("hex");
}

function blockHash(startMarker: string, endMarker: string): string {
  return blockHashIn(source, startMarker, endMarker);
}

describe("AtlasChat intake-order contract", () => {
  // K7c (2026-07-26): vakten låg tidigare på AI_OFF_WELCOME_MESSAGE_CONTENT i
  // AtlasChat.tsx. Den ytan var DÖD sedan 44cc0d5 (2026-07-12), som flyttade
  // välkomsttexten till resolveWidgetTexts() — vakten skrevs 32cb32b
  // (2026-07-16), alltså mot en kvarglömd tvilling av den riktiga copyn.
  // Skyddet är däremot verkligt: detta är trafik-editionens (Box1-3)
  // välkomsttext, som inte får glida under Box4-arbete. Vakten är därför
  // FLYTTAD hit, inte struken — och täcker nu hela LEGACY_TEXTS, dvs. även
  // welcomeAiOn som den gamla vakten missade.
  it("keeps the legacy (trafik) widget texts byte-identical", () => {
    expect(blockHashIn(intakeMachineSource, "const LEGACY_TEXTS", "export function resolveWidgetTexts"))
      .toBe("85f7baf0adce2e309ef6407f74f216f4295058fc543f9ccd274d6bc8d567ed34");
  });

  // Vakt över det som FAKTISKT renderas: välkomstbubblan läser widget-texterna,
  // och de döda konstanterna får inte återuppstå som en andra sanning.
  it("renders the welcome message from resolveWidgetTexts, not from local constants", () => {
    expect(source).toContain("const createWelcomeMessage = (aiRepliesEnabled: boolean, texts = resolveWidgetTexts(undefined)): ChatMessage => ({");
    expect(source).toContain("content: aiRepliesEnabled ? texts.welcomeAiOn : texts.welcomeAiOff,");
    expect(source).toContain("setMessages([createWelcomeMessage(aiRepliesEnabled, widgetTexts)]);");
    // G6-8: ingen call site får hårdkoda AI-flaggan tillsammans med widgetTexts.
    expect(source).not.toContain("createWelcomeMessage(false, widgetTexts)");
    expect(source.match(/createWelcomeMessage\(aiRepliesEnabled, widgetTexts\)/g)).toHaveLength(3);
    // Profilbyte skriver om den redan visade välkomstbubblan ur widget-texterna.
    expect(source).toContain("? { ...message, content: aiRepliesEnabled ? widgetTexts.welcomeAiOn : widgetTexts.welcomeAiOff }");
    expect(source).not.toContain("WELCOME_MESSAGE_CONTENT");
    expect(source).not.toContain("getWelcomeMessageContent");
  });

  it("keeps raw company names separate from Atlas display fallback", () => {
    expect(atlasClientSource).toContain("companyNameRaw: string | null;");
    expect(atlasClientSource).toContain("companyNameRaw: null");
    expect(atlasClientSource).toContain("const companyNameRaw =");
    expect(atlasClientSource).toContain("companyNameRaw,");
  });

  it("keeps the slice-24 handoff implementation byte-identical", () => {
    expect(blockHash("const finishIntakeHandoff", "const handleChoiceSelected"))
      .toBe("88318a8e03322d4fcfaa3e85fffa976d62468fe103d57338821b2edbdea9e885");
  });

  it("routes all seven intake starts through the mode-gated starter", () => {
    expect(source.match(/startIntake\('/g)).toHaveLength(7);
    expect(source).toContain("const firstStep = buildIntakeOrder(intakeMode, categoryChoices.length, hasKnownOfficeForIntake())[0];");
    expect(source).toContain("if (firstStep === 'office') {");
  });

  it("uses office-filtered category choices for standard intake paths", () => {
    expect(source).toContain("filterCategoryChoicesForOffice(categoryChoices, office?.categories_offered)");
    expect(source).toContain("const categoryChoicesForOffice = getCategoryChoicesForOfficeLabel(value);");
    expect(source).toContain("injectBotMessage('Vad gäller ärendet?', categoryChoicesForOffice);");
    expect(source).toContain("const choices = getCategoryChoicesForIntake();");
    expect(source).toContain("if (choices.length === 0) {");
  });

  it("keeps empty selfservice category choices escapable instead of buttonless", () => {
    expect(source).toContain("const STANDARD_EMPTY_CATEGORY_MESSAGE =");
    expect(source).toContain("choices: withEscalationValue([])");
    expect(source).toContain("const categoryStep = getStandardCategoryStep(requestedUnitId);");
    expect(source).toContain("if (choices.length > 0) {");
    expect(source).toContain("finishIntakeHandoff({\n...nextIntakeData,\ncity: isCentralSupport ? 'Centralsupport' : getOfficeDisplayName(safeOffice!),\nvehicle: null,\ngeneral: true,");
  });

  it("never tells a standard customer to type while selfservice free text is blocked", () => {
    expect(source).toContain(
      "showCompactStandardMenuFollowup('Okej, ärendet avbröts. Du hittar alternativen i menyn nere vid skrivfältet.');",
    );
    expect(source).not.toContain("Skriv gärna om du har fler frågor!");
    expect(source).toContain(
      "{' '}— {selfserviceFreeTextBlocked ? 'välj ett alternativ' : 'skriv något'} för att hålla den öppen.",
    );
    expect(source).toContain(
      "const selfserviceFreeTextBlocked = standardSelfserviceEnabled && !humanMode && !intakeStep;",
    );
  });

  it("only permits selfservice session recovery outside human mode and intake", () => {
    expect(source).toContain("const humanModeRef = useRef(humanMode);");
    expect(source).toContain("const intakeStepRef = useRef(intakeStep);");
    expect(source).toContain(
      "canRecoverSession: () => !humanModeRef.current && !intakeStepRef.current,",
    );
    expect(source).toContain(
      "injectBotMessage(response.presentation || response.answer || STANDARD_EMPTY_MESSAGE);",
    );
  });

  it("allows standard unit reselection with in-place update before category and reset after", () => {
    expect(source).toContain("const selfserviceUnitMessageIdRef = useRef<string | null>(null);");
    expect(source).toContain("selfserviceStage === 'category' && !selectedCategoryId && !intakeStep");
    expect(source).toContain("message.id === selfserviceUnitMessageIdRef.current");
    expect(source).toContain("requestedUnitId && selfserviceStage !== 'unit'");
    expect(source).toContain("setSelectedCategoryId(null);");
    expect(source).toContain("setIntakeStep(null);");
  });

  // K7/C (Patrik-beslut 2026-07-25): utvägen heter "Vet inte / allmän fråga",
  // ligger SIST och är visuellt skild — men MEKANIKEN är oförändrad.
  it("puts the standard escape-hatch unit last, full width, without touching the office=NULL value", () => {
    const start = source.indexOf("const getStandardUnitChoices");
    const end = source.indexOf("const getCategoryChoicesForOffice", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    // De riktiga enheterna först, utvägen sist.
    expect(block.indexOf("...offices.map")).toBeLessThan(block.indexOf("STANDARD_CENTRAL_SUPPORT_LABEL"));
    // Visuellt skild via bundlens egen fullWidth-markör.
    expect(block).toContain("value: unitChoiceValue(STANDARD_CENTRAL_SUPPORT), fullWidth: true");
    // Kunden ska aldrig läsa det interna ordet i chippet.
    expect(block).not.toContain("label: 'Centralsupport'");
    // MEKANIKVAKT: värdet som ger office = NULL får inte ha bytts.
    expect(block).toContain("unitChoiceValue(STANDARD_CENTRAL_SUPPORT)");
    expect(source).toContain("export");
    // Sentinelen lever kvar där den JÄMFÖRS — etiketten byttes bara i renderingen.
    expect(source).toContain("intakeData.city === 'Centralsupport'");
    expect(source).toContain("selfserviceUnitId === STANDARD_CENTRAL_SUPPORT ? STANDARD_CENTRAL_SUPPORT_LABEL : selfserviceUnitLabel");
  });

  it("reselects a different category from menu without rewriting the preserved category bubble", () => {
    const start = source.indexOf("const isMidIntakeCategoryReselection");
    const end = source.indexOf("if (selfserviceStage === 'unit')", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    expect(block).toContain("selfserviceStage === 'menu' && !intakeStep");
    expect(block).toContain("if (requestedCategoryId === selectedCategoryId) return true;");
    expect(block.indexOf("requestedCategoryId === selectedCategoryId"))
      .toBeLessThan(block.indexOf("loadAndShowStandardMenu"));
    expect(block).toContain("getStandardCategoryChoices(selfserviceUnitId)");
    expect(block).toContain("setSelfserviceMenu([]);");
    expect(block).toContain("setSelectedCategoryId(requestedCategoryId);");
    expect(block).toContain("category_id: requestedCategoryId");
    expect(block).toContain("injectUserMessage(category.label);");
    expect(block).toContain("await loadAndShowStandardMenu(selfserviceUnitId, requestedCategoryId);");
    expect(block).not.toContain("setMessages(");
    expect(block).not.toContain("selfserviceCategoryMessageIdRef");
  });

  it("routes category reselection during intake and resets intake before loading the new menu", () => {
    const start = source.indexOf("const isMidIntakeCategoryReselection");
    const end = source.indexOf("if (selfserviceStage === 'unit')", start);
    const block = source.slice(start, end);
    const routeStart = source.indexOf("if (\nstandardSelfserviceEnabled &&\n!humanMode &&\nintakeStep");
    const routeEnd = source.indexOf("if (!intakeStep)", routeStart);
    const routeBlock = source.slice(routeStart, routeEnd);

    expect(source).toContain("if (intakeStep && !requestedUnitId && !requestedCategoryId) return false;");
    expect(block).toContain("const isMidIntakeCategoryReselection = Boolean(intakeStep && selectedCategoryId);");
    expect(block).toContain("setIntakeStep(null);");
    expect(block).toContain("setIntakeData({});");
    expect(block).toContain("setGeneralMode(false);");
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(routeBlock).toContain("valueAfterPrefix(value, STANDARD_UNIT_PREFIX)");
    expect(routeBlock).toContain("valueAfterPrefix(value, STANDARD_CATEGORY_PREFIX)");
  });

  it("keeps the step set unchanged and does not hydrate response category ids", () => {
    expect(source).toContain("type IntakeStep = 'name' | 'email' | 'phone' | 'office' | 'vehicle' | 'category' | null;");
    expect(source).not.toContain(["response", "locked_context", "category_id"].join("."));
  });

  it("preserves the single outgoing category-id payload line", () => {
    const payloadProperty = ["locked_context", "category_id"].join(".");
    expect(atlasClientSource.split(payloadProperty)).toHaveLength(2);
    expect(atlasClientSource).toContain("if (context.category_id) locked_context" + ".category_id = context.category_id;");
  });
});
