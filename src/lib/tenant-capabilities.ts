export interface CategoryRegistryEntry {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

export interface EffectiveCategory {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

export interface TenantProfileLabels {
  unit?: string;
  category?: string;
  offering?: string;
}

export interface TenantProfileModules {
  structured_answers?: boolean;
  industry_rag?: boolean;
  booking_links?: boolean;
  campaigns?: boolean;
}

export interface TenantProfileIntake {
  mode: string;
}

export interface TenantProfile {
  schema_version: number;
  edition: string;
  labels?: TenantProfileLabels;
  modules?: TenantProfileModules;
  intake?: TenantProfileIntake;
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

export function resolveEffectiveCategories(
  profile: TenantProfile,
  registryValue: unknown,
  activeVehicles: readonly string[]
): EffectiveCategory[] {
  try {
    const registry = normalizeCategoryRegistryEntries(registryValue);
    if (profile?.edition === "standard" && registry.length > 0) return registry;
    if (!Array.isArray(activeVehicles)) return [];

    return activeVehicles.map((vehicle) => {
      const id = String(vehicle);
      return { id, label: id, icon: id, active: true };
    });
  } catch {
    return [];
  }
}

function warnOmitted(field: string, reason: string): void {
  console.warn(`⚠️ [TenantProfile] utelämnar ${field}: ${reason}`);
}

export function normalizeLabels(value: unknown): TenantProfileLabels | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnOmitted("labels", "måste vara ett objekt");
    return undefined;
  }
  const normalized: TenantProfileLabels = {};
  const allowed = new Set(["unit", "category", "offering"]);
  const labels = value as Record<string, unknown>;
  for (const key of Object.keys(labels)) {
    if (!allowed.has(key)) warnOmitted(`labels.${key}`, "okänd nyckel");
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(labels, key)) continue;
    const label = labels[key];
    if (typeof label !== "string" || !label.trim()) {
      warnOmitted(`labels.${key}`, "måste vara en icke-tom sträng");
      continue;
    }
    normalized[key] = label.trim();
  }
  return normalized;
}

export function normalizeModules(value: unknown): TenantProfileModules | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnOmitted("modules", "måste vara ett objekt");
    return undefined;
  }
  const normalized: TenantProfileModules = {};
  const modules = value as Record<string, unknown>;
  for (const key of ["structured_answers", "industry_rag", "booking_links", "campaigns"] as const) {
    if (!Object.prototype.hasOwnProperty.call(modules, key)) continue;
    if (typeof modules[key] !== "boolean") {
      warnOmitted(`modules.${key}`, "måste vara boolean");
      continue;
    }
    normalized[key] = modules[key];
  }
  return normalized;
}

export function normalizeIntake(value: unknown): TenantProfileIntake | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnOmitted("intake", "måste vara ett objekt");
    return undefined;
  }
  const intake = value as Record<string, unknown>;
  if (typeof intake.mode !== "string" || !intake.mode.trim()) {
    warnOmitted("intake.mode", "måste vara en icke-tom sträng");
    return undefined;
  }
  return { mode: intake.mode.trim() };
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

  const normalized: TenantProfile = {
    schema_version: SUPPORTED_TENANT_PROFILE_SCHEMA_VERSION,
    edition,
  };
  if (Object.prototype.hasOwnProperty.call(profile, "labels")) {
    const labels = normalizeLabels(profile.labels);
    if (labels !== undefined) normalized.labels = labels;
  }
  if (Object.prototype.hasOwnProperty.call(profile, "modules")) {
    const modules = normalizeModules(profile.modules);
    if (modules !== undefined) normalized.modules = modules;
  }
  if (Object.prototype.hasOwnProperty.call(profile, "intake")) {
    const intake = normalizeIntake(profile.intake);
    if (intake !== undefined) normalized.intake = intake;
  }
  return normalized;
}
