import { describe, expect, it } from 'vitest';
import {
  STANDARD_EMPTY_CATEGORY_MESSAGE,
  STANDARD_UNIT_PROMPT,
  STANDARD_ESCALATE_VALUE,
  STANDARD_MENU_PREFIX,
  categoryChoiceValue,
  isStandardSelfserviceAvailable,
  isStandardSelfserviceEnabled,
  isStandardSelfserviceExclusive,
  shouldBlockSelfserviceFreeText,
  menuChoiceValue,
  shouldShowStandardSelfserviceMenu,
  unitChoiceValue,
  valueAfterPrefix,
  withEscalationChoice,
  withEscalationValue,
} from './standard-selfservice-machine';
import type { StandardSelfserviceAction } from './standard-selfservice-machine';

describe('standard selfservice machine', () => {
  it('exports the customer-facing Standard unit, empty-category and recipient copy', () => {
    expect(STANDARD_UNIT_PROMPT).toBe('Välj vem du vill ha hjälp av.');
    expect(STANDARD_EMPTY_CATEGORY_MESSAGE).toBe(
      'Det här valet har inga kategorier ännu. Skapa ett ärende så hjälper vi dig vidare.'
    );
  });

  it('separates the clickable selfservice path from exclusive free-text blocking', () => {
    const standard = {
      schema_version: 1,
      edition: 'standard',
      modules: { structured_answers: true },
      intake: { mode: 'category_first' },
    } as const;
    const trafficRagOff = {
      schema_version: 1,
      edition: 'trafikskola',
      modules: { structured_answers: true, industry_rag: false },
    } as const;
    const trafficRagOn = {
      schema_version: 1,
      edition: 'trafikskola',
      modules: { structured_answers: true, industry_rag: true },
    } as const;
    const profileless = null;

    expect(isStandardSelfserviceAvailable(standard, 'category_first')).toBe(true);
    expect(isStandardSelfserviceAvailable({ ...standard, intake: { mode: 'legacy' } }, 'legacy')).toBe(false);
    expect(isStandardSelfserviceAvailable({
      ...standard,
      modules: { structured_answers: false },
    }, 'category_first')).toBe(false);
    expect(isStandardSelfserviceAvailable(trafficRagOff, 'legacy')).toBe(true);
    expect(isStandardSelfserviceAvailable(trafficRagOn, 'legacy')).toBe(true);
    expect(isStandardSelfserviceAvailable(profileless, 'legacy')).toBe(false);

    expect(isStandardSelfserviceExclusive(standard, 'category_first')).toBe(true);
    expect(isStandardSelfserviceExclusive(trafficRagOff, 'legacy')).toBe(true);
    expect(isStandardSelfserviceExclusive(trafficRagOn, 'legacy')).toBe(false);
    expect(isStandardSelfserviceExclusive(profileless, 'legacy')).toBe(false);

    expect(isStandardSelfserviceEnabled(trafficRagOn, 'legacy')).toBe(false);
  });

  it.each([
    { available: true, exclusive: false, aiRepliesEnabled: true, expected: false },
    { available: true, exclusive: false, aiRepliesEnabled: false, expected: true },
    { available: true, exclusive: true, aiRepliesEnabled: true, expected: true },
    { available: false, exclusive: false, aiRepliesEnabled: true, expected: false },
  ])(
    'blocks free text only for an available selfservice path without a valid answer engine %#',
    ({ available, exclusive, aiRepliesEnabled, expected }) => {
      expect(shouldBlockSelfserviceFreeText({
        available,
        exclusive,
        aiRepliesEnabled,
        humanMode: false,
        intakeActive: false,
      })).toBe(expected);
    }
  );

  it('keeps free text available during escalation intake and human support', () => {
    expect(shouldBlockSelfserviceFreeText({
      available: true,
      exclusive: false,
      aiRepliesEnabled: false,
      humanMode: true,
      intakeActive: false,
    })).toBe(false);
    expect(shouldBlockSelfserviceFreeText({
      available: true,
      exclusive: false,
      aiRepliesEnabled: false,
      humanMode: false,
      intakeActive: true,
    })).toBe(false);
  });

  it('uses opaque prefixed values and keeps escalation last', () => {
    const choices = withEscalationChoice([{
      id: 'opaque-1',
      label: 'Vad kostar produkten?',
      action: {
        type: 'offering',
        unit_id: 'unit',
        category_id: 'category',
        offering_id: 'offering',
      },
    }]);
    expect(choices).toEqual([
      { label: 'Vad kostar produkten?', value: `${STANDARD_MENU_PREFIX}opaque-1`, fullWidth: true },
      { label: 'Jag behöver mer hjälp – skapa ärende', value: STANDARD_ESCALATE_VALUE, fullWidth: true },
    ]);
  });

  it('accepts the backend category-info action in the shared contract', () => {
    const action: StandardSelfserviceAction = {
      type: 'category_info',
      unit_id: 'unit',
      category_id: 'category',
    };
    expect(action.type).toBe('category_info');
  });

  it('can append the same escalation choice to arbitrary label/value choices', () => {
    expect(withEscalationValue([{ label: 'Kategori 7', value: 'standard:category-choice:KAT7' }])).toEqual([
      { label: 'Kategori 7', value: 'standard:category-choice:KAT7', fullWidth: true },
      { label: 'Jag behöver mer hjälp – skapa ärende', value: STANDARD_ESCALATE_VALUE, fullWidth: true },
    ]);
  });

  it('round-trips unit and category choice ids without label guessing', () => {
    expect(valueAfterPrefix(unitChoiceValue('unit_1'), 'standard:unit-choice:')).toBe('unit_1');
    expect(valueAfterPrefix(categoryChoiceValue('MUTTRAR'), 'standard:category-choice:')).toBe('MUTTRAR');
    expect(valueAfterPrefix('wrong', 'standard:category-choice:')).toBeNull();
  });

  it('builds opaque menu choices through the shared prefix helper', () => {
    expect(menuChoiceValue('opaque-1')).toBe(`${STANDARD_MENU_PREFIX}opaque-1`);
  });

  it('shows the input menu only in the active non-human menu stage', () => {
    expect(shouldShowStandardSelfserviceMenu({
      stage: 'menu', humanMode: false, intakeActive: false, isArchived: false,
    })).toBe(true);
    expect(shouldShowStandardSelfserviceMenu({
      stage: 'category', humanMode: false, intakeActive: false, isArchived: false,
    })).toBe(false);
    expect(shouldShowStandardSelfserviceMenu({
      stage: 'menu', humanMode: true, intakeActive: false, isArchived: false,
    })).toBe(false);
    expect(shouldShowStandardSelfserviceMenu({
      stage: 'menu', humanMode: false, intakeActive: true, isArchived: false,
    })).toBe(false);
    expect(shouldShowStandardSelfserviceMenu({
      stage: 'menu', humanMode: false, intakeActive: false, isArchived: true,
    })).toBe(false);
  });
});
