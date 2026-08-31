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
// #167: ordet är tenantens. Konstanten står kvar med Atlas standardord — den är
// defaulten och det värde kontrakten läser — medan byggaren används i chatten.
export const STANDARD_EMPTY_CATEGORY_MESSAGE =
  'Det här valet har inga kategorier ännu. Skapa ett ärende så hjälper vi dig vidare.';

export function buildStandardEmptyCategoryMessage(categoryPluralWord: string): string {
  const word = String(categoryPluralWord || '').trim();
  if (!word) return STANDARD_EMPTY_CATEGORY_MESSAGE;
  return `Det här valet har inga ${word.toLocaleLowerCase('sv-SE')} ännu. Skapa ett ärende så hjälper vi dig vidare.`;
}

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
export function isStandardSelfserviceAvailable(
  profile: TenantProfile | null | undefined,
  intakeMode: string
): boolean {
  // Opt-in: frånvarande/ogiltig flagga ⇒ AV. Box1-3 saknar profil och ska aldrig
  // få den publika självservicevägen.
  if (profile?.modules?.structured_answers !== true) return false;
  // Standard: oförändrat kontrakt (edition + category_first).
  if (profile?.edition === 'standard') return intakeMode === 'category_first';
  // L-021/#133: övriga editioner har den klickbara prisvägen när structured_answers är PÅ.
  return true;
}

export function isStandardSelfserviceExclusive(
  profile: TenantProfile | null | undefined,
  intakeMode: string
): boolean {
  if (!isStandardSelfserviceAvailable(profile, intakeMode)) return false;
  // Standard behåller dagens kategori-först-flöde och döljer fritext.
  if (profile?.edition === 'standard') return true;
  // Övriga editioner döljer fritext endast när branschkunskapen är explicit AV.
  return profile?.modules?.industry_rag === false;
}

export function isStandardSelfserviceEnabled(
  profile: TenantProfile | null | undefined,
  intakeMode: string
): boolean {
  return isStandardSelfserviceExclusive(profile, intakeMode);
}

// #285: tillgänglig självservice ska vara kundens första väg när ingen
// fungerande fritextmotor finns. Håll detta skilt från
// isStandardSelfserviceExclusive(): den funktionen beskriver edition/modul,
// medan detta även behöver den aktuella AI-, human- och intake-state som bara
// widgeten känner till.
export function shouldBlockSelfserviceFreeText({
  available,
  exclusive,
  aiRepliesEnabled,
  humanMode,
  intakeActive,
}: {
  available: boolean;
  exclusive: boolean;
  aiRepliesEnabled: boolean;
  humanMode: boolean;
  intakeActive: boolean;
}): boolean {
  return available && (exclusive || !aiRepliesEnabled) && !humanMode && !intakeActive;
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

// #324 (Patriks IRL-fynd 2026-08-18): skiljer ett STEG från ett SLUTVAL.
//
// Enhets- och kategorivalet väljer bara vad frågorna ska handla om — de skickar
// ingenting till chatten. Först en menyrad eller en eskalering producerar ett svar.
// Snabbfrågepanelen stängde sig efter varje val, även efter ett steg, och lämnade då
// kunden utan återkoppling och utan synligt nästa steg (mätt: inget chattmeddelande,
// ingen kategoriknapp, panelen tom och stängd).
//
// 🔴 Predikatet bor HÄR och inte i komponenten, därför att prefixen bor här. Läggs det
// i komponenten kan de två glida isär utan att något test märker det.
export function isStandardStageChoice(value: string): boolean {
  return value.startsWith(STANDARD_UNIT_PREFIX) || value.startsWith(STANDARD_CATEGORY_PREFIX);
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
