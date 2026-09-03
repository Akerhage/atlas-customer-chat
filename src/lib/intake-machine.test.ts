import { describe, expect, it } from "vitest";
import { buildCategoryChoices, buildIntakeOrder, buildLegacyContextBarCategoryChoices, filterCategoryChoicesForOffice, resolveIntakeMode, resolveOptionalPhone, resolveWidgetTexts } from "./intake-machine";
import type { EffectiveCategory, TenantProfile } from "./tenant-capabilities";

const standardProfile: TenantProfile = {
  schema_version: 1,
  edition: "standard",
  modules: { structured_answers: true, industry_rag: false },
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

describe("resolveWidgetTexts — L-019 fritextlöftet", () => {
  const trafikRagOff: TenantProfile = {
    schema_version: 1,
    edition: "trafikskola",
    modules: { structured_answers: true, industry_rag: false },
  };

  it("lovar INTE fritext när branschkunskapen är av och fältet därmed är dolt", () => {
    const texts = resolveWidgetTexts(trafikRagOff, "Test Trafik");
    expect(texts.welcomeAiOn).toContain("Du behöver inte skriva något");
    // 🔴 Dessa uppmaningar motsäger ett dolt fritextfält och får inte finnas.
    expect(texts.welcomeAiOn).not.toContain("Du kan fråga mig allt");
    expect(texts.welcomeAiOn).not.toContain("Ställ gärna en fråga i taget");
    expect(texts.welcomeAiOn).not.toContain('skriva *"jag vill prata med en människa"*');
    // Trafikidentiteten behålls — detta är inte en omställning till Standard.
    expect(texts.headerSubtitle).toBe("Din körkortsguide");
    expect(texts.templatesTitle).toBe("Kundinformation");
    expect(texts.formCategoryLabel).toBe("Fordon");
    expect(texts.welcomeAiOn).toMatch(/^Hej och välkommen till Test Trafik! 👋/);
  });

  it("behåller den gamla hälsningen när branschkunskapen är PÅ", () => {
    const ragOn: TenantProfile = {
      ...trafikRagOff,
      modules: { structured_answers: true, industry_rag: true },
    };
    expect(resolveWidgetTexts(ragOn, "Test Trafik").welcomeAiOn).toContain("Du kan fråga mig allt");
    // Profillös tenant (Box1-3) ska aldrig byta text.
    expect(resolveWidgetTexts(undefined, "MDA").welcomeAiOn).toContain("Du kan fråga mig allt");
  });

  it("uses honest handoff copy when traffic RAG and structured answers are both off", () => {
    const texts = resolveWidgetTexts({
      schema_version: 1,
      edition: "trafikskola",
      modules: { structured_answers: false, industry_rag: false },
    }, "Test Trafik");

    expect(texts.welcomeAiOn).toContain("skicka ett ärende");
    expect(texts.welcomeAiOn).toContain("[Skapa ett ärende här i chatten](#atlas-human)");
    expect(texts.welcomeAiOn).toContain("headsetikonen i menyn ovanför chatten");
    expect(texts.welcomeAiOn).not.toContain("Du kan fråga mig allt");
    expect(texts.welcomeAiOn).not.toContain("välj bland knapparna");
    expect(texts.headerSubtitle).toBe("Din körkortsguide");
  });
});

describe("resolveWidgetTexts", () => {
  it("returns the legacy traffic text contract with the tenant company name", () => {
    const texts = resolveWidgetTexts(undefined, "My Driving Academy");
    const legacyNameLead = "Vi börjar med ditt " + "namn.";
    expect(texts.welcomeAiOn).toMatch(/^Hej och välkommen till My Driving Academy! 👋/);
    expect(texts.welcomeAiOff).toMatch(/^Hej och välkommen till My Driving Academy! 👋/);
    expect(texts.headerSubtitle).toBe("Din körkortsguide");
    expect(texts.templatesTitle).toBe("Kundinformation");
    expect(texts.templatesSubtitle).toBe("Här kan du läsa mer om våra paket, vår policy, våra kurser, utbildningar och erbjudanden — klicka för att visa i chatten");
    expect(texts.officeQuestion).toBe("Vilket kontor vill du kontakta?");
    expect(texts.seoTitle).toBe("Atlas - Din Körkortsguide");
    expect(texts.seoDescription).toBe("Atlas är din personliga körkortsguide. Få svar på frågor om körkort, priser och hitta rätt trafikskola.");
    expect(texts.welcomeAiOn).toContain("Du kan fråga mig allt som rör ditt körkort och vårt utbud.");
    expect(texts.welcomeAiOn).toContain('Du kan också skriva *"jag vill prata med en människa"*');
    expect(texts.welcomeAiOff).toContain("Här kan du välja att chatta eller mejla direkt med ditt lokala kontor, eller med vår supportavdelning.");
    expect(texts.welcomeAiOff).not.toContain("Centralsupport i Stockholm");
    expect(texts.welcomeAiOff).toContain(legacyNameLead);
  });

  it("falls back to oss for missing legacy company names instead of Atlas", () => {
    for (const missing of [undefined, null, "", "   "]) {
      const texts = resolveWidgetTexts(undefined, missing as string | null | undefined);
      expect(texts.welcomeAiOn).toMatch(/^Hej och välkommen till oss! 👋/);
      expect(texts.welcomeAiOff).toMatch(/^Hej och välkommen till oss! 👋/);
      expect(texts.welcomeAiOn).not.toContain("välkommen till Atlas");
      expect(texts.welcomeAiOff).not.toContain("välkommen till Atlas");
    }
  });

  it("returns the locked standard texts and interpolated labels", () => {
    const legacyNameLead = "Vi börjar med ditt " + "namn";
    const texts = resolveWidgetTexts({
      ...standardProfile,
      labels: { unit: "Avdelning", category: "Ärendetyp" },
    }, "Bosses Skruvfabrik");
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
    expect(texts.welcomeAiOn).toContain("Hej och välkommen till Bosses Skruvfabrik!");
    expect(texts.welcomeAiOff).toContain("Hej och välkommen till Bosses Skruvfabrik!");
    expect(texts.welcomeAiOn).toContain("Jag är företagets smarta guide!");
    expect(texts.welcomeAiOn).toContain("Jag visar företagets inlagda information om tjänster, öppettider och kontaktvägar.");
    expect(texts.welcomeAiOn).toContain("headsetikonen i menyn ovanför chatten");
    expect(texts.welcomeAiOn).toContain("välj bland knapparna i chatten");
    expect(texts.welcomeAiOn).not.toContain("smarta AI-assistent");
    expect(texts.welcomeAiOn).not.toContain("Jag svarar utifrån");
    expect(texts.welcomeAiOn).not.toContain("Vad kan jag hjälpa dig med idag?");
    expect(texts.welcomeAiOn).not.toContain("Ställ gärna en fråga");
    expect(texts.welcomeAiOn).not.toContain("(#atlas-human)");
    expect(texts.welcomeAiOn).not.toContain('Du kan också skriva *"jag vill prata med en människa"*');
    expect(texts.welcomeAiOff).toContain("skickar ditt ärende till rätt mottagare hos oss");
    expect(texts.welcomeAiOff).toContain("Vi börjar med vart du vill skicka ärendet.");
    expect(texts.welcomeAiOff).not.toContain(legacyNameLead);
    expect(texts.welcomeAiOn).not.toMatch(/enhet/i);
    expect(texts.welcomeAiOff).not.toMatch(/enhet/i);
    expect(texts.officeQuestion).not.toMatch(/enhet/i);
  });

  it("does not promise buttons when Standard selfservice is disabled", () => {
    const texts = resolveWidgetTexts({
      ...standardProfile,
      modules: { structured_answers: false, industry_rag: false },
    }, "Bosses Skruvfabrik");

    expect(texts.welcomeAiOn).toContain("skicka ett ärende");
    expect(texts.welcomeAiOn).toContain("[Skapa ett ärende här i chatten](#atlas-human)");
    expect(texts.welcomeAiOn).toContain("headsetikonen i menyn ovanför chatten");
    expect(texts.welcomeAiOn).not.toContain("välj bland knapparna");
    expect(texts.welcomeAiOn).not.toContain("smarta AI-assistent");
    expect(texts.headerSubtitle).toBe("Kundservice");
  });

  it("falls back to oss for missing standard company names instead of Atlas", () => {
    for (const missing of [undefined, null, "", "   "]) {
      const texts = resolveWidgetTexts(standardProfile, missing as string | null | undefined);
      expect(texts.welcomeAiOn).toContain("Hej och välkommen till oss!");
      expect(texts.welcomeAiOff).toContain("Hej och välkommen till oss!");
      expect(texts.welcomeAiOn).not.toContain("välkommen till Atlas");
      expect(texts.welcomeAiOff).not.toContain("välkommen till Atlas");
    }
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
    expect(legacy.templatesTitle).toBe("Kundinformation");
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

  it("preserves legacy mode but keeps category-first order without category choices", () => {
    const legacy = ["name", "email", "phone", "office", "vehicle", "handoff"];
    expect(buildIntakeOrder("legacy", 10)).toEqual(legacy);
    expect(buildIntakeOrder("category_first", 0)).toEqual([
      "office", "category", "name", "email", "phone", "handoff",
    ]);
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

  it.each([
    { categories: undefined },
    { categories: null },
    { categories: [] },
  ])("returns an empty list for $categories", ({ categories }) => {
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

  it("builds the legacy context row from the selected office and keeps the general escape hatch", () => {
    const trafficChoices = [
      { label: "Bil", value: "BIL" },
      { label: "Motorcykel", value: "MC" },
    ];
    const buildForOffice = (categoriesOffered?: string[]) =>
      buildLegacyContextBarCategoryChoices(
        filterCategoryChoicesForOffice(trafficChoices, categoriesOffered),
        "legacy-category:",
        "legacy-category:general",
      );

    expect(buildForOffice(["BIL"])).toEqual([
      { label: "Bil", value: "legacy-category:BIL" },
      { label: "Övrigt / Allmän fråga", value: "legacy-category:general" },
    ]);
    expect(buildForOffice(undefined)).toEqual([
      { label: "Bil", value: "legacy-category:BIL" },
      { label: "Motorcykel", value: "legacy-category:MC" },
      { label: "Övrigt / Allmän fråga", value: "legacy-category:general" },
    ]);
  });
});
