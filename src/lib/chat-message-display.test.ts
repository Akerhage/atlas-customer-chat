import { describe, expect, it } from "vitest";
import {
  buildDisplayMessages,
  mapHistoryMessages,
  resolveArchivedMessage,
} from "./chat-message-display";

const choicesBefore = [{ value: "Centralsupport", label: "Supportavdelningen" }];
const choicesAfter = [{ value: "Centralsupport", label: "My Driving Academy Support" }];
const labelWith = (choices: typeof choicesBefore) => (value: string) =>
  choices.find((choice) => choice.value === value)?.label || value;

describe("stored chat values and presentation", () => {
  it("stores history content unchanged and resolves the current label at display time", () => {
    const history = [
      { role: "user" as const, content: "Centralsupport", timestamp: 1_700_000_000_123 },
      { role: "user" as const, content: "Ett eget meddelande", timestamp: 1_700_000_001_456 },
      { role: "atlas" as const, content: "Svar", timestamp: 1_700_000_002_789 },
    ];
    const stored = mapHistoryMessages(history, [], () => new Date(0));

    expect(stored.map((message) => message.content)).toEqual([
      "Centralsupport",
      "Ett eget meddelande",
      "Svar",
    ]);
    expect(stored.map((message) => message.timestamp.getTime())).toEqual([
      1_700_000_000_123,
      1_700_000_001_456,
      1_700_000_002_789,
    ]);
    expect(buildDisplayMessages(stored, labelWith(choicesBefore)).map((message) => message.content))
      .toEqual(["Supportavdelningen", "Ett eget meddelande", "Svar"]);
    expect(buildDisplayMessages(stored, labelWith(choicesAfter)).map((message) => message.content))
      .toEqual(["My Driving Academy Support", "Ett eget meddelande", "Svar"]);
  });

  it("uses the previous timestamp only for an already-rendered matching message", () => {
    const previous = [{
      id: "existing",
      role: "assistant" as const,
      content: "Svar",
      timestamp: new Date(123),
    }];
    const stored = mapHistoryMessages([{ role: "atlas", content: "Svar" }], previous, () => new Date(456));
    expect(stored[0].id).toBe("existing");
    expect(stored[0].timestamp.getTime()).toBe(123);
  });
});

describe("archived customer copy", () => {
  it.each([
    ["customer", "Du avslutade chatten."],
    ["customer:Anna", "Du avslutade chatten."],
    ["inactivity", "Chatten har stängts automatiskt på grund av inaktivitet."],
    ["deleted", "Chatten har avslutats."],
    ["agent", "Chatten är avslutad av handläggaren."],
    [null, "Chatten är avslutad av handläggaren."],
  ])("maps close reason %s", (reason, expected) => {
    expect(resolveArchivedMessage(reason)).toBe(expected);
  });
});
