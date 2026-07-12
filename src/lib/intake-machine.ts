import type { EffectiveCategory, TenantProfile } from "@/lib/tenant-capabilities";

export type IntakeMode = "category_first" | "legacy";

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
