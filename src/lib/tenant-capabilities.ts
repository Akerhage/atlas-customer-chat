export interface CategoryRegistryEntry {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

export interface TenantProfile {
  schema_version: number;
  edition: string;
}

const SUPPORTED_TENANT_PROFILE_SCHEMA_VERSION = 1;
const FALLBACK_TENANT_PROFILE: TenantProfile = {
  schema_version: SUPPORTED_TENANT_PROFILE_SCHEMA_VERSION,
  edition: "trafikskola",
};

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function fallbackTenantProfile(): TenantProfile {
  return { ...FALLBACK_TENANT_PROFILE };
}

export function normalizeCategoryRegistryEntries(value: unknown): CategoryRegistryEntry[] {
  if (!Array.isArray(value)) return [];

  const normalized: CategoryRegistryEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;

    const entry = raw as Record<string, unknown>;
    const id = normalizeRequiredString(entry.id);
    const label = normalizeRequiredString(entry.label);
    const icon = normalizeRequiredString(entry.icon);
    if (!id || !label || !icon) continue;

    normalized.push({
      id,
      label,
      icon,
      active: entry.active !== false,
    });
  }

  return normalized;
}

export function normalizeTenantProfile(value: unknown): TenantProfile {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
    return fallbackTenantProfile();
  }

  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return fallbackTenantProfile();
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallbackTenantProfile();
  }

  const profile = parsed as Record<string, unknown>;
  if (
    !Number.isInteger(profile.schema_version)
    || profile.schema_version !== SUPPORTED_TENANT_PROFILE_SCHEMA_VERSION
  ) {
    return fallbackTenantProfile();
  }

  const edition = normalizeRequiredString(profile.edition);
  if (!edition) return fallbackTenantProfile();

  return {
    schema_version: SUPPORTED_TENANT_PROFILE_SCHEMA_VERSION,
    edition,
  };
}
