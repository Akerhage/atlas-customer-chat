import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const contextBarSource = readFileSync(new URL("./ChatContextBar.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const chatHeaderSource = readFileSync(new URL("./ChatHeader.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const chatHeaderSurfaceCss = css.match(/\.chat-header-surface\s*\{([^}]*)\}/)?.[1] ?? "";

function token(name: string): [number, number, number] {
  const match = css.match(new RegExp(`${name}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%;`));
  expect(match).toBeTruthy();
  return [Number(match![1]), Number(match![2]), Number(match![3])];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m].map(value => Math.round(value * 255)) as [number, number, number];
}

function relativeLuminance(rgb: [number, number, number]): number {
  return rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(first: [number, number, number], second: [number, number, number]): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("light customer chat surface separation", () => {
  it("keeps the light Atlas bubble visibly separated from the page surface", () => {
    const ratio = contrast(hslToRgb(token("--bubble-atlas-bg")), hslToRgb(token("--background")));
    expect(ratio).toBeGreaterThanOrEqual(1.3);
  });

  it("makes selected context chips stronger than the old low-opacity state", () => {
    expect(contextBarSource).toContain("bg-primary/20 text-primary-ink border-primary/55");
    expect(contextBarSource).not.toContain("bg-primary/10 text-primary border-primary/30");
    expect(contextBarSource).toContain('choice.label === selectedLabel && "bg-primary/20 text-primary-ink"');
  });

  it("uses the header surface for white-logo contrast without a separate logo plate", () => {
    expect(chatHeaderSource).toContain('className="chat-header-surface');
    expect(chatHeaderSource).toContain('data-testid="chat-header-logo"');
    expect(chatHeaderSource).toContain("<img");
    expect(chatHeaderSource).not.toContain("bg-slate-800/90");
    expect(chatHeaderSource).not.toContain("dark:bg-card/80");
    expect(contrast(hslToRgb(token("--chat-header-bg")), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    for (const foregroundToken of [
      "--chat-header-fg",
      "--chat-header-fg-muted",
      "--chat-header-accent",
      "--chat-header-danger",
      "--chat-header-danger-hover",
    ]) {
      expect(contrast(hslToRgb(token("--chat-header-bg")), hslToRgb(token(foregroundToken)))).toBeGreaterThanOrEqual(4.5);
    }
    expect(chatHeaderSurfaceCss).toContain("--foreground: var(--chat-header-fg)");
    expect(chatHeaderSurfaceCss).toContain("--primary: var(--chat-header-accent)");
    expect(chatHeaderSurfaceCss).not.toContain("--border:");
    expect(chatHeaderSurfaceCss).not.toContain("--popover");
  });
});
