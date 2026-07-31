import Config from 'react-native-config';
import { cardJsonSchema, validateExtractedCard, type ExtractedCard } from './cardSchema';
import { toLocalIsoDate } from './date';

const TIMEOUT_MS = 15000;
const FUNCTION_NAME = 'extract_card';
const MAX_ATTEMPTS = 2; // one schema-conformance retry per architecture.md

export type ExtractionResult =
  | { status: 'success'; card: ExtractedCard }
  | { status: 'error'; reason: 'timeout' | 'network' | 'invalid-response' };

interface GeminiFunctionCall {
  name: string;
  args: unknown;
}
interface GeminiPart {
  functionCall?: GeminiFunctionCall;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

function buildRequestBody(transcript: string, today: string, retryHint?: string) {
  const instruction = [
    `Extract a structured note from this transcript. Today's date is ${today}; resolve relative dates ("tomorrow", "next Friday") to ISO-8601 dates.`,
    retryHint,
    `Transcript:\n${transcript}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    tools: [
      {
        functionDeclarations: [
          {
            name: FUNCTION_NAME,
            description: 'Structured note extracted from a spoken transcript',
            parameters: cardJsonSchema,
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [FUNCTION_NAME] },
    },
  };
}

async function callGemini(transcript: string, today: string, retryHint?: string): Promise<unknown> {
  const apiKey = Config.GEMINI_API_KEY;
  const model = Config.GEMINI_MODEL;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set — see .env.example');
  if (!model) throw new Error('GEMINI_MODEL is not set — see .env.example');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(transcript, today, retryHint)),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as GeminiResponse;
    const part = json.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
    return part?.functionCall?.args;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractCard(transcript: string): Promise<ExtractionResult> {
  const today = toLocalIsoDate(new Date());
  let retryHint: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let args: unknown;
    try {
      args = await callGemini(transcript, today, retryHint);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { status: 'error', reason: 'timeout' };
      }
      return { status: 'error', reason: 'network' };
    }

    const card = validateExtractedCard(args);
    if (card) return { status: 'success', card };

    retryHint =
      'Your previous response did not match the required fields exactly: title (string), summary (string), tags (array of strings), actionItems (array of { text: string, dueDate?: string }). Return only those fields.';
  }

  return { status: 'error', reason: 'invalid-response' };
}
