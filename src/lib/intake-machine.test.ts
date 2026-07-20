import { describe, expect, it } from "vitest";
import { buildCategoryChoices, buildIntakeOrder, filterCategoryChoicesForOffice, resolveIntakeMode, resolveOptionalPhone, resolveWidgetTexts } from "./intake-machine";
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
    const legacyNameLead = "Vi börjar med ditt " + "namn.";
    expect(texts.headerSubtitle).toBe("Din körkortsguide");
    expect(texts.templatesTitle).toBe("Vårt utbud");
    expect(texts.templatesSubtitle).toBe("Här kan du läsa mer om våra paket, vår policy, våra kurser, utbildningar och erbjudanden — klicka för att visa i chatten");
    expect(texts.officeQuestion).toBe("Vilket kontor vill du kontakta?");
    expect(texts.seoTitle).toBe("Atlas - Din Körkortsguide");
    expect(texts.seoDescription).toBe("Atlas är din personliga körkortsguide. Få svar på frågor om körkort, priser och hitta rätt trafikskola.");
    expect(texts.welcomeAiOn).toContain("Du kan fråga mig allt som rör ditt körkort och vårt utbud.");
    expect(texts.welcomeAiOff).toContain("Här kan du välja att ställa frågor till vår Centralsupport i Stockholm.");
    expect(texts.welcomeAiOff).toContain(legacyNameLead);
  });

  it("returns the locked standard texts and interpolated labels", () => {
    const legacyNameLead = "Vi börjar med ditt " + "namn";
    const texts = resolveWidgetTexts({
      ...standardProfile,
      labels: { unit: "Avdelning", category: "Ärendetyp" },
    });
    expect(texts).toMatchObject({
      headerSubtitle: "Kundservice",
      templatesTitle: "Kundinformation",
      templatesSubtitle: "Här kan du läsa mer om våra tjänster, villkor och annat bra att veta — klicka för att visa i chatten",
      officeQuestion: "Vart vill du skicka ditt ärende?",
      formUnitLabel: "Avdelning",
      formCategoryLabel: "Ärendetyp",
      seoTitle: "Atlas - Kundservice",
      seoDescription: "Atlas kundservice – ställ din fråga eller skicka ett ärende till oss.",
    });
    expect(texts.welcomeAiOn).toContain("företagets inlagda fakta om tjänster");
    expect(texts.welcomeAiOff).toContain("skickar ditt ärende till rätt mottagare hos oss");
    expect(texts.welcomeAiOff).toContain("Vi börjar med vart du vill skicka ärendet.");
    expect(texts.welcomeAiOff).not.toContain(legacyNameLead);
  });

  it("uses neutral standard label fallbacks and is deterministic without throwing", () => {
    expect(() => resolveWidgetTexts({} as TenantProfile)).not.toThrow();
    const first = resolveWidgetTexts(standardProfile);
    expect(first.formUnitLabel).toBe("Kontor");
    expect(first.formCategoryLabel).toBe("Kategori");
    expect(first).toEqual(resolveWidgetTexts(standardProfile));
  });

  it("forks the templates title and subtitle without changing the legacy defaults", () => {
    const legacy = resolveWidgetTexts(undefined);
    const standard = resolveWidgetTexts(standardProfile);
    expect(legacy.templatesTitle).toBe("Vårt utbud");
    expect(legacy.templatesSubtitle).toContain("paket");
    expect(standard.templatesTitle).toBe("Kundinformation");
    expect(standard.templatesSubtitle).toBe("Här kan du läsa mer om våra tjänster, villkor och annat bra att veta — klicka för att visa i chatten");
    expect(standard.templatesSubtitle).not.toContain("paket");
  });
});

describe("intake order", () => {
  it("puts contact details last in category-first mode", () => {
    expect(buildIntakeOrder("category_first", 10)).toEqual([
      "office", "category", "name", "email", "phone", "handoff",
    ]);
  });

  it("skips only the office step when a safe office is already known", () => {
    expect(buildIntakeOrder("category_first", 10, true)).toEqual([
      "category", "name", "email", "phone", "handoff",
    ]);
  });

  it("preserves the legacy order and falls back to it without category choices", () => {
    const legacy = ["name", "email", "phone", "office", "vehicle", "handoff"];
    expect(buildIntakeOrder("legacy", 10)).toEqual(legacy);
    expect(buildIntakeOrder("category_first", 0)).toEqual(legacy);
  });

  it.each(["hoppa över", "hoppa over", "nej", "nej tack", "inte nu", "-"])(
    "keeps mobile optional for %s",
    (input) => expect(resolveOptionalPhone(input)).toEqual({ valid: true }),
  );

  it("keeps the existing mobile validation and ten-digit payload cap", () => {
    expect(resolveOptionalPhone("070-123 45 67")).toEqual({ valid: true, phone: "0701234567" });
    expect(resolveOptionalPhone("123")).toEqual({ valid: false });
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

describe("filterCategoryChoicesForOffice", () => {
  const choices = [
    { label: "Muttrar", value: "MUTTRAR" },
    { label: "Skruvar", value: "SKRUVAR" },
    { label: "Brickor", value: "BRICKOR" },
  ];

  it("limits choices to the selected office's offered categories", () => {
    expect(filterCategoryChoicesForOffice(choices, ["SKRUVAR", "BRICKOR"])).toEqual([
      { label: "Skruvar", value: "SKRUVAR" },
      { label: "Brickor", value: "BRICKOR" },
    ]);
  });

  it.each([undefined, null])("fails open when categories_offered is %j", (offered) => {
    expect(filterCategoryChoicesForOffice(choices, offered)).toEqual(choices);
  });

  it("returns no choices when categories_offered is a known empty array", () => {
    expect(filterCategoryChoicesForOffice(choices, [])).toEqual([]);
  });

  it("ignores blank offered category ids without mutating the original list", () => {
    const snapshot = structuredClone(choices);
    expect(filterCategoryChoicesForOffice(choices, ["", " MUTTRAR "])).toEqual([
      { label: "Muttrar", value: "MUTTRAR" },
    ]);
    expect(choices).toEqual(snapshot);
  });
});
