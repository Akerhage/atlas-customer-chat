import { describe, expect, it } from "vitest";
import { buildCategoryChoices, resolveIntakeMode, resolveWidgetTexts } from "./intake-machine";
import type { EffectiveCategory, TenantProfile } from "./tenant-capabilities";

const standardProfile: TenantProfile = {
  schema_version: 1,
  edition: "standard",
  intake: { mode: "category_first" },
};

describe("resolveIntakeMode", () => {
  it("enables category-first only for the standard category-first profile", () => {
    expect(resolveIntakeMode(standardProfile)).toBe("category_first");
  });

  it.each([
    undefined,
    null,
    { ...standardProfile, edition: "trafikskola" },
    { ...standardProfile, intake: { mode: "legacy" } },
    { ...standardProfile, intake: undefined },
  ])("fails closed to legacy for %j", (profile) => {
    expect(resolveIntakeMode(profile)).toBe("legacy");
  });
});

describe("resolveWidgetTexts", () => {
  it("preserves the exact legacy text contract", () => {
    const texts = resolveWidgetTexts(undefined);
    expect(texts.headerSubtitle).toBe("Din körkortsguide");
    expect(texts.officeQuestion).toBe("Vilket kontor vill du kontakta?");
    expect(texts.seoTitle).toBe("Atlas - Din Körkortsguide");
    expect(texts.seoDescription).toBe("Atlas är din personliga körkortsguide. Få svar på frågor om körkort, priser och hitta rätt trafikskola.");
    expect(texts.welcomeAiOn).toContain("Du kan fråga mig allt som rör ditt körkort och vårt utbud.");
    expect(texts.welcomeAiOff).toContain("Här kan du välja att ställa frågor till vår Centralsupport i Stockholm.");
  });

  it("returns the locked standard texts and interpolated labels", () => {
    const texts = resolveWidgetTexts({
      ...standardProfile,
      labels: { unit: "Avdelning", category: "Ärendetyp" },
    });
    expect(texts).toMatchObject({
      headerSubtitle: "Kundservice",
      officeQuestion: "Vart vill du skicka ditt ärende?",
      formUnitLabel: "Avdelning",
      formCategoryLabel: "Ärendetyp",
      seoTitle: "Atlas - Kundservice",
      seoDescription: "Atlas kundservice – ställ din fråga eller skicka ett ärende till oss.",
    });
    expect(texts.welcomeAiOn).toContain("företagets inlagda fakta om tjänster");
    expect(texts.welcomeAiOff).toContain("skickar ditt ärende till rätt mottagare hos oss");
  });

  it("uses neutral standard label fallbacks and is deterministic without throwing", () => {
    expect(() => resolveWidgetTexts({} as TenantProfile)).not.toThrow();
    const first = resolveWidgetTexts(standardProfile);
    expect(first.formUnitLabel).toBe("Kontor");
    expect(first.formCategoryLabel).toBe("Kategori");
    expect(first).toEqual(resolveWidgetTexts(standardProfile));
  });
});

describe("buildCategoryChoices", () => {
  it("uses active registry labels as plain text and preserves order", () => {
    const categories: EffectiveCategory[] = [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
      { id: "DOLD", label: "Dold", icon: "HIDDEN", active: false },
      { id: "SKRUVAR", label: "Skruvar", icon: "SCREW", active: true },
    ];

    expect(buildCategoryChoices(categories)).toEqual([
      { label: "Muttrar", value: "MUTTRAR", icon: "NUT" },
      { label: "Skruvar", value: "SKRUVAR", icon: "SCREW" },
    ]);
  });

  it.each([undefined, null, []])("returns an empty list for %j", (categories) => {
    expect(buildCategoryChoices(categories)).toEqual([]);
  });

  it("is deterministic and does not mutate its input", () => {
    const categories: EffectiveCategory[] = [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ];
    const snapshot = structuredClone(categories);

    expect(buildCategoryChoices(categories)).toEqual(buildCategoryChoices(categories));
    expect(categories).toEqual(snapshot);
  });
});
