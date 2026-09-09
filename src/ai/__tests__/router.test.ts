import type { AICompletionOptions, AIResponse, AIStreamChunk, AIProvider } from '../types.js';

jest.mock('../providers/index.js', () => ({
  getPrimaryProvider: jest.fn(),
  getFallbackProvider: jest.fn(),
  listAvailableProviders: jest.fn(),
  getProvider: jest.fn(),
}));

jest.mock('../../security/SecretRedactor.js', () => ({
  SecretRedactor: {
    redactString: jest.fn((s: string) => s),
    redactObject: jest.fn((o: unknown) => o),
  },
}));

jest.mock('../health.js', () => ({
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
  getHealth: jest.fn().mockReturnValue({ status: 'healthy', consecutiveFailures: 0, totalSuccesses: 0, totalFailures: 0, successRate: 1, avgLatencyMs: 0, p95LatencyMs: 0, lastSuccessAt: null, lastFailureAt: null, lastError: null, cooldownUntil: null, cooldownRemainingMs: 0, rateLimitHits: 0, tokensUsed: 0, estimatedCost: 0, lastFailureIsTransport: false }),
  isOnCooldown: jest.fn().mockReturnValue(false),
}));

jest.mock('../rateLimit.js', () => ({
  canMakeRequest: jest.fn().mockReturnValue(true),
  canUseTokens: jest.fn().mockReturnValue(true),
  acquireLease: jest.fn().mockReturnValue(1),
  releaseLease: jest.fn(),
  recordRequest: jest.fn(),
  recordTokens: jest.fn(),
  modelWindowUsedFraction: jest.fn().mockReturnValue(null),
}));

import { router, getCooldownStatus, getProviderPerf, getAllPerf, getUnavailableProviders, _resetRouterState, classifyProviderFailure } from '../router.js';
import { getPrimaryProvider, getFallbackProvider, listAvailableProviders } from '../providers/index.js';
import { recordSuccess as healthRecordSuccess, recordFailure as healthRecordFailure, getHealth } from '../health.js';
import { canMakeRequest, acquireLease, releaseLease, recordRequest, recordTokens } from '../rateLimit.js';

const mockGetPrimary = getPrimaryProvider as jest.MockedFunction<typeof getPrimaryProvider>;
const mockGetFallback = getFallbackProvider as jest.MockedFunction<typeof getFallbackProvider>;
const mockListAvailable = listAvailableProviders as jest.MockedFunction<typeof listAvailableProviders>;
const mockHealthRecordSuccess = healthRecordSuccess as jest.MockedFunction<typeof healthRecordSuccess>;
const mockHealthRecordFailure = healthRecordFailure as jest.MockedFunction<typeof healthRecordFailure>;
const mockCanMakeRequest = canMakeRequest as jest.MockedFunction<typeof canMakeRequest>;

interface MockProvider {
  name: string;
  complete: jest.Mock;
  stream: jest.Mock;
}

function makeProvider(name: string, response = 'Hello from mock'): MockProvider {
  return {
    name,
    complete: jest.fn().mockResolvedValue({ content: response, meta: { model: name, usage: { total_tokens: 10 } } }),
    stream: jest.fn().mockImplementation(
      async (_opts: AICompletionOptions, onChunk: (c: AIStreamChunk) => void) => {
        onChunk({ content: response, done: true });
      },
    ),
  };
}

function makeFailingProvider(name: string, error = new Error(`${name} failed`)): MockProvider {
  return {
    name,
    complete: jest.fn().mockRejectedValue(error),
    stream: jest.fn().mockRejectedValue(error),
  };
}

const asProvider = (p: MockProvider) =>
  p as unknown as AIProvider as unknown as ReturnType<typeof getPrimaryProvider>;

