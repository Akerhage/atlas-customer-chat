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

// De fem motornycklarna. Deras synlighet ägs av `active_vehicles` (L-011/#313) och
// får ALDRIG kunna återaktiveras via kategoriregistret — därför är listan komplett här
// och inte härledd ur de just nu aktiva. Speglar `CANONICAL_VEHICLE_ORDER` i
// vehicle-utils.ts; hålls som egen konstant för att undvika en cirkulär import.
const MOTOR_VEHICLE_KEYS = new Set(["AM", "BIL", "MC", "LASTBIL", "SLÄP"]);

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
    if (profile?.edition === "standard") {
      if (registry.length > 0) return registry;
      if (Array.isArray(registryValue) && registryValue.length === 0) return [];
    }
    if (!Array.isArray(activeVehicles)) return [];

    // #323 (Patriks IRL-fynd 2026-08-18, livebevisat på Box3 OCH sandbox): utanför
    // Standard kastades registret bort helt och etiketten sattes till kategorins ID,
    // så kunden läste `BIL` i stället för `Bil`. Det motsäger L-011/#313, som gav en
    // trafikskola rätt att döpa om sina kategorier.
    //
    // 🔴 Vilka kategorier som är AKTIVA ägs fortfarande av `activeVehicles` här —
    // det är den editionsgrenade skrivaren (L-011/#313: Trafik läser active_vehicles,
    // Standard läser category_registry.active). Endast ETIKETTEN och IKONEN hämtas ur
    // registret, och bara när registret faktiskt känner till id:t. Saknas posten
    // faller vi tillbaka på id:t precis som förut.
    const registryById = new Map(registry.map((entry) => [entry.id, entry]));
    const vehicleCategories = activeVehicles.map((vehicle) => {
      const id = String(vehicle);
      const known = registryById.get(id);
      return { id, label: known?.label || id, icon: known?.icon || id, active: true };
    });

    // #331 (Patriks beslut 2026-08-19): en trafikskola ska kunna skapa EGNA kategorier
    // och nå kunden med dem — *"oavsett standard eller trafik så skall det inte vara
    // problem att skapa egna nya kategorier"*.
    //
    // 🔴 Ägarskapet delas, det byts INTE: de fem fordonsnycklarna ägs fortfarande av
    // `activeVehicles` (L-011/#313), medan en EGEN kategori äger sin egen `active`.
    // Det är den enda uppdelning som fungerar — en fri kategori står inte i
    // `active_vehicles` och skulle annars aldrig kunna visas.
    //
    // Livemätt varför raden behövs: efter att servern släppte igenom `EKONOMI` på Box3
    // gav `categories_offered` `["BIL","MC","EKONOMI"]` och menyn 3 rader, men kundens
    // kategoriväljare visade bara `["Bil","MC"]` — widgeten härledde listan ur
    // `activeVehicles` och kände inte till kategorin alls.
    // 🔴🔴 Uteslutningen måste gå på ALLA FEM motornycklarna, inte bara de aktiva.
    // Första versionen filtrerade på `vehicleCategories` — då kom en AVAKTIVERAD
    // fordonstyp tillbaka som "egen kategori", vilket river L-011/#313:s regel.
    // Fångat av kontraktet `never lets the registry re-activate a vehicle that
    // active_vehicles omits` innan det nådde någon box.
    const ownCategories = registry.filter(
      (entry) => !MOTOR_VEHICLE_KEYS.has(entry.id) && entry.active !== false
    );
    return [...vehicleCategories, ...ownCategories];
  } catch {
    return [];
  }
}

// Kundvända ord i chattens kontrollrad. Tenantens egna labels vinner när de finns
// — Box4 levererar {unit:"Avdelning", category:"Kategori"} — men Box3 och sandbox
// levererar INGA labels alls (mätt 2026-08-19 mot /api/tenant-name på alla fem
// boxar). Trafikskolornas ord måste därför komma härifrån och inte från profilen,
// annars står det "Avdelning" hos en trafikskola som alltid sagt "Kontor".
export function resolveChatUnitWord(profile: TenantProfile | null | undefined): string {
  const own = normalizeRequiredString(profile?.labels?.unit);
  if (own) return own;
  return profile?.edition === "standard" ? "Avdelning" : "Kontor";
}

export function resolveChatCategoryWord(profile: TenantProfile | null | undefined): string {
  const own = normalizeRequiredString(profile?.labels?.category);
  if (own) return own;
  return profile?.edition === "standard" ? "Kategori" : "Fordonstyp";
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
