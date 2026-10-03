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

export function buildVehicleDisplayOptions<T extends string>(
  categoryChoices: readonly CategoryChoice[],
  activeVehicles: readonly T[],
): { value: T; label: string }[] {
  return [
    ...categoryChoices
      .filter((choice) => activeVehicles.includes(choice.value as T))
      .map((choice) => ({ value: choice.value as T, label: choice.label })),
    ...activeVehicles
      .filter((vehicle) => !categoryChoices.some((choice) => choice.value === vehicle))
      .map((vehicle) => ({
        value: vehicle,
        label: getVehicleDisplayLabel(categoryChoices, vehicle),
      })),
  ];
}
