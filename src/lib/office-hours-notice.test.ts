import { describe, expect, it } from "vitest";
import { buildOfficeHoursNoticeText } from "./office-hours-notice";

const baseOptions = {
  reopensLabel: null,
  selfserviceMenuAvailable: false,
  quickQuestionsAvailable: false,
  aiAssistantAvailable: false,
};

describe("buildOfficeHoursNoticeText", () => {
  it("only promises queue handling when no automatic surface is available", () => {
    const text = buildOfficeHoursNoticeText(baseOptions);

    expect(text).toBe(`👋 Just nu är personalen inte på plats. Vill du inte vänta?

[Skicka ett ärende via mailformuläret](#atlas-contact)

Vi tar det så snart vi är tillbaka.`);
    expect(text).not.toContain("Snabbfrågorna");
    expect(text).not.toContain("AI-assistenten");
  });

  it("includes the reopen label when staff hours expose one", () => {
    expect(buildOfficeHoursNoticeText({ ...baseOptions, reopensLabel: "idag 08:00" })).toBe(`👋 Just nu är personalen inte på plats — chatten är bemannad igen idag 08:00. Vill du inte vänta?

[Skicka ett ärende via mailformuläret](#atlas-contact)

Vi tar det så snart vi är tillbaka.`);
  });

  it("mentions the clickable selfservice choices when that surface is available", () => {
    expect(buildOfficeHoursNoticeText({ ...baseOptions, selfserviceMenuAvailable: true })).toBe(`👋 Just nu är personalen inte på plats. Vill du inte vänta?

[Skicka ett ärende via mailformuläret](#atlas-contact)

Vi tar det så snart vi är tillbaka. Du kan klicka dig fram bland valen i chatten under tiden.`);
  });

  it("mentions quick questions only when they are actually available", () => {
    expect(buildOfficeHoursNoticeText({ ...baseOptions, quickQuestionsAvailable: true })).toBe(`👋 Just nu är personalen inte på plats. Vill du inte vänta?

[Skicka ett ärende via mailformuläret](#atlas-contact)

Vi tar det så snart vi är tillbaka. Snabbfrågorna hjälper dig gärna under tiden.`);
  });

  it("mentions the AI assistant only when free text AI is actually available", () => {
    expect(buildOfficeHoursNoticeText({ ...baseOptions, aiAssistantAvailable: true })).toBe(`👋 Just nu är personalen inte på plats. Vill du inte vänta?

[Skicka ett ärende via mailformuläret](#atlas-contact)

Vi tar det så snart vi är tillbaka. AI-assistenten hjälper dig gärna under tiden.`);
  });

  it("joins quick questions and the AI assistant naturally", () => {
    expect(buildOfficeHoursNoticeText({
      ...baseOptions,
      quickQuestionsAvailable: true,
      aiAssistantAvailable: true,
    })).toBe(`👋 Just nu är personalen inte på plats. Vill du inte vänta?

[Skicka ett ärende via mailformuläret](#atlas-contact)

Vi tar det så snart vi är tillbaka. Snabbfrågorna och AI-assistenten hjälper dig gärna under tiden.`);
  });
});
