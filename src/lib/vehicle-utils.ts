import type { ActiveVehicle } from "@/lib/atlas-client";

export const CANONICAL_VEHICLE_ORDER: ActiveVehicle[] = ["AM", "BIL", "MC", "LASTBIL", "SLÄP"];

export const VEHICLE_LABELS: Record<ActiveVehicle, string> = {
AM: "Moped (AM)",
BIL: "Bil (B)",
MC: "Motorcykel",
LASTBIL: "Lastbil / Buss",
SLÄP: "Släp (BE/B96)",
};

export const VEHICLE_TO_SERVICE_LABEL: Record<ActiveVehicle, string> = {
BIL: "bil",
MC: "mc",
AM: "am",
LASTBIL: "lastbil",
SLÄP: "släp",
};

export function officeOffersVehicle(office: any, vehicle: ActiveVehicle): boolean {
const so = Array.isArray(office?.services_offered)
? office.services_offered.map((s: any) => String(s).toLowerCase().trim())
: [];
if (so.length === 0) return true;
const token = VEHICLE_TO_SERVICE_LABEL[vehicle];
const re = new RegExp(`(^|[\\s\\-/])${token}($|[\\s\\-/])`, 'i');
return so.some((s: string) => s === token || re.test(s));
}

export function resolveVehicleForOffice(
office: any,
vehicle: ActiveVehicle | null | undefined,
): ActiveVehicle | null {
if (!vehicle) return null;
return officeOffersVehicle(office, vehicle) ? vehicle : null;
}
