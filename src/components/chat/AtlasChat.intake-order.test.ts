import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const atlasClientSource = readFileSync(new URL("../../lib/atlas-client.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function blockHash(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return createHash("sha256").update(source.slice(start, end)).digest("hex");
}

describe("AtlasChat intake-order contract", () => {
  it("keeps the legacy AI-off welcome constant byte-identical", () => {
    expect(blockHash("const AI_OFF_WELCOME_MESSAGE_CONTENT", "const getWelcomeMessageContent"))
      .toBe("fcf77376033ab2a4f4c9ab2d762c589440034b371c1255b5e68ab56634e7bde8");
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

  it("allows standard unit reselection with in-place update before category and reset after", () => {
    expect(source).toContain("const selfserviceUnitMessageIdRef = useRef<string | null>(null);");
    expect(source).toContain("selfserviceStage === 'category' && !selectedCategoryId && !intakeStep");
    expect(source).toContain("message.id === selfserviceUnitMessageIdRef.current");
    expect(source).toContain("requestedUnitId && selfserviceStage !== 'unit'");
    expect(source).toContain("setSelectedCategoryId(null);");
    expect(source).toContain("setIntakeStep(null);");
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
