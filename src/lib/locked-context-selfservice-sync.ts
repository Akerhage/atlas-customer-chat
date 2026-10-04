export interface LockedContextOffice {
  routing_tag: string;
  name?: string | null;
  display_name?: string | null;
  city?: string | null;
  area?: string | null;
  categories_offered?: string[];
}

export interface LockedContextSelfserviceState {
  selfserviceUnitId: string | null;
  selfserviceUnitLabel: string | null;
  selectedCity: string | null;
  selectedCategoryId: string | null;
  selectedVehicle: string | null;
}

export interface LockedContextValue {
  unit_id?: string | null;
  city?: string | null;
  area?: string | null;
  vehicle?: string | null;
  vehicle_choice?: string | null;
}

export function getOfficeDisplayName(office: Partial<LockedContextOffice>): string {
  const city = String(office.city || '').trim();
  const area = String(office.area || '').trim();
  return String(
    office.display_name
      || (city ? (area ? `${city} - ${area}` : city) : '')
      || office.name
      || office.routing_tag
      || ''
  ).trim();
}

function normalizeOfficeKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s*-\s*/g, ' - ')
    .toLocaleLowerCase('sv-SE');
}

function findExactLockedOffice(
  offices: readonly LockedContextOffice[],
  lockedContext: LockedContextValue,
  currentUnitId: string | null
): LockedContextOffice | null {
  const requestedUnitId = String(lockedContext.unit_id || '').trim();
  if (requestedUnitId) {
    return offices.find((office) => office.routing_tag === requestedUnitId) || null;
  }

  const city = normalizeOfficeKey(lockedContext.city);
  const area = normalizeOfficeKey(lockedContext.area);
  if (city || area) {
    const matches = offices.filter((office) => {
      if (normalizeOfficeKey(office.city) !== city) return false;
      return area ? normalizeOfficeKey(office.area) === area : true;
    });
    return matches.length === 1 ? matches[0] : null;
  }

  return currentUnitId
    ? offices.find((office) => office.routing_tag === currentUnitId) || null
    : null;
}

export function resolveLockedContextSelfserviceSync({
  edition,
  offices,
  current,
  lockedContext,
}: {
  edition: string | null | undefined;
  offices: readonly LockedContextOffice[];
  current: LockedContextSelfserviceState;
  lockedContext: LockedContextValue;
}) {
  const office = findExactLockedOffice(offices, lockedContext, current.selfserviceUnitId);
  if (!office) return null;

  const offered = Array.isArray(office.categories_offered)
    ? new Set(office.categories_offered.map((value) => String(value || '').trim()).filter(Boolean))
    : null;
  const lockedVehicle = String(lockedContext.vehicle || '').trim() || null;
  const clearsVehicle = lockedContext.vehicle_choice === 'OVRIGT';
  const currentCategoryIsOffered = current.selectedCategoryId
    && (!offered || offered.has(current.selectedCategoryId));
  const selectedCategoryId = edition === 'standard'
    ? current.selectedCategoryId
    : (lockedVehicle || (clearsVehicle ? null : (currentCategoryIsOffered ? current.selectedCategoryId : null)));
  const selectedVehicle = clearsVehicle
    ? null
    : (lockedVehicle || current.selectedVehicle);
  const unitLabel = getOfficeDisplayName(office);

  return {
    office,
    unitId: office.routing_tag,
    unitLabel,
    selectedCity: unitLabel,
    selectedCategoryId,
    selectedVehicle,
    menuUnitId: office.routing_tag,
    menuCategoryId: selectedCategoryId,
    escalationUnitLabel: unitLabel,
  };
}
