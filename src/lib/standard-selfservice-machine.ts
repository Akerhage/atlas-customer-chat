import type { TenantProfile } from './tenant-capabilities';

export const STANDARD_ESCALATE_VALUE = 'standard:escalate';
export const STANDARD_UNIT_PREFIX = 'standard:unit-choice:';
export const STANDARD_CATEGORY_PREFIX = 'standard:category-choice:';
export const STANDARD_MENU_PREFIX = 'standard:menu-choice:';
export const STANDARD_CENTRAL_SUPPORT = '__central_support__';
// K7/C (Patrik-beslut 2026-07-25): kunden ska inte behöva förstå ordet
// "Centralsupport" — det är ett internt begrepp, och chippet är ingen enhet utan
// en utväg för den som inte vet vilken enhet frågan hör till. Endast ETIKETTEN
// byts; värdet STANDARD_CENTRAL_SUPPORT ger fortfarande office = NULL, vilket är
// det som får ärendet att hamna i Inkorgen (routes/team.js:388-405, dokumenterat
// avsiktlig design). Rör inte värdet.
export const STANDARD_CENTRAL_SUPPORT_LABEL = 'Vet inte / allmän fråga';
export const STANDARD_EMPTY_MESSAGE =
  'Vi har ingen direktinformation för detta val ännu. Du kan skapa ett ärende så hjälper vi dig.';
export const STANDARD_UNIT_PROMPT = 'Välj vem du vill ha hjälp av.';
export const STANDARD_EMPTY_CATEGORY_MESSAGE =
  'Det här valet har inga kategorier ännu. Skapa ett ärende så hjälper vi dig vidare.';

export type StandardSelfserviceStage = 'unit' | 'category' | 'menu' | null;

export interface StandardSelfserviceAction {
  type: 'category_overview' | 'category_info' | 'offering' | 'unit_info' | 'fact';
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

// L-021 (Patrik 2026-08-07): en trafikskola som stänger av Branschkunskap ska få
// den klickbara prisvägen. Widgeten bar en EGEN editionsgrind utöver serverns —
// utan denna ändring hade den aldrig ens frågat, hur öppen servern än var.
//
// 🔴 intakeMode lämnas medvetet ORÖRD. resolveIntakeMode (intake-machine.ts:96)
// ger Trafik 'legacy' alltid, och det ska den fortsätta göra: intakeMode styr hela
// intake-ordningen och snabbfrågeknappen, så att flippa den hade byggt om
// kundflödet för VARJE trafikskola — även de med branschkunskapen PÅ. Rätt lösning
// är att frikoppla självservicen från intakeMode, inte att ändra intakeMode.
export function isStandardSelfserviceEnabled(
  profile: TenantProfile | null | undefined,
  intakeMode: string
): boolean {
  // Opt-in: frånvarande/ogiltig flagga ⇒ AV. Box1-3 saknar profil och ska aldrig
  // få den publika självservicevägen.
  if (profile?.modules?.structured_answers !== true) return false;
  // Standard: oförändrat kontrakt (edition + category_first).
  if (profile?.edition === 'standard') return intakeMode === 'category_first';
  // Övriga editioner kör deterministiskt läge när branschkunskapen är explicit AV.
  return profile?.modules?.industry_rag === false;
}

export function withEscalationChoice(
  items: StandardSelfserviceMenuItem[]
): { label: string; value: string; fullWidth?: boolean }[] {
  return withEscalationValue(items.map(item => ({ label: item.label, value: menuChoiceValue(item.id) })));
}

export function withEscalationValue<T extends { label: string; value: string }>(
  choices: readonly T[]
): { label: string; value: string; fullWidth?: boolean }[] {
  return [
    ...choices.map(choice => ({ label: choice.label, value: choice.value, fullWidth: true })),
    { label: 'Jag behöver mer hjälp – skapa ärende', value: STANDARD_ESCALATE_VALUE, fullWidth: true }
  ];
}

export function menuChoiceValue(itemId: string): string {
  return `${STANDARD_MENU_PREFIX}${itemId}`;
}

export function shouldShowStandardSelfserviceMenu({
  stage,
  humanMode,
  intakeActive,
  isArchived,
}: {
  stage: StandardSelfserviceStage;
  humanMode: boolean;
  intakeActive: boolean;
  isArchived: boolean;
}): boolean {
  return stage === 'menu' && !humanMode && !intakeActive && !isArchived;
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
