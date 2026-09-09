jest.useFakeTimers();

function freshModule() {
  jest.resetModules();
  return require('../rateLimit');
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Per-user rate limiting', () => {
  it('first request is not rate limited', () => {
    const { isRateLimited } = freshModule();
    expect(isRateLimited('user1')).toBe(false);
  });

  it('requests within limit are not rate limited', () => {
    const { isRateLimited } = freshModule();
    for (let i = 0; i < 10; i++) {
      expect(isRateLimited('user1')).toBe(false);
    }
  });

  it('requests exceeding limit are rate limited', () => {
    const { isRateLimited } = freshModule();
    for (let i = 0; i < 10; i++) {
      isRateLimited('user1');
    }
    expect(isRateLimited('user1')).toBe(true);
  });

  it('rate limit resets after window expires', () => {
    const { isRateLimited } = freshModule();
    for (let i = 0; i < 10; i++) {
      isRateLimited('user1');
    }
    expect(isRateLimited('user1')).toBe(true);

    jest.advanceTimersByTime(30_001);

    expect(isRateLimited('user1')).toBe(false);
  });
});

describe('getRateLimitStatus', () => {
  it('returns correct info', () => {
    const { isRateLimited, getRateLimitStatus } = freshModule();
    isRateLimited('user1');
    isRateLimited('user1');

    const status = getRateLimitStatus('user1');
    expect(status.requests).toBe(2);
    expect(status.resetAt).toBeGreaterThan(Date.now());
    expect(status.remainingMs).toBeGreaterThan(0);
    expect(status.remainingMs).toBeLessThanOrEqual(30_000);
  });

  it('returns zero state for unknown user', () => {
    const { getRateLimitStatus } = freshModule();
    const status = getRateLimitStatus('unknown');
    expect(status.requests).toBe(0);
    expect(status.remainingMs).toBe(0);
  });
});

describe('multiple users', () => {
  it('are tracked independently', () => {
    const { isRateLimited } = freshModule();
    for (let i = 0; i < 10; i++) {
      isRateLimited('user1');
    }
    expect(isRateLimited('user1')).toBe(true);
    expect(isRateLimited('user2')).toBe(false);
  });
});

describe('Provider/model rate limiting', () => {
  it('canMakeRequest returns true when under limits', () => {
    const { canMakeRequest } = freshModule();
    expect(canMakeRequest('openai', 'gpt-4o-mini', { rpm: 60, rpd: 1000, tpm: 100000, tpd: 1000000 })).toBe(true);
  });

  it('canMakeRequest returns true when limits are null', () => {
    const { canMakeRequest } = freshModule();
    expect(canMakeRequest('openai', 'gpt-4o-mini', { rpm: null, rpd: null, tpm: null, tpd: null })).toBe(true);
  });

  it('canUseTokens returns true when under limits', () => {
    const { canUseTokens } = freshModule();
    expect(canUseTokens('openai', 'gpt-4o-mini', 1000, { rpm: null, rpd: null, tpm: 100000, tpd: 1000000 })).toBe(true);
  });

  it('recordRequest tracks requests', () => {
    const { recordRequest, canMakeRequest } = freshModule();
    // Record many requests
    for (let i = 0; i < 59; i++) {
      recordRequest('openai', 'gpt-4o-mini');
    }
    // Should still be under RPM limit of 60
    expect(canMakeRequest('openai', 'gpt-4o-mini', { rpm: 60, rpd: null, tpm: null, tpd: null })).toBe(true);
  });

  it('recordTokens tracks tokens', () => {
    const { recordTokens, canUseTokens } = freshModule();
    // Record tokens
    for (let i = 0; i < 5; i++) {
      recordTokens('openai', 'gpt-4o-mini', 20000);
    }
    // Should still be under TPM limit of 200000 (5 × 20000 = 100000)
    expect(canUseTokens('openai', 'gpt-4o-mini', 1, { rpm: null, rpd: null, tpm: 200000, tpd: null })).toBe(true);
  });

  it('acquireLease and releaseLease work', () => {
    const { acquireLease, releaseLease } = freshModule();
    const leaseId = acquireLease('openai', 'gpt-4o-mini', 1000);
    expect(typeof leaseId).toBe('number');
    releaseLease(leaseId);
  });

  it('modelWindowUsedFraction returns null when no limits', () => {
    const { modelWindowUsedFraction } = freshModule();
    expect(modelWindowUsedFraction('openai', 'gpt-4o-mini', { rpm: null, rpd: null, tpm: null, tpd: null })).toBeNull();
  });

  it('setCooldown and isOnCooldown work', () => {
    const { setCooldown, isOnCooldown } = freshModule();
    setCooldown('openai', 'gpt-4o-mini', 60000);
    expect(isOnCooldown('openai', 'gpt-4o-mini')).toBe(true);
    jest.advanceTimersByTime(60001);
    expect(isOnCooldown('openai', 'gpt-4o-mini')).toBe(false);
  });
});