const userMsg = (content: string) => [{ role: 'user' as const, content }];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  _resetRouterState();
  mockListAvailable.mockReturnValue([]);
  mockCanMakeRequest.mockReturnValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AIRouter.chat()', () => {
  test('returns response from primary provider', async () => {
    const primary = makeProvider('openai', 'Primary response');
    mockGetPrimary.mockReturnValue(asProvider(primary));
    mockGetFallback.mockReturnValue(null);
    mockListAvailable.mockReturnValue(['openai']);

    const result = await router.chat({ messages: userMsg('Hello') });

    expect(result.content).toBe('Primary response');
    expect(result.meta.model).toBe('openai');
    expect(primary.complete).toHaveBeenCalledTimes(1);
  });

  test('returns response from fallback when primary fails', async () => {
    const groq = makeFailingProvider('groq');
    const deepseek = makeProvider('deepseek', 'Fallback response');
    mockGetPrimary.mockReturnValue(asProvider(groq));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['groq', 'deepseek']);

    const result = await router.chat({ messages: userMsg('Hello') });

    expect(result.content).toBe('Fallback response');
    expect(groq.complete).toHaveBeenCalledTimes(1);
    expect(deepseek.complete).toHaveBeenCalledTimes(1);
  });

  test('falls back after credit_balance_exhausted and does not select that provider again', async () => {
    const openai = makeFailingProvider('openai', Object.assign(new Error('credit_balance_exhausted'), { status: 429, code: 'credit_balance_exhausted' }));
    const groq = makeProvider('groq', 'Fallback response');
    mockGetPrimary.mockReturnValue(asProvider(openai));
    mockGetFallback.mockReturnValue(asProvider(groq));
    mockListAvailable.mockReturnValue(['openai', 'groq']);

    await expect(router.chat({ messages: userMsg('Hello') })).resolves.toMatchObject({ content: 'Fallback response' });
    expect(getUnavailableProviders().openai).toBe('no_credits');
    openai.complete.mockClear();
    await router.chat({ messages: userMsg('Again') });
    expect(openai.complete).not.toHaveBeenCalled();
  });

  test('throws when all providers fail', async () => {
    const groq = makeFailingProvider('groq');
    const deepseek = makeFailingProvider('deepseek');
    mockGetPrimary.mockReturnValue(asProvider(groq));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['groq', 'deepseek']);

    await expect(router.chat({ messages: userMsg('Hello') })).rejects.toThrow();
  });

  test('throws when no providers are available', async () => {
    mockGetPrimary.mockReturnValue(null);
    mockGetFallback.mockReturnValue(null);
    mockListAvailable.mockReturnValue([]);

    await expect(router.chat({ messages: userMsg('Hello') })).rejects.toThrow(
      'No providers available',
    );
  });

  test('skips providers when rate limited', async () => {
    mockCanMakeRequest.mockImplementation((platform: string) => platform !== 'groq');
    const groq = makeProvider('groq');
    const deepseek = makeProvider('deepseek', 'Deepseek ok');
    mockGetPrimary.mockReturnValue(asProvider(groq));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['groq', 'deepseek']);

    const result = await router.chat({ messages: userMsg('Hello') });
    expect(result.content).toBe('Deepseek ok');
    expect(groq.complete).not.toHaveBeenCalled();
  });

  test('records health success on provider success', async () => {
    const primary = makeProvider('openai', 'ok');
    mockGetPrimary.mockReturnValue(asProvider(primary));
    mockGetFallback.mockReturnValue(null);
    mockListAvailable.mockReturnValue(['openai']);

    await router.chat({ messages: userMsg('Hello') });
    expect(mockHealthRecordSuccess).toHaveBeenCalled();
  });

  test('records health failure on provider failure', async () => {
    const groq = makeFailingProvider('groq');
    const deepseek = makeProvider('deepseek', 'ok');
    mockGetPrimary.mockReturnValue(asProvider(groq));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['groq', 'deepseek']);

    await router.chat({ messages: userMsg('Hello') });
    expect(mockHealthRecordFailure).toHaveBeenCalled();
  });
});

