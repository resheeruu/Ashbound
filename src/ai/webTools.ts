/**
 * Web Tools — privileged web search and fetch capabilities.
 *
 * WEB SEARCH IS CREATOR/OWNER ONLY.
 * The permission check occurs at the actual tool execution boundary,
 * not only in the UI/command description.
 *
 * Security protections:
 *   - SSRF prevention (no localhost, private IPs, cloud metadata)
 *   - No credential leakage
 *   - Response size limits
 *   - Timeout enforcement
 *   - Redirect limits
 *   - HTTP/HTTPS only
 */

import { registerTool, type ToolDefinition, type ToolContext } from './tools.js';

// ─── Owner permission check ─────────────────────────────────────────────────

/**
 * Check if a user is the bot creator/owner.
 * Uses the DISCORD_OWNER_ID environment variable.
 * Returns false if the env var is not set (safe default).
 */
function isOwner(userId: string): boolean {
  const ownerId = process.env.DISCORD_OWNER_ID;
  if (!ownerId) return false;
  return userId === ownerId;
}

function ownerDenied(): string {
  return 'Permission denied: Web search and fetch are restricted to the bot owner.';
}

// ─── SSRF protection ────────────────────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)/i,
  /^https?:\/\/10\.\d+\.\d+\.\d+/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i,
  /^https?:\/\/192\.168\.\d+\.\d+/i,
  /^https?:\/\/169\.254\.\d+\.\d+/i,  // AWS metadata
  /^https?:\/\/metadata\.google\.internal/i,  // GCP metadata
  /^https?:\/\/169\.254\.169\.254/i,  // Azure metadata
];

const BLOCKED_SCHEMES = ['file:', 'ftp:', 'ssh:', 'data:'];

function isUnsafeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) return true;
  }
  return false;
}

// ─── Web search tool ────────────────────────────────────────────────────────

const MAX_RESPONSE_SIZE = 100_000; // 100KB
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (isUnsafeUrl(url)) {
    throw new Error('Blocked: URL targets a private/internal network or blocked scheme.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    let redirectCount = 0;
    let currentUrl = url;

    while (true) {
      response = await fetch(currentUrl, {
        ...options,
        signal: controller.signal,
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400 && redirectCount < MAX_REDIRECTS) {
        const location = response.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).toString();
        if (isUnsafeUrl(currentUrl)) {
          throw new Error('Blocked: redirect targets a private/internal network.');
        }
        redirectCount++;
        continue;
      }

      break;
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Web search tool — uses a search API or falls back to DuckDuckGo Lite.
 */
registerTool({
  name: 'web_search',
  description: 'Search the web for current information. Returns search results with titles, URLs, and snippets.',
  category: 'READ_ONLY',
  parameters: { query: 'string' },
  execute: async (params, ctx) => {
    // OWNER-ONLY permission check at execution boundary
    if (!isOwner(ctx.userId)) return { error: ownerDenied() };

    const query = String(params.query || '').trim();
    if (!query) return { error: 'Search query is required.' };
    if (query.length > 500) return { error: 'Query too long (max 500 characters).' };

    try {
      // Try DuckDuckGo Lite as a no-API-key search
      const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      const response = await safeFetch(searchUrl, {
        headers: { 'User-Agent': 'Ashbound/1.0' },
      });

      if (!response.ok) {
        return { error: `Search failed: HTTP ${response.status}` };
      }

      const html = await response.text();

      // Basic HTML parsing for search results (DuckDuckGo Lite format)
      const results: Array<{ title: string; url: string; snippet: string }> = [];
      const linkRegex = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([^<]+)<\/a>/gi;
      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

      let match;
      while ((match = linkRegex.exec(html)) !== null && results.length < 5) {
        results.push({
          title: match[2].trim(),
          url: match[1],
          snippet: '',
        });
      }

      // Try to extract snippets
      let snippetIdx = 0;
      while ((match = snippetRegex.exec(html)) !== null && snippetIdx < results.length) {
        results[snippetIdx].snippet = match[1].replace(/<[^>]+>/g, '').trim().slice(0, 300);
        snippetIdx++;
      }

      if (results.length === 0) {
        // Fallback: extract any links
        const anyLink = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
        while ((match = anyLink.exec(html)) !== null && results.length < 5) {
          if (!match[1].includes('duckduckgo.com')) {
            results.push({
              title: match[2].trim(),
              url: match[1],
              snippet: '',
            });
          }
        }
      }

      return {
        query,
        results,
        source: 'duckduckgo-lite',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Blocked:')) {
        return { error: message };
      }
      return { error: `Search failed: ${message.slice(0, 200)}` };
    }
  },
});

/**
 * Web fetch tool — fetch content from a URL.
 */
registerTool({
  name: 'web_fetch',
  description: 'Fetch content from a URL. Returns the text content of the page. Owner only.',
  category: 'READ_ONLY',
  parameters: { url: 'string' },
  execute: async (params, ctx) => {
    // OWNER-ONLY permission check at execution boundary
    if (!isOwner(ctx.userId)) return { error: ownerDenied() };

    const url = String(params.url || '').trim();
    if (!url) return { error: 'URL is required.' };

    if (isUnsafeUrl(url)) {
      return { error: 'Blocked: URL targets a private/internal network or blocked scheme.' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { error: 'Only HTTP/HTTPS URLs are allowed.' };
    }

    try {
      const response = await safeFetch(url, {
        headers: {
          'User-Agent': 'Ashbound/1.0',
          'Accept': 'text/html,text/plain,*/*',
        },
      });

      if (!response.ok) {
        return { error: `Fetch failed: HTTP ${response.status}` };
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
        return { error: 'Binary content not supported. Use web_search instead.' };
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_SIZE) {
        return { error: `Response too large (${Math.round(text.length / 1024)}KB). Max: ${MAX_RESPONSE_SIZE / 1024}KB.` };
      }

      // Basic HTML to text conversion
      let content = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10_000);

      return {
        url,
        content,
        contentType,
        size: text.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Fetch failed: ${message.slice(0, 200)}` };
    }
  },
});
