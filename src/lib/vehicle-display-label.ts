type CategoryChoice = { label: string; value: string };

const FALLBACK_VEHICLE_LABELS: Record<string, string> = {
  BIL: "Bil",
  MC: "MC",
  AM: "Moped",
  LASTBIL: "Tung trafik",
  SLÄP: "Släp",
};

export function getVehicleDisplayLabel(
  categoryChoices: readonly CategoryChoice[],
  vehicle: string | null | undefined,
): string {
  const value = String(vehicle || "");
  if (!value) return "";
  return categoryChoices.find((choice) => choice.value === value)?.label
    || FALLBACK_VEHICLE_LABELS[value]
    || value;
}
