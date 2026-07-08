export function titleCasePlace(value: string): string {
return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function formatCityAreaLabel(city: string | null | undefined, area: string | null | undefined): string | null {
if (!city) return null;
const cityLabel = titleCasePlace(city);
const areaLabel = area ? titleCasePlace(area) : null;
return areaLabel ? `${cityLabel} - ${areaLabel}` : cityLabel;
}
