import type { EffectiveCategory, TenantProfile } from "@/lib/tenant-capabilities";

export type IntakeMode = "category_first" | "legacy";

export interface WidgetTexts {
  headerSubtitle: string;
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
    officeQuestion: "Vart vill du skicka ditt ärende?",
    welcomeAiOff: `Hej och välkommen till oss! 👋

Har du frågor eller vill du skicka ett ärende till oss är du varmt välkommen.

Jag guidar dig genom några korta steg och skickar ditt ärende till rätt mottagare hos oss.

Vi börjar med ditt namn.

Vad heter du?`,
    welcomeAiOn: `Hej och välkommen till oss! 👋

Jag är företagets smarta AI-assistent!

Jag svarar utifrån företagets inlagda fakta om tjänster, öppettider och kontaktvägar. Ställ gärna en fråga i taget, kort och konkret – då hittar jag snabbast rätt svar.

Vill du hellre prata med en människa?

[💬 Prata med en människa](#atlas-human)

Du kan också skriva *"jag vill prata med en människa"* eller klicka på headsetikonen i menyn ovanför chatten.

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
): { label: string; value: string }[] {
  if (!Array.isArray(categories)) return [];

  return categories
    .filter((category) => category.active !== false)
    .map((category) => ({ label: category.label, value: category.id }));
}
