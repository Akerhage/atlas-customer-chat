type Choice = { label: string; value: string };
type CategoryChoice = { label: string; value: string };

export function mapChoiceValueToDisplayLabel(value: string, choices: Choice[]): string {
  const match = choices.find((choice) => choice.value === value);
  return match?.label || value;
}

export function buildOfficeMenuQuestion(unitWord: string | null | undefined): string {
  const word = String(unitWord || '').trim().toLocaleLowerCase('sv-SE') || 'enhet';
  return `Välj ${word}.`;
}

function getCategoryLabelForValue(categoryChoices: CategoryChoice[], value: string | null | undefined): string | null {
  if (!value) return null;
  const match = categoryChoices.find((choice) => choice.value === value);
  return match?.label || value;
}

export function buildLockedContextSyncToast(options: {
  cityLabel: string;
  nextVehicle: string | null | undefined;
  previousVehicle: string | null | undefined;
  vehicleWasSetByThisSync: boolean;
  categoryChoices: CategoryChoice[];
}): string {
  const city = options.cityLabel.trim();
  const parts = [city];
  const vehicleLabel = options.vehicleWasSetByThisSync
    ? getCategoryLabelForValue(options.categoryChoices, options.nextVehicle)
    : null;
  if (vehicleLabel) parts.push(vehicleLabel);
  return `Vi har anpassat dina val till ${parts.join(' och ')}.`;
}
