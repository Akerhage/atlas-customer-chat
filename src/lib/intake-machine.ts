import type { EffectiveCategory, TenantProfile } from "@/lib/tenant-capabilities";

export type IntakeMode = "category_first" | "legacy";
export type IntakeOrderStep = "category" | "office" | "name" | "email" | "phone" | "vehicle" | "handoff";

export interface WidgetTexts {
  headerSubtitle: string;
  templatesTitle: string;
  templatesSubtitle: string;
  welcomeAiOn: string;
  welcomeAiOff: string;
  officeQuestion: string;
  formUnitLabel: string;
  formCategoryLabel: string;
  seoTitle: string;
  seoDescription: string;
}

const LEGACY_TEXTS: WidgetTexts = {
  headerSubtitle: "Din körkortsguide",
  templatesTitle: "Vårt utbud",
  templatesSubtitle: "Här kan du läsa mer om våra paket, vår policy, våra kurser, utbildningar och erbjudanden — klicka för att visa i chatten",
  welcomeAiOn: `Hej och välkommen till oss! 👋

Jag är företagets smarta AI-assistent!

Du kan fråga mig allt som rör ditt körkort och vårt utbud.

Jag har stenkoll på våra priser, produkter, utbildningar och kontor, men även på allmän information som rör körkort. Ställ gärna en fråga i taget, kort och konkret – då hittar jag snabbast rätt svar. Eller testa våra snabbfrågor direkt i chatten.

Vill du hellre prata med en människa?

[💬 Prata med en människa](#atlas-human)

Du kan också skriva *"jag vill prata med en människa"* eller klicka på headsetikonen i menyn ovanför chatten.

Vad kan jag hjälpa dig med idag?`,
  welcomeAiOff: `Hej och välkommen till oss! 👋

Har du frågor att ställa till oss är du varmt välkommen att ställa dem här.

Här kan du välja att ställa frågor till vår Centralsupport i Stockholm.

Du kan också mejla eller chatta direkt med ditt lokala kontor.

Jag guidar dig genom att fylla i ditt namn och skicka ärendet rätt.

Några korta steg, sedan är du igång!

Vi börjar med ditt namn.

Vad heter du?`,
  officeQuestion: "Vilket kontor vill du kontakta?",
  formUnitLabel: "Kontor",
  formCategoryLabel: "Fordon",
  seoTitle: "Atlas - Din Körkortsguide",
  seoDescription: "Atlas är din personliga körkortsguide. Få svar på frågor om körkort, priser och hitta rätt trafikskola.",
};

export function resolveWidgetTexts(profile: TenantProfile | null | undefined): WidgetTexts {
  if (resolveIntakeMode(profile) !== "category_first") return { ...LEGACY_TEXTS };
  return {
    headerSubtitle: "Kundservice",
    templatesTitle: "Kundinformation",
    templatesSubtitle: "Här kan du läsa mer om våra tjänster, villkor och annat bra att veta — klicka för att visa i chatten",
    officeQuestion: "Vart vill du skicka ditt ärende?",
    welcomeAiOff: `Hej och välkommen till oss! 👋

Har du frågor eller vill du skicka ett ärende till oss är du varmt välkommen.

Jag guidar dig genom några korta steg och skickar ditt ärende till rätt mottagare hos oss.

Vi börjar med vart du vill skicka ärendet.`,
    welcomeAiOn: `Hej och välkommen till oss! 👋

Jag är företagets smarta AI-assistent!

Jag svarar utifrån företagets inlagda fakta om tjänster, öppettider och kontaktvägar. Ställ gärna en fråga i taget, kort och konkret – då hittar jag snabbast rätt svar.

Vill du hellre prata med en människa?

[💬 Prata med en människa](#atlas-human)

Du kan också klicka på headsetikonen i menyn ovanför chatten.

Vad kan jag hjälpa dig med idag?`,
    formUnitLabel: profile?.labels?.unit ?? "Kontor",
    formCategoryLabel: profile?.labels?.category ?? "Kategori",
    seoTitle: "Atlas - Kundservice",
    seoDescription: "Atlas kundservice – ställ din fråga eller skicka ett ärende till oss.",
  };
}

export function resolveIntakeMode(profile: TenantProfile | null | undefined): IntakeMode {
  return profile?.edition === "standard" && profile.intake?.mode === "category_first"
    ? "category_first"
    : "legacy";
}

export function buildCategoryChoices(
  categories: readonly EffectiveCategory[] | null | undefined,
): { label: string; value: string; icon?: string }[] {
  if (!Array.isArray(categories)) return [];

  return categories
    .filter((category) => category.active !== false)
    .map((category) => ({ label: category.label, value: category.id, icon: category.icon }));
}

export function filterCategoryChoicesForOffice<T extends { value: string }>(
  categoryChoices: readonly T[],
  officeCategoriesOffered: readonly unknown[] | null | undefined,
): T[] {
  if (!Array.isArray(officeCategoriesOffered)) {
    return [...categoryChoices];
  }
  // Patrik-beslut 2026-07-20: saknat fält är okänt utbud, [] är känt tomt utbud.
  if (officeCategoriesOffered.length === 0) return [];

  const allowedCategories = new Set(
    officeCategoriesOffered
      .map((category) => String(category || "").trim())
      .filter(Boolean),
  );
  if (allowedCategories.size === 0) return [...categoryChoices];

  return categoryChoices.filter((choice) => allowedCategories.has(choice.value));
}

export function isCategoryFirstIntake(mode: IntakeMode, _categoryChoiceCount: number): boolean {
  return mode === "category_first";
}

export function buildIntakeOrder(
  mode: IntakeMode,
  categoryChoiceCount: number,
  hasKnownOffice = false,
): readonly IntakeOrderStep[] {
  if (isCategoryFirstIntake(mode, categoryChoiceCount)) {
    return [...(hasKnownOffice ? [] : ["office"] as const), "category", "name", "email", "phone", "handoff"];
  }

  return ["name", "email", "phone", "office", "vehicle", "handoff"];
}

export function resolveOptionalPhone(input: string): { valid: boolean; phone?: string } {
  const trimmed = input.trim();
  const normalizedPhoneSkip = trimmed.toLowerCase().replace(/[.!?]+$/g, "").trim();
  const skipWords = ["hoppa över", "hoppa over", "skip", "-", "nej", "nej tack", "no", "n", "ingen", "inget", "inte nu"];
  if (skipWords.includes(normalizedPhoneSkip)) return { valid: true };

  const digits = trimmed.replace(/\D/g, "").slice(0, 10);
  return digits.length >= 8 ? { valid: true, phone: digits } : { valid: false };
}
