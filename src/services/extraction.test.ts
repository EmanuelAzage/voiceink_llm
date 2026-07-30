import { extractCard } from './extraction';

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { GEMINI_API_KEY: 'test-api-key', GEMINI_MODEL: 'test-model' },
}));

const validCard = {
  title: 'Call Dentist',
  summary: 'The user needs to call the dentist.',
  tags: ['Dentist'],
  actionItems: [{ text: 'call the dentist', dueDate: '2026-07-31' }],
};

function geminiResponseBody(args: unknown) {
  return {
    candidates: [{ content: { parts: [{ functionCall: { name: 'extract_card', args } }] } }],
  };
}

function mockFetchResponse(body: unknown, options: { ok?: boolean; status?: number } = {}): Response {
  const { ok = true, status = 200 } = options;
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const mockFetch = jest.fn();

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe('extractCard', () => {
  it('returns the extracted card on a successful, schema-conforming response', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse(geminiResponseBody(validCard)));

    const result = await extractCard('Remind me to call the dentist tomorrow');

    expect(result).toEqual({ status: 'success', card: validCard });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends a well-formed request: correct URL, forced function call, no additionalProperties', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse(geminiResponseBody(validCard)));

    await extractCard('Remind me to call the dentist tomorrow');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent?key=test-api-key',
    );
    const body = JSON.parse(options.body);
    expect(body.toolConfig.functionCallingConfig.mode).toBe('ANY');
    expect(body.tools[0].functionDeclarations[0].name).toBe('extract_card');
    expect(JSON.stringify(body)).not.toContain('additionalProperties');
  });

  it('retries once with error feedback when the first response does not match the schema', async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(geminiResponseBody({ title: 'missing other fields' })))
      .mockResolvedValueOnce(mockFetchResponse(geminiResponseBody(validCard)));

    const result = await extractCard('Remind me to call the dentist tomorrow');

    expect(result).toEqual({ status: 'success', card: validCard });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondRequestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const secondPromptText = secondRequestBody.contents[0].parts[0].text;
    expect(secondPromptText).toContain('did not match the required fields');
  });

  it('gives up after one retry and reports invalid-response', async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(geminiResponseBody({ title: 'still bad' })))
      .mockResolvedValueOnce(mockFetchResponse(geminiResponseBody({ title: 'still bad' })));

    const result = await extractCard('Remind me to call the dentist tomorrow');

    expect(result).toEqual({ status: 'error', reason: 'invalid-response' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('reports network on a non-OK HTTP response', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({ error: 'bad request' }, { ok: false, status: 400 }));

    const result = await extractCard('Remind me to call the dentist tomorrow');

    expect(result).toEqual({ status: 'error', reason: 'network' });
  });

  it('reports network when fetch itself rejects', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));

    const result = await extractCard('Remind me to call the dentist tomorrow');

    expect(result).toEqual({ status: 'error', reason: 'network' });
  });

  it('reports timeout when the request is aborted', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await extractCard('Remind me to call the dentist tomorrow');

    expect(result).toEqual({ status: 'error', reason: 'timeout' });
  });

  it('reports invalid-response when the model returns no function call at all', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse({ candidates: [{ content: { parts: [{ text: 'no tool call' }] } }] }));

    const result = await extractCard('Remind me to call the dentist tomorrow');

    expect(result).toEqual({ status: 'error', reason: 'invalid-response' });
  });
});