describe('classifyProviderFailure()', () => {
  test('classifies invalid credentials', () => {
    expect(classifyProviderFailure(Object.assign(new Error('invalid api key'), { status: 401 }))).toBe('invalid_credentials');
    expect(classifyProviderFailure(Object.assign(new Error('forbidden'), { status: 403 }))).toBe('invalid_credentials');
  });

  test('classifies no credits', () => {
    expect(classifyProviderFailure(Object.assign(new Error('insufficient_quota'), { status: 402 }))).toBe('no_credits');
  });

  test('classifies rate limit', () => {
    expect(classifyProviderFailure(Object.assign(new Error('rate limit'), { status: 429 }))).toBe('rate_limit');
  });

  test('classifies model unavailable', () => {
    expect(classifyProviderFailure(Object.assign(new Error('model not found'), { status: 404 }))).toBe('model_unavailable');
  });

  test('classifies context too large', () => {
    expect(classifyProviderFailure(new Error('context length exceeded'))).toBe('context_too_large');
  });

  test('classifies network error', () => {
    expect(classifyProviderFailure(new Error('ECONNRESET'))).toBe('network_error');
    expect(classifyProviderFailure(new Error('ETIMEDOUT'))).toBe('network_error');
  });

  test('classifies server error', () => {
    expect(classifyProviderFailure(Object.assign(new Error('internal error'), { status: 500 }))).toBe('server_error');
  });

  test('classifies transient for unknown', () => {
    expect(classifyProviderFailure(new Error('something weird'))).toBe('transient');
  });
});

describe('cooldown system', () => {
  test('records failure and puts provider on cooldown', async () => {
    const groq = makeFailingProvider('groq');
    const deepseek = makeProvider('deepseek');
    mockGetPrimary.mockReturnValue(asProvider(groq));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['groq', 'deepseek']);

    await router.chat({ messages: userMsg('Hello') });

    const cooldowns = getCooldownStatus();
    expect(cooldowns['groq']).toBeDefined();
    expect(cooldowns['groq'].failures).toBe(1);
    expect(cooldowns['groq'].until).toBeGreaterThan(Date.now());
  });

  test('skips on-cooldown providers and tries next', async () => {
    const groq = makeFailingProvider('groq');
    const deepseek = makeProvider('deepseek', 'Fallback ok');
    mockGetPrimary.mockReturnValue(asProvider(groq));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['groq', 'deepseek']);

    await router.chat({ messages: userMsg('Hello') });

    expect(getCooldownStatus()['groq']).toBeDefined();

    groq.complete.mockClear();
    deepseek.complete.mockClear();
    await router.chat({ messages: userMsg('Hello') });

    expect(groq.complete).not.toHaveBeenCalled();
    expect(deepseek.complete).toHaveBeenCalledTimes(1);
  });
});

describe('performance tracking', () => {
  test('getProviderPerf returns defaults for unknown provider', () => {
    const perf = getProviderPerf('unknown_provider');
    expect(perf).toEqual({
      totalCalls: 0,
      successCalls: 0,
      failureCalls: 0,
      avgLatencyMs: 0,
      lastLatencyMs: 0,
    });
  });

  test('records performance on success', async () => {
    const primary = makeProvider('openai');
    mockGetPrimary.mockReturnValue(asProvider(primary));
    mockGetFallback.mockReturnValue(null);
    mockListAvailable.mockReturnValue(['openai']);

    await router.chat({ messages: userMsg('Hello') });

    const perf = getProviderPerf('openai');
    expect(perf.totalCalls).toBe(1);
    expect(perf.successCalls).toBe(1);
    expect(perf.failureCalls).toBe(0);
  });
});

describe('AIRouter.say()', () => {
  test('constructs messages and returns content string', async () => {
    const primary = makeProvider('openai', 'say response');
    mockGetPrimary.mockReturnValue(asProvider(primary));
    mockGetFallback.mockReturnValue(null);
    mockListAvailable.mockReturnValue(['openai']);

    const result = await router.say('What is 2+2?', 'You are a math tutor');

    expect(result).toBe('say response');
    const calledWith = (primary.complete as jest.Mock).mock.calls[0][0];
    expect(calledWith.messages).toEqual([
      { role: 'system', content: 'You are a math tutor' },
      { role: 'user', content: 'What is 2+2?' },
    ]);
  });

  test('works without system prompt', async () => {
    const primary = makeProvider('openai', 'no system');
    mockGetPrimary.mockReturnValue(asProvider(primary));
    mockGetFallback.mockReturnValue(null);
    mockListAvailable.mockReturnValue(['openai']);

    const result = await router.say('Hello');

    expect(result).toBe('no system');
  });
});

