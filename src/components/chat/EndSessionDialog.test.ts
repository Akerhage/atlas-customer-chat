import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./EndSessionDialog.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("EndSessionDialog auto close", () => {
  it("auto-closes like Avbryt after about one minute without confirming the destructive action", () => {
    expect(source).toContain("const AUTO_CLOSE_MS = 60_000;");
    expect(source).toContain("window.setTimeout(() => onOpenChange(false), AUTO_CLOSE_MS)");

    const effectStart = source.indexOf("useEffect(() => {");
    const effectEnd = source.indexOf("const generateChatLog", effectStart);
    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(effectEnd).toBeGreaterThan(effectStart);
    const autoCloseEffect = source.slice(effectStart, effectEnd);
    expect(autoCloseEffect).not.toContain("onConfirm()");
  });
});
