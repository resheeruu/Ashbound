import { log } from "../logger";
import { config } from "../config/env";
import { eventBus } from "../events/bus";
import { ProviderHealth } from "../events/types";

export interface AIProvider {
  id: string;
  name: string;
  listModels(): Promise<ModelInfo[]>;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  generateStructured<T>(request: StructuredGenerateRequest): Promise<T>;
  healthCheck(): Promise<ProviderHealthResult>;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  supportsStructuredOutput: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  free: boolean;
  role: string;
}

export interface GenerateRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: Array<{ name: string; description: string; schema: Record<string, unknown> }>;
}

export interface GenerateResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  providerId: string;
}

export interface StructuredGenerateRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  schema: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderHealthResult {
  healthy: boolean;
  latencyMs: number;
  status: ProviderHealth;
  message: string;
  timestamp: number;
}

export interface ProviderRegistration {
  name: string;
  status: string;
  priority: number;
  endpoint: string | undefined;
  config: Record<string, unknown>;
  free: boolean;
}

export interface ProviderMetrics {
  providerId: string;
  status: ProviderHealth;
  latencyMs: number;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastCheck: number;
  updatedAt: number;
}

export class ProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`Provider ${providerId} is not configured`);
    this.name = "ProviderNotConfiguredError";
  }
}