describe('vision capability filtering', () => {
  test('vision request excludes non-vision providers', async () => {
    const groq = makeProvider('groq', 'Groq response');
    const openai = makeProvider('openai', 'Openai response');
    mockGetPrimary.mockReturnValue(asProvider(groq));
    mockGetFallback.mockReturnValue(asProvider(openai));
    mockListAvailable.mockReturnValue(['groq', 'openai']);

    // groq does not support vision, openai does
    const result = await router.chat(
      { messages: [{ role: 'user', content: 'Describe this image' }] },
      { hasVision: true },
    );

    expect(result.content).toBe('Openai response');
    expect(groq.complete).not.toHaveBeenCalled();
    expect(openai.complete).toHaveBeenCalledTimes(1);
  });

  test('vision request falls back to another vision-capable provider', async () => {
    const anthropic = makeFailingProvider('anthropic');
    const gemini = makeProvider('gemini', 'Gemini vision response');
    mockGetPrimary.mockReturnValue(asProvider(anthropic));
    mockGetFallback.mockReturnValue(asProvider(gemini));
    mockListAvailable.mockReturnValue(['anthropic', 'gemini']);

    const result = await router.chat(
      { messages: [{ role: 'user', content: 'Analyze this screenshot' }] },
      { hasVision: true },
    );

    expect(result.content).toBe('Gemini vision response');
  });

  test('tool-calling request excludes non-tool providers', async () => {
    // pollinations has supportsTools: false, deepseek has supportsTools: true
    const pollinations = makeProvider('pollinations', 'Pollinations response');
    const deepseek = makeProvider('deepseek', 'DS response');
    mockGetPrimary.mockReturnValue(asProvider(pollinations));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['pollinations', 'deepseek']);

    const result = await router.chat(
      {
        messages: [{ role: 'user', content: 'Call a tool' }],
        tools: [{ type: 'function', function: { name: 'test', description: 'test', parameters: {} } }],
      },
      { requiresTools: true },
    );

    expect(result.content).toBe('DS response');
    expect(pollinations.complete).not.toHaveBeenCalled();
  });

  test('context-length request excludes providers with insufficient context', async () => {
    const pollinations = makeProvider('pollinations', 'Pollinations response');
    const gemini = makeProvider('gemini', 'Gemini response');
    mockGetPrimary.mockReturnValue(asProvider(pollinations));
    mockGetFallback.mockReturnValue(asProvider(gemini));
    mockListAvailable.mockReturnValue(['pollinations', 'gemini']);

    // pollinations has contextLength: 32768, gemini has 1048576
    const result = await router.chat(
      { messages: [{ role: 'user', content: 'Process this large document' }] },
      { contextNeeded: 50000 },
    );

    expect(result.content).toBe('Gemini response');
    expect(pollinations.complete).not.toHaveBeenCalled();
  });

  test('tool-calling request uses cerebras (now supports tools)', async () => {
    const cerebras = makeProvider('cerebras', 'Cerebras tool response');
    const deepseek = makeProvider('deepseek', 'DS response');
    mockGetPrimary.mockReturnValue(asProvider(cerebras));
    mockGetFallback.mockReturnValue(asProvider(deepseek));
    mockListAvailable.mockReturnValue(['cerebras', 'deepseek']);

    const result = await router.chat(
      {
        messages: [{ role: 'user', content: 'Call a tool' }],
        tools: [{ type: 'function', function: { name: 'test', description: 'test', parameters: {} } }],
      },
      { requiresTools: true },
    );

    // cerebras now supports tools, so it should be used
    expect(result.content).toBe('Cerebras tool response');
  });

  test('vision request uses cloudflare (now supports vision)', async () => {
    const cloudflare = makeProvider('cloudflare', 'CF vision response');
    const pollinations = makeProvider('pollinations', 'Pollinations response');
    mockGetPrimary.mockReturnValue(asProvider(cloudflare));
    mockGetFallback.mockReturnValue(asProvider(pollinations));
    mockListAvailable.mockReturnValue(['cloudflare', 'pollinations']);

    const result = await router.chat(
      { messages: [{ role: 'user', content: 'Describe this image' }] },
      { hasVision: true },
    );

    // cloudflare now supports vision
    expect(result.content).toBe('CF vision response');
  });
});
