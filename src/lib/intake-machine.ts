import type { EffectiveCategory, TenantProfile } from "@/lib/tenant-capabilities";
import { isStandardSelfserviceAvailable, isStandardSelfserviceExclusive } from "@/lib/standard-selfservice-machine";

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

// L-019: en trafikskola med Branschkunskap AV har INGET fritextfält — det döljs
// av ChatInput. Den äldre AI-PÅ-hälsningen ber besökaren "fråga mig allt" och
// "skriv jag vill prata med en människa", vilket direkt motsäger gränssnittet.
// Trafikidentiteten behålls (rubrik, utbud, fordonsetiketter) — endast
// välkomsttextens löfte om fritext byts mot menyvägen.
//
// 🔴 Placerad FÖRE textblocket nedan med flit: AtlasChat.intake-order.test.ts:33
// är en byte-identitetsvakt över det blocket, som skyddar Box1-3:s trafiktext
// från att glida under Box4-arbete. Ny kod läggs utanför blocket och vaktens
// hash skrivs aldrig om. Kommentaren undviker dessutom vaktens markörsträngar
// ordagrant — de matchas med indexOf, så en kopia här flyttar blockets start.
const TRAFIK_SELFSERVICE_WELCOME_AI_ON = `Hej och välkommen till oss! 👋

Jag är företagets smarta guide!

Du behöver inte skriva något — välj bland knapparna i chatten så visar jag det du vill veta.

Jag har stenkoll på våra priser, produkter, utbildningar och kontor. Välj kontor och fordon så visar jag vad som gäller. Du kan också testa våra snabbfrågor direkt i chatten.

Vill du hellre prata med en människa?

[💬 Prata med en människa](#atlas-human)

Du kan också klicka på headsetikonen i menyn ovanför chatten.

Vad kan jag hjälpa dig med idag?`;

const HANDOFF_WELCOME_AI_ON = `Hej och välkommen till oss! 👋

Har du frågor eller vill du skicka ett ärende till oss är du varmt välkommen.

Vill du skicka ett ärende kan du välja länken här:

[Skapa ett ärende här i chatten](#atlas-human)

Du kan också klicka på headsetikonen i menyn ovanför chatten.

Skriv gärna kort vad du behöver hjälp med, så hjälper vi dig att skicka ärendet till rätt mottagare hos oss.`;

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

Här kan du välja att chatta eller mejla direkt med ditt lokala kontor, eller med vår supportavdelning.

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

export function resolveWidgetTexts(profile: TenantProfile | null | undefined, companyName?: string | null): WidgetTexts {
  const greetingName = (companyName ?? "").trim() || "oss";
  const intakeMode = resolveIntakeMode(profile);
  const selfserviceAvailable = isStandardSelfserviceAvailable(profile, intakeMode);
  const selfserviceExclusive = isStandardSelfserviceExclusive(profile, intakeMode);
  if (intakeMode !== "category_first") {
    const greeting = `Hej och välkommen till ${greetingName}! 👋`;
    // L-019: när fritextfältet är dolt får välkomsttexten inte be om fritext.
    const welcomeAiOn = selfserviceExclusive
      ? TRAFIK_SELFSERVICE_WELCOME_AI_ON
      : profile?.modules?.industry_rag === false
        ? HANDOFF_WELCOME_AI_ON
      : LEGACY_TEXTS.welcomeAiOn;
    return {
      ...LEGACY_TEXTS,
      welcomeAiOn: welcomeAiOn.replace("Hej och välkommen till oss! 👋", greeting),
      welcomeAiOff: LEGACY_TEXTS.welcomeAiOff.replace("Hej och välkommen till oss! 👋", greeting),
    };
  }
  const standardTexts: WidgetTexts = {
    headerSubtitle: "Kundservice",
    templatesTitle: "Kundinformation",
    templatesSubtitle: "Här kan du läsa mer om våra tjänster, villkor och annat bra att veta — klicka för att visa i chatten",
    officeQuestion: "Vart vill du skicka ditt ärende?",
    welcomeAiOff: `Hej och välkommen till ${greetingName}! 👋

Har du frågor eller vill du skicka ett ärende till oss är du varmt välkommen.

Jag guidar dig genom några korta steg och skickar ditt ärende till rätt mottagare hos oss.

Vi börjar med vart du vill skicka ärendet.`,
    welcomeAiOn: `Hej och välkommen till ${greetingName}! 👋

Jag är vår smarta AI-assistent!

Jag svarar utifrån företagets inlagda fakta om tjänster, öppettider och kontaktvägar.

Du behöver inte skriva något — välj bland knapparna i chatten så visar jag det du vill veta.

Vill du hellre prata med en människa klickar du på headsetikonen i menyn ovanför chatten, så hjälper vi dig att skapa ett ärende.`,
    formUnitLabel: profile?.labels?.unit ?? "Kontor",
    formCategoryLabel: profile?.labels?.category ?? "Kategori",
    seoTitle: "Atlas - Kundservice",
    seoDescription: "Atlas kundservice – ställ din fråga eller skicka ett ärende till oss.",
  };
  if (!selfserviceAvailable) {
    return {
      ...standardTexts,
      welcomeAiOn: HANDOFF_WELCOME_AI_ON.replace("Hej och välkommen till oss! 👋", `Hej och välkommen till ${greetingName}! 👋`),
    };
  }
  return standardTexts;
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
