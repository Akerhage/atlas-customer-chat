import { describe, expect, it, vi } from "vitest";
import { downloadChatLog, generateChatLog, type ChatLogMessage } from "./chat-log-download";

const now = new Date("2026-08-30T06:10:00.000Z");

const messages: ChatLogMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "Hej **Atlas**",
    timestamp: new Date("2026-08-30T06:00:00.000Z"),
  },
  {
    id: "m2",
    role: "assistant",
    content: "- Svar med *markdown*",
    timestamp: new Date("2026-08-30T06:01:00.000Z"),
  },
];

describe("chat log download", () => {
  it("generates the same plain-text log content for dialog and banner downloads", () => {
    const log = generateChatLog(messages, now);

    expect(log).toContain("Atlas Chattlogg");
    expect(log).toContain("Du:\nHej Atlas");
    expect(log).toContain("Atlas:\n• Svar med markdown");
    expect(log).toContain("Slut på chattlogg");
    expect(log).not.toContain("**");
  });

  it("downloads a dated text file without resetting the chat session", async () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const documentRef = {
      body: { appendChild, removeChild },
      createElement: vi.fn(() => anchor),
    };
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:atlas-chat");
    const urlApi = {
      createObjectURL,
      revokeObjectURL: vi.fn<(url: string) => void>(),
    };

    downloadChatLog(messages, { document: documentRef, url: urlApi, now });

    expect(documentRef.createElement).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("blob:atlas-chat");
    expect(anchor.download).toBe("atlas-chatt-2026-08-30.txt");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith("blob:atlas-chat");

    const blob = createObjectURL.mock.calls[0][0];
    await expect(blob.text()).resolves.toContain("Hej Atlas");
  });
});
