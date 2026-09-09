/**
 * Web Tools permission and security tests.
 * Verifies owner-only enforcement, SSRF protection, and safe denial.
 */

const _tools = new Map<string, unknown>();

jest.mock('../tools.js', () => ({
  registerTool: jest.fn((tool: unknown) => {
    const t = tool as { name: string };
    _tools.set(t.name, tool);
  }),
  getTool: jest.fn((name: string) => _tools.get(name) ?? null),
  listTools: jest.fn(() => Array.from(_tools.values())),
}));

// Import after mock setup — this triggers registerTool calls
import { getTool } from '../tools.js';
import type { ToolContext } from '../tools.js';

// Force module load to register web tools
import '../webTools.js';

function getRegisteredTool(name: string) {
  return getTool(name) as { name: string; execute: Function; category: string } | null;
}

function makeContext(userId: string): ToolContext {
  return {
    client: {} as never,
    guildId: 'guild-1',
    channelId: 'channel-1',
    userId,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.DISCORD_OWNER_ID;
});

afterEach(() => {
  delete process.env.DISCORD_OWNER_ID;
});

describe('web_search tool registration', () => {
  test('web_search is registered as a READ_ONLY tool', () => {
    const tool = getRegisteredTool('web_search');
    expect(tool).not.toBeNull();
    expect(tool).toMatchObject({
      name: 'web_search',
      category: 'READ_ONLY',
    });
  });

  test('web_fetch is registered as a READ_ONLY tool', () => {
    const tool = getRegisteredTool('web_fetch');
    expect(tool).not.toBeNull();
    expect(tool).toMatchObject({
      name: 'web_fetch',
      category: 'READ_ONLY',
    });
  });
});

describe('owner permission enforcement', () => {
  test('owner can execute web search', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_search');
    expect(tool).not.toBeNull();

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html></html>'),
    });

    try {
      const result = await (tool!.execute as Function)(
        { query: 'test query' },
        makeContext('owner-123'),
      );
      expect(result.error).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('non-owner cannot execute web search', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_search');
    expect(tool).not.toBeNull();

    const result = await (tool!.execute as Function)(
      { query: 'test query' },
      makeContext('not-owner-456'),
    );
    expect(result.error).toContain('Permission denied');
    expect(result.error).toContain('bot owner');
  });

  test('owner can execute web fetch', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');
    expect(tool).not.toBeNull();

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: jest.fn().mockReturnValue('text/html') },
      text: jest.fn().mockResolvedValue('<html>content</html>'),
    });

    try {
      const result = await (tool!.execute as Function)(
        { url: 'https://example.com' },
        makeContext('owner-123'),
      );
      expect(result.error).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('non-owner cannot execute web fetch', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');
    expect(tool).not.toBeNull();

    const result = await (tool!.execute as Function)(
      { url: 'https://example.com' },
      makeContext('not-owner-456'),
    );
    expect(result.error).toContain('Permission denied');
    expect(result.error).toContain('bot owner');
  });

  test('missing DISCORD_OWNER_ID safely denies access', async () => {
    const tool = getRegisteredTool('web_search');
    expect(tool).not.toBeNull();

    const result = await (tool!.execute as Function)(
      { query: 'test query' },
      makeContext('any-user'),
    );
    expect(result.error).toContain('Permission denied');
  });

  test('denied user causes no outbound network request for web_search', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_search');

    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    try {
      await (tool!.execute as Function)(
        { query: 'test query' },
        makeContext('not-owner-456'),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('denied user causes no outbound network request for web_fetch', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    try {
      await (tool!.execute as Function)(
        { url: 'https://example.com' },
        makeContext('not-owner-456'),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('SSRF protection', () => {
  test('blocks localhost URLs', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: 'http://localhost/admin' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('Blocked');
  });

  test('blocks private IP ranges', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: 'http://192.168.1.1/admin' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('Blocked');
  });

  test('blocks cloud metadata endpoints', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: 'http://169.254.169.254/latest/meta-data/' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('Blocked');
  });

  test('blocks file:// scheme', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: 'file:///etc/passwd' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('Blocked');
  });

  test('blocks non-HTTP schemes', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: 'ftp://example.com/file' },
      makeContext('owner-123'),
    );
    // ftp:// is caught by blocked schemes SSRF protection
    expect(result.error).toContain('Blocked');
  });

  test('SSRF protection active even for owner', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: 'http://127.0.0.1:8080/admin' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('Blocked');
  });
});

describe('input validation', () => {
  test('web_search rejects empty query', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_search');

    const result = await (tool!.execute as Function)(
      { query: '' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('required');
  });

  test('web_search rejects overly long query', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_search');

    const result = await (tool!.execute as Function)(
      { query: 'a'.repeat(501) },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('too long');
  });

  test('web_fetch rejects empty URL', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: '' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('required');
  });

  test('web_fetch rejects non-HTTP URL', async () => {
    process.env.DISCORD_OWNER_ID = 'owner-123';
    const tool = getRegisteredTool('web_fetch');

    const result = await (tool!.execute as Function)(
      { url: 'not-a-url' },
      makeContext('owner-123'),
    );
    expect(result.error).toContain('HTTP/HTTPS');
  });
});
