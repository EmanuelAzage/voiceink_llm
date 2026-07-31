import { isValidIsoDate } from './date';

export interface ExtractedActionItem {
  text: string;
  dueDate?: string;
}

export interface ExtractedCard {
  title: string;
  summary: string;
  tags: string[];
  actionItems: ExtractedActionItem[];
}

const MAX_TAGS = 5;

/**
 * Single source of truth for the extraction shape. Sent to the LLM as a
 * function/tool parameters schema (see extraction.ts) and used again below
 * to validate whatever comes back. No `additionalProperties` here: Gemini's
 * Schema object rejects that field outright (confirmed live — HTTP 400,
 * "Unknown name additionalProperties: Cannot find field"), so this file's
 * own validator below is the actual enforcement point, not the wire schema.
 */
export const cardJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short title for the note, 5 words or fewer' },
    summary: { type: 'string', description: 'One or two sentence summary of the transcript' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: `Up to ${MAX_TAGS} short topical tags`,
    },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The action item text' },
          dueDate: {
            type: 'string',
            description:
              'ISO-8601 date (YYYY-MM-DD), only if a specific or relative date was mentioned',
          },
        },
        required: ['text'],
      },
    },
  },
  required: ['title', 'summary', 'tags', 'actionItems'],
} as const;

export function validateExtractedCard(value: unknown): ExtractedCard | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v.title !== 'string' || typeof v.summary !== 'string') return null;
  if (!Array.isArray(v.tags) || !v.tags.every(t => typeof t === 'string')) return null;
  if (!Array.isArray(v.actionItems)) return null;

  const actionItems: ExtractedActionItem[] = [];
  for (const item of v.actionItems) {
    if (typeof item !== 'object' || item === null) return null;
    const i = item as Record<string, unknown>;
    if (typeof i.text !== 'string') return null;

    // A malformed dueDate (wrong type, wrong format, or a real-looking but
    // nonexistent date like "2026-02-30") drops just the date rather than
    // rejecting the whole card — seen in practice from a weaker model
    // returning garbage like `"dueDate": "text:"` alongside otherwise-good
    // extraction; losing one due date is a much smaller failure than losing
    // the whole card to a retry/fallback over one bad field.
    const dueDate = typeof i.dueDate === 'string' && isValidIsoDate(i.dueDate) ? i.dueDate : undefined;
    actionItems.push(dueDate === undefined ? { text: i.text } : { text: i.text, dueDate });
  }

  return {
    title: v.title,
    summary: v.summary,
    tags: (v.tags as string[]).slice(0, MAX_TAGS),
    actionItems,
  };
}
