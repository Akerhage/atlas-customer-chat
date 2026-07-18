import type { TenantProfile } from './tenant-capabilities';

export const STANDARD_ESCALATE_VALUE = 'standard:escalate';
export const STANDARD_UNIT_PREFIX = 'standard:unit-choice:';
export const STANDARD_CATEGORY_PREFIX = 'standard:category-choice:';
export const STANDARD_MENU_PREFIX = 'standard:menu-choice:';
export const STANDARD_CENTRAL_SUPPORT = '__central_support__';
export const STANDARD_EMPTY_MESSAGE =
  'Vi har ingen direktinformation för detta val ännu. Du kan skapa ett ärende så hjälper vi dig.';

export type StandardSelfserviceStage = 'unit' | 'category' | 'menu' | null;

export interface StandardSelfserviceAction {
  type: 'category_overview' | 'offering' | 'unit_info' | 'fact';
  unit_id: string;
  category_id: string;
  offering_id?: string;
  fact_id?: number;
}

export interface StandardSelfserviceMenuItem {
  id: string;
  label: string;
  action: StandardSelfserviceAction;
}

export function isStandardSelfserviceEnabled(
  profile: TenantProfile | null | undefined,
  intakeMode: string
): boolean {
  return profile?.edition === 'standard' &&
    profile?.modules?.structured_answers === true &&
    intakeMode === 'category_first';
}

export function withEscalationChoice(
  items: StandardSelfserviceMenuItem[]
): { label: string; value: string }[] {
  return [
    ...items.map(item => ({ label: item.label, value: `${STANDARD_MENU_PREFIX}${item.id}` })),
    { label: 'Jag behöver mer hjälp – skapa ärende', value: STANDARD_ESCALATE_VALUE }
  ];
}

export function unitChoiceValue(unitId: string): string {
  return `${STANDARD_UNIT_PREFIX}${unitId}`;
}

export function categoryChoiceValue(categoryId: string): string {
  return `${STANDARD_CATEGORY_PREFIX}${categoryId}`;
}

export function valueAfterPrefix(value: string, prefix: string): string | null {
  return value.startsWith(prefix) && value.length > prefix.length
    ? value.slice(prefix.length)
    : null;
}
