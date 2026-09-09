/**
 * Shared types for the AI abstraction layer.
 * All AI interactions flow through this interface — providers implement it.
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
  /** For vision: image URL or base64 data URI */
  imageUrl?: string;
  /** For tool calling: tool calls from the assistant */
  toolCalls?: ToolCall[];
  /** For tool calling: the ID of the tool call this message is responding to */
  toolCallId?: string;
}

export interface AIResponse {
  content: string;
  /** Raw provider-specific metadata (model, tokens, etc.) */
  meta: Record<string, unknown>;
  /** Tool calls requested by the model, if any */
  toolCalls?: ToolCall[];
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
  meta?: Record<string, unknown>;
  /** Tool call chunks arriving during streaming */
  toolCall?: ToolCallChunk;
}

export interface AICompletionOptions {
  model?: string;
  messages: AIMessage[];
  /** Max tokens in the response. 0 = provider default. */
  maxTokens?: number;
  /** 0.0–2.0. -1 = provider default. */
  temperature?: number;
  /** 0–1. Stop generation when confidence exceeds this. */
  topP?: number;
  /** Stream the response token by token. */
  stream?: boolean;
  /** Stop at these sequences. */
  stop?: string[];
  /** Tool definitions for function calling */
  tools?: ToolDefinition[];
  /** Tool choice policy: 'auto', 'none', or specific tool name */
  toolChoice?: 'auto' | 'none' | string;
}

export interface AIProvider {
  name: string;

  /**
   * Single-shot chat completion.
   * Returns AIResponse with content and metadata.
   */
  complete(opts: AICompletionOptions): Promise<AIResponse>;

  /**
   * Streaming chat completion.
   * Calls `onChunk` for each token and `onDone` when finished.
   */
  stream(
    opts: AICompletionOptions,
    onChunk: (chunk: AIStreamChunk) => void,
    onDone?: (meta: Record<string, unknown>) => void,
  ): Promise<void>;
}

// ─── Tool calling types ─────────────────────────────────────────────────────

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallChunk {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

// ─── Provider capability metadata ───────────────────────────────────────────

export type ProviderFailureKind =
  | 'permanent'
  | 'rate_limit'
  | 'transient'
  | 'model_unavailable'
  | 'network_error'
  | 'invalid_credentials'
  | 'no_credits'
  | 'context_too_large'
  | 'vision_unsupported'
  | 'tools_unsupported'
  | 'invalid_request'
  | 'server_error'
  | 'unknown';

/** Provider state as tracked by the router. */
export type ProviderState =
  | 'HEALTHY'
  | 'COOLDOWN'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'INVALID_CREDENTIALS'
  | 'NO_CREDITS'
  | 'MODEL_UNAVAILABLE'
  | 'NETWORK_ERROR';

/** Static capability metadata for a provider model. */
export interface ModelEntry {
  provider: string;
  modelId: string;
  displayName: string;
  contextLength: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsDocuments: boolean;
  /** Estimated cost per 1K tokens (0 = free). */
  costPer1k: number;
  /** Whether this model is known to be on a free tier. */
  freeTier: boolean;
  /** Priority: lower = preferred. */
  priority: number;
  /** Model aliases / group membership */
  aliases?: string[];
  /** Endpoint scope for custom providers */
  endpointScope?: string;
}

/** Dynamic availability state for a model. */
export interface ModelAvailability {
  available: boolean;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
  cooldownUntil: number | null;
  consecutiveFailures: number;
}

// ─── Usage tracking ─────────────────────────────────────────────────────────

export interface UsageStats {
  provider: string;
  model: string;
  requestCount: number;
  successfulRequests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  firstTokenLatencyMs: number | null;
  fallbackEvents: number;
  cooldownEvents: number;
  lastUsedAt: number | null;
}

// ─── Model weight overrides ─────────────────────────────────────────────────

export interface ModelWeightOverride {
  modelId: string;
  /** Score multiplier: 0 = disabled, 1 = normal, >1 = boosted */
  weight: number;
}
