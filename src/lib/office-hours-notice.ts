export interface OfficeHoursNoticeOptions {
  reopensLabel: string | null;
  selfserviceMenuAvailable: boolean;
  quickQuestionsAvailable: boolean;
  aiAssistantAvailable: boolean;
}

function buildAvailableSurfaceSentence({
  selfserviceMenuAvailable,
  quickQuestionsAvailable,
  aiAssistantAvailable,
}: Pick<OfficeHoursNoticeOptions, "selfserviceMenuAvailable" | "quickQuestionsAvailable" | "aiAssistantAvailable">): string {
  const extraSentences: string[] = [];
  if (selfserviceMenuAvailable) {
    extraSentences.push("Du kan klicka dig fram bland valen i chatten under tiden.");
  }

  if (quickQuestionsAvailable && aiAssistantAvailable) {
    extraSentences.push("Snabbfrågorna och AI-assistenten hjälper dig gärna under tiden.");
  } else if (quickQuestionsAvailable) {
    extraSentences.push("Snabbfrågorna hjälper dig gärna under tiden.");
  } else if (aiAssistantAvailable) {
    extraSentences.push("AI-assistenten hjälper dig gärna under tiden.");
  }

  return extraSentences.length > 0 ? ` ${extraSentences.join(" ")}` : "";
}

export function buildOfficeHoursNoticeText(options: OfficeHoursNoticeOptions): string {
  const reopens = options.reopensLabel ? ` — chatten är bemannad igen ${options.reopensLabel}` : "";
  return `👋 Just nu är personalen inte på plats${reopens}. Vill du inte vänta?

[Skicka ett ärende via mailformuläret](#atlas-contact)

Vi tar det så snart vi är tillbaka.${buildAvailableSurfaceSentence(options)}`;
}
