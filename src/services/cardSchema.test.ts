import { cardJsonSchema, validateExtractedCard } from './cardSchema';

describe('cardJsonSchema', () => {
  it('never sends additionalProperties — Gemini rejects that field with HTTP 400', () => {
    // Regression guard for the bug this schema's own comment documents:
    // confirmed live against the real API that Gemini's Schema object
    // rejects `additionalProperties` outright.
    expect(JSON.stringify(cardJsonSchema)).not.toContain('additionalProperties');
  });

  it('requires exactly the four top-level fields', () => {
    expect(cardJsonSchema.required).toEqual(['title', 'summary', 'tags', 'actionItems']);
  });
});

describe('validateExtractedCard', () => {
  const validCard = {
    title: 'Call Dentist',
    summary: 'The user needs to call the dentist.',
    tags: ['Dentist', 'Reminder'],
    actionItems: [{ text: 'call the dentist', dueDate: '2026-07-31' }],
  };

  it('accepts a fully valid card', () => {
    expect(validateExtractedCard(validCard)).toEqual(validCard);
  });

  it('accepts action items with no dueDate, and omits the key rather than setting it undefined', () => {
    const card = { ...validCard, actionItems: [{ text: 'pick up dry cleaning' }] };
    const result = validateExtractedCard(card);
    expect(result?.actionItems).toEqual([{ text: 'pick up dry cleaning' }]);
    expect(result?.actionItems[0]).not.toHaveProperty('dueDate');
  });

  it('caps tags at 5, keeping only the first 5', () => {
    const card = { ...validCard, tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
    expect(validateExtractedCard(card)?.tags).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('strips unknown top-level fields rather than rejecting the whole card', () => {
    const card = { ...validCard, extraField: 'should be dropped' };
    const result = validateExtractedCard(card);
    expect(result).toEqual(validCard);
    expect(result).not.toHaveProperty('extraField');
  });

  it.each([
    ['null', null],
    ['a string', 'not an object'],
    ['undefined', undefined],
    ['a number', 42],
  ])('rejects %s as the top-level value', (_label, value) => {
    expect(validateExtractedCard(value)).toBeNull();
  });

  it('rejects a missing title', () => {
    const { summary, tags, actionItems } = validCard;
    expect(validateExtractedCard({ summary, tags, actionItems })).toBeNull();
  });

  it('rejects a non-string title', () => {
    expect(validateExtractedCard({ ...validCard, title: 42 })).toBeNull();
  });

  it('rejects a missing summary', () => {
    const { title, tags, actionItems } = validCard;
    expect(validateExtractedCard({ title, tags, actionItems })).toBeNull();
  });

  it('rejects tags that is not an array', () => {
    expect(validateExtractedCard({ ...validCard, tags: 'Dentist' })).toBeNull();
  });

  it('rejects a tags array containing a non-string element', () => {
    expect(validateExtractedCard({ ...validCard, tags: ['Dentist', 42] })).toBeNull();
  });

  it('rejects actionItems that is not an array', () => {
    expect(validateExtractedCard({ ...validCard, actionItems: 'call the dentist' })).toBeNull();
  });

  it('rejects an action item missing text', () => {
    expect(validateExtractedCard({ ...validCard, actionItems: [{ dueDate: '2026-07-31' }] })).toBeNull();
  });

  it('rejects an action item whose text is not a string', () => {
    expect(validateExtractedCard({ ...validCard, actionItems: [{ text: 42 }] })).toBeNull();
  });

  it('drops a non-string dueDate but keeps the action item', () => {
    const result = validateExtractedCard({
      ...validCard,
      actionItems: [{ text: 'call the dentist', dueDate: 20260731 }],
    });
    expect(result?.actionItems).toEqual([{ text: 'call the dentist' }]);
  });

  it.each([
    ['garbage text', 'text:'],
    ['wrong separator', '2026/07/31'],
    ['unpadded month/day', '2026-7-31'],
    ['nonexistent day (Feb 30)', '2026-02-30'],
    ['nonexistent month', '2026-13-01'],
  ])('drops a malformed dueDate (%s) but keeps the action item', (_label, badDueDate) => {
    const result = validateExtractedCard({
      ...validCard,
      actionItems: [{ text: 'call the dentist', dueDate: badDueDate }],
    });
    expect(result?.actionItems).toEqual([{ text: 'call the dentist' }]);
  });

  it('keeps a valid dueDate on a leap day', () => {
    const result = validateExtractedCard({
      ...validCard,
      actionItems: [{ text: 'call the dentist', dueDate: '2028-02-29' }],
    });
    expect(result?.actionItems).toEqual([{ text: 'call the dentist', dueDate: '2028-02-29' }]);
  });

  it('rejects a non-object action item', () => {
    expect(validateExtractedCard({ ...validCard, actionItems: ['call the dentist'] })).toBeNull();
  });
});
