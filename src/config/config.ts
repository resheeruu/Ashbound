/**
 * Configuration: Centralized configuration system.
 * Single source of truth for all configuration values.
 * Validates at startup and fails fast on missing required config.
 */

export interface DiscordConfig {
  token: string;
  clientId: string;
  guildId: string | null;
  ownerId: string | null;
}

export interface AIConfig {
  primaryProvider: string;
  fallbackProvider: string | null;
  providers: Record<string, { apiKey?: string; model?: string }>;
  streamTimeoutMs: number;
  requestTimeoutMs: number;
}

export interface WebConfig {
  port: number;
}

export interface SecurityConfig {
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  maxMessageLength: number;
  maxFileSize: number;
}

export interface AppConfig {
  discord: DiscordConfig;
  ai: AIConfig;
  web: WebConfig;
  security: SecurityConfig;
  logLevel: string;
  isDevelopment: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function optionalEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load and validate configuration from environment variables.
 * Fails fast on missing required variables.
 */
export function loadConfig(): AppConfig {
  // Required
  const discordToken = requireEnv('DISCORD_TOKEN');
  const discordClientId = requireEnv('DISCORD_CLIENT_ID');

  // Optional Discord
  const guildId = process.env.DISCORD_GUILD_ID || null;
  const ownerId = process.env.DISCORD_OWNER_ID || null;

  // AI
  // Blank values are equivalent to unset. Provider validation remains in the
  // registry, so invalid values cannot crash startup.
  const configuredPrimary = process.env.AI_PROVIDER?.trim();
  const configuredFallback = process.env.AI_FALLBACK?.trim();
  const primaryProvider = configuredPrimary || 'openai';
  const fallbackProvider = configuredFallback && configuredFallback.toLowerCase() !== 'none'
    ? configuredFallback
    : null;
  const streamTimeoutMs = optionalEnvInt('AI_STREAM_TIMEOUT_MS', 120_000);
  const requestTimeoutMs = optionalEnvInt('AI_REQUEST_TIMEOUT_MS', 60_000);

  const aiProviders: Record<string, { apiKey?: string; model?: string }> = {};
  const providerEnvVars: Record<string, { apiKey: string; model: string }> = {
    openai: { apiKey: 'OPENAI_API_KEY', model: 'OPENAI_MODEL' },
    anthropic: { apiKey: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL' },
    gemini: { apiKey: 'GEMINI_API_KEY', model: 'GEMINI_MODEL' },
    groq: { apiKey: 'GROQ_API_KEY', model: 'GROQ_MODEL' },
    mistral: { apiKey: 'MISTRAL_API_KEY', model: 'MISTRAL_MODEL' },
    deepseek: { apiKey: 'DEEPSEEK_API_KEY', model: 'DEEPSEEK_MODEL' },
    openrouter: { apiKey: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL' },
    xai: { apiKey: 'XAI_API_KEY', model: 'XAI_MODEL' },
    cohere: { apiKey: 'COHERE_API_KEY', model: 'COHERE_MODEL' },
    freellmapi: { apiKey: 'FREELLMAPI_API_KEY', model: 'FREELLMAPI_MODEL' },
    cerebras: { apiKey: 'CEREBRAS_API_KEY', model: 'CEREBRAS_MODEL' },
    nvidia: { apiKey: 'NVIDIA_API_KEY', model: 'NVIDIA_MODEL' },
    github: { apiKey: 'GITHUB_TOKEN', model: 'GITHUB_MODEL' },
    cloudflare: { apiKey: 'CLOUDFLARE_API_TOKEN', model: 'CLOUDFLARE_MODEL' },
    huggingface: { apiKey: 'HF_TOKEN', model: 'HF_MODEL' },
    pollinations: { apiKey: '', model: 'POLLINATIONS_MODEL' },
    opencodezen: { apiKey: 'OPENCODEZEN_API_KEY', model: 'OPENCODEZEN_MODEL' },
    zhipu: { apiKey: 'ZHIPU_API_KEY', model: 'ZHIPU_MODEL' },
    ollama: { apiKey: '', model: 'OLLAMA_MODEL' },
    custom: { apiKey: 'CUSTOM_API_KEY', model: 'CUSTOM_MODEL' },
    bai: { apiKey: 'BAI_API_KEY', model: 'BAI_MODEL' },
    anyapi: { apiKey: 'ANYAPI_API_KEY', model: 'ANYAPI_MODEL' },
    aihorde: { apiKey: '', model: 'AI_HORDE_MODEL' },
    ollamacloud: { apiKey: 'OLLAMACLOUD_API_KEY', model: 'OLLAMACLOUD_MODEL' },
    kilo: { apiKey: '', model: 'KILO_MODEL' },
    llm7: { apiKey: 'LLM7_API_KEY', model: 'LLM7_MODEL' },
    ovh: { apiKey: '', model: 'OVH_MODEL' },
    agnes: { apiKey: 'AGNES_API_KEY', model: 'AGNES_MODEL' },
    reka: { apiKey: 'REKA_API_KEY', model: 'REKA_MODEL' },
    siliconflow: { apiKey: 'SILICONFLOW_API_KEY', model: 'SILICONFLOW_MODEL' },
    routeway: { apiKey: 'ROUTEWAY_API_KEY', model: 'ROUTEWAY_MODEL' },
    bazaarlink: { apiKey: 'BAZAARLINK_API_KEY', model: 'BAZAARLINK_MODEL' },
    ainative: { apiKey: 'AINATIVE_API_KEY', model: 'AINATIVE_MODEL' },
    aion: { apiKey: 'AION_API_KEY', model: 'AION_MODEL' },
    requesty: { apiKey: 'REQUESTY_API_KEY', model: 'REQUESTY_MODEL' },
    navy: { apiKey: 'NAVY_API_KEY', model: 'NAVY_MODEL' },
    nara: { apiKey: 'NARA_API_KEY', model: 'NARA_MODEL' },
    sealion: { apiKey: 'SEALION_API_KEY', model: 'SEALION_MODEL' },
    orcarouter: { apiKey: 'ORCAROUTER_API_KEY', model: 'ORCAROUTER_MODEL' },
    unorouter: { apiKey: 'UNOROUTER_API_KEY', model: 'UNOROUTER_MODEL' },
    xkiro: { apiKey: 'XKIRO_API_KEY', model: 'XKIRO_MODEL' },
    modelscope: { apiKey: 'MODELSCOPE_API_KEY', model: 'MODELSCOPE_MODEL' },
    qianfan: { apiKey: 'QIANFAN_API_KEY', model: 'QIANFAN_MODEL' },
    volcengine: { apiKey: 'VOLCENGINE_API_KEY', model: 'VOLCENGINE_MODEL' },
    longcat: { apiKey: 'LONGCAT_API_KEY', model: 'LONGCAT_MODEL' },
    xfyun: { apiKey: 'XFYUN_API_KEY', model: 'XFYUN_MODEL' },
  };

  for (const [name, envVars] of Object.entries(providerEnvVars)) {
    const apiKey = process.env[envVars.apiKey];
    const model = process.env[envVars.model];
    if (apiKey || model) {
      aiProviders[name] = { apiKey, model };
    }
  }

  // Web
  const port = optionalEnvInt('PORT', optionalEnvInt('WEB_PORT', 3000));

  // Security
  const rateLimitMaxRequests = optionalEnvInt('RATE_LIMIT_MAX', 10);
  const rateLimitWindowMs = optionalEnvInt('RATE_LIMIT_WINDOW_MS', 30_000);
  const maxMessageLength = optionalEnvInt('MAX_MESSAGE_LENGTH', 4000);
  const maxFileSize = optionalEnvInt('MAX_FILE_SIZE', 10 * 1024 * 1024);

  // Logging
  const logLevel = process.env.LOG_LEVEL || 'info';
  const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';

  return {
    discord: {
      token: discordToken,
      clientId: discordClientId,
      guildId,
      ownerId,
    },
    ai: {
      primaryProvider,
      fallbackProvider,
      providers: aiProviders,
      streamTimeoutMs,
      requestTimeoutMs,
    },
    web: { port },
    security: {
      rateLimitMaxRequests,
      rateLimitWindowMs,
      maxMessageLength,
      maxFileSize,
    },
    logLevel,
    isDevelopment,
  };
}

let _config: AppConfig | null = null;

/**
 * Get the loaded configuration.
 * Must call loadConfig() first during startup.
 */
export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return _config;
}

/**
 * Initialize configuration (called once at startup).
 */
export function initConfig(): AppConfig {
  _config = loadConfig();
  return _config;
}
