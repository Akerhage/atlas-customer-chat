import { describe, expect, it } from "vitest";
import { buildCategoryChoices, resolveIntakeMode } from "./intake-machine";
import type { EffectiveCategory, TenantProfile } from "./tenant-capabilities";

const standardProfile: TenantProfile = {
  schema_version: 1,
  edition: "standard",
  intake: { mode: "category_first" },
};

describe("resolveIntakeMode", () => {
  it("enables category-first only for the standard category-first profile", () => {
    expect(resolveIntakeMode(standardProfile)).toBe("category_first");
  });

  it.each([
    undefined,
    null,
    { ...standardProfile, edition: "trafikskola" },
    { ...standardProfile, intake: { mode: "legacy" } },
    { ...standardProfile, intake: undefined },
  ])("fails closed to legacy for %j", (profile) => {
    expect(resolveIntakeMode(profile)).toBe("legacy");
  });
});

describe("buildCategoryChoices", () => {
  it("uses active registry labels as plain text and preserves order", () => {
    const categories: EffectiveCategory[] = [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
      { id: "DOLD", label: "Dold", icon: "HIDDEN", active: false },
      { id: "SKRUVAR", label: "Skruvar", icon: "SCREW", active: true },
    ];

    expect(buildCategoryChoices(categories)).toEqual([
      { label: "Muttrar", value: "MUTTRAR" },
      { label: "Skruvar", value: "SKRUVAR" },
    ]);
  });

  it.each([undefined, null, []])("returns an empty list for %j", (categories) => {
    expect(buildCategoryChoices(categories)).toEqual([]);
  });

  it("is deterministic and does not mutate its input", () => {
    const categories: EffectiveCategory[] = [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ];
    const snapshot = structuredClone(categories);

    expect(buildCategoryChoices(categories)).toEqual(buildCategoryChoices(categories));
    expect(categories).toEqual(snapshot);
  });
});
