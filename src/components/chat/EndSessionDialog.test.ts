import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./EndSessionDialog.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("EndSessionDialog auto close", () => {
  it("auto-closes like Avbryt after about one minute without confirming the destructive action", () => {
    expect(source).toContain("const AUTO_CLOSE_MS = 60_000;");
    expect(source).toContain("window.setTimeout(() => onOpenChange(false), AUTO_CLOSE_MS)");

    const effectStart = source.indexOf("useEffect(() => {");
    const effectEnd = source.indexOf("const handleDownload", effectStart);
    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(effectEnd).toBeGreaterThan(effectStart);
    const autoCloseEffect = source.slice(effectStart, effectEnd);
    expect(autoCloseEffect).not.toContain("onConfirm()");
  });

  it("keeps dialog download destructive only after the shared log download succeeds", () => {
    expect(source).toContain('import { downloadChatLog } from "@/lib/chat-log-download";');
    const blockStart = source.indexOf("const handleDownload = () => {");
    const blockEnd = source.indexOf("const handleCloseWithoutDownload", blockStart);
    expect(blockStart).toBeGreaterThanOrEqual(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(block).toContain("downloadChatLog(messages);");
    expect(block).toContain("onConfirm();");
    expect(block.indexOf("downloadChatLog(messages);")).toBeLessThan(block.indexOf("onConfirm();"));
  });
});
