import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rawSource = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function mutateSourceForRedFirst(src: string): string {
  if (process.env.ATLAS_KAN235_ARCHIVE_MUTATION === "passive-opens-dialog") {
    return src.replace("}, { showEndDialog: false });", "});");
  }
  if (process.env.ATLAS_KAN235_ARCHIVE_MUTATION === "active-dialog-removed") {
    const start = src.indexOf("const handleEndSession = () => {");
    const end = src.indexOf("const handleConfirmEnd = () => {", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return src.slice(0, start)
      + src.slice(start, end).replace("setShowEndDialog(true);", "/* mutation: active dialog removed */")
      + src.slice(end);
  }
  return src;
}

const source = mutateSourceForRedFirst(rawSource);

function sourceBlock(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `missing start marker ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing end marker ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("AtlasChat archived-session UX", () => {
  it("suppresses the end dialog only for the passive pollHistory archive path", () => {
    expect(source).toContain("type ApplyArchivedStateOptions = { showEndDialog?: boolean };");
    expect(source).toContain("const suppressNextArchiveDialogRef = useRef(false);");
    expect(source).toContain("if (!suppressNextArchiveDialogRef.current) {");
    expect(source).toContain("setShowEndDialog(true);");

    const pollHistoryBlock = sourceBlock(
      "const pollHistory = useCallback(async () => {",
      "// Always sync messages from server",
    );
    expect(pollHistoryBlock).toContain("applyArchivedState({");
    expect(pollHistoryBlock).toContain("}, { showEndDialog: false });");

    const selfserviceBlock = sourceBlock(
      "if (isArchivedStandardSelfserviceAnswerError(error)) {",
      "} else {",
    );
    expect(selfserviceBlock).toContain("applyArchivedState({");
    expect(selfserviceBlock).not.toContain("showEndDialog: false");

    const socketBlock = sourceBlock(
      "const handleSessionStatus = useCallback((event: SessionStatusEvent) => {",
      "}, [applyArchivedState]);",
    );
    expect(socketBlock).toContain("applyArchivedState({");
    expect(socketBlock).not.toContain("showEndDialog: false");

    const sendBlock = sourceBlock(
      "if (response.is_archived) {",
      "setHumanMode(false);",
    );
    expect(sendBlock).toContain("applyArchivedState({");
    expect(sendBlock).not.toContain("showEndDialog: false");
  });

  it("keeps the active customer end-session dialog path intact", () => {
    const endSessionBlock = sourceBlock("const handleEndSession = () => {", "const handleConfirmEnd = () => {");
    expect(endSessionBlock).toContain("emitEndChat();");
    expect(endSessionBlock).toContain("if (messages.length > 1) {");
    expect(endSessionBlock).toContain("setShowEndDialog(true);");

    const confirmBlock = sourceBlock("const handleConfirmEnd = () => {", "const handleRequestHuman = () => {");
    expect(confirmBlock).toContain("setShowEndDialog(false);");
    expect(confirmBlock).toContain("handleReset();");
  });

  it("shows a visible log-download action in the archived banner", () => {
    const bannerBlock = sourceBlock("{/* Archived indicator */}", "{/* KAN-120:");
    expect(bannerBlock).toContain("downloadChatLog(messages)");
    expect(bannerBlock).toContain('aria-label="Spara kopia av chattloggen"');
    expect(bannerBlock).toContain('title="Spara kopia av chattloggen"');
    expect(bannerBlock).toContain("Spara kopia");
  });
});
