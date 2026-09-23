export enum ConnectionState { CREATED = "CREATED", CONNECTING = "CONNECTING", CONNECTED = "CONNECTED", RECONNECTING = "RECONNECTING", DISCONNECTED = "DISCONNECTED", STOPPING = "STOPPING", STOPPED = "STOPPED", ERROR = "ERROR" }
export enum AgentState { IDLE = "IDLE", PLANNING = "PLANNING", RUNNING = "RUNNING", PAUSED = "PAUSED", STOPPING = "STOPPING", ERROR = "ERROR" }
export enum GoalStatus { CREATED = "CREATED", PLANNING = "PLANNING", RUNNING = "RUNNING", PAUSED = "PAUSED", COMPLETED = "COMPLETED", FAILED = "FAILED", CANCELLED = "CANCELLED" }
export enum GuildRole { VIEWER = "VIEWER", MEMBER = "MEMBER", OPERATOR = "OPERATOR", OWNER = "OWNER" }
export enum ActionRisk { LOW = "LOW", MEDIUM = "MEDIUM", HIGH = "HIGH", CRITICAL = "CRITICAL" }
export enum AutonomyMode { SAFE = "SAFE", ASSISTED = "ASSISTED", AUTONOMOUS = "AUTONOMOUS" }
export enum ProviderHealth { HEALTHY = "HEALTHY", DEGRADED = "DEGRADED", RATE_LIMITED = "RATE_LIMITED", TIMEOUT = "TIMEOUT", DISABLED = "DISABLED", UNKNOWN = "UNKNOWN" }
export enum ResourceLevel { NORMAL = "NORMAL", WARNING = "WARNING", RESTRICTED = "RESTRICTED", EMERGENCY = "EMERGENCY" }
export enum AuditEventType { SESSION_CREATED = "SESSION_CREATED", SESSION_STOPPED = "SESSION_STOPPED", SESSION_CONNECTED = "SESSION_CONNECTED", SESSION_DISCONNECTED = "SESSION_DISCONNECTED", GOAL_CREATED = "GOAL_CREATED", GOAL_CANCELLED = "GOAL_CANCELLED", PERMISSION_CHANGED = "PERMISSION_CHANGED", PROVIDER_CHANGED = "PROVIDER_CHANGED", SETTING_CHANGED = "SETTING_CHANGED", AI_PROVIDER_FAILED = "AI_PROVIDER_FAILED", SECURITY_ALERT = "SECURITY_ALERT" }
export interface Position { x: number; y: number; z: number; }
export interface MinecraftState { health: number; food: number; position: Position; velocity: Position; dimension: string; inventory: string[]; equipment: Record<string, string>; time: number; nearbyEntities: string[]; nearbyBlocks: string[]; connectionState: ConnectionState; }
export interface AgentInfo { agentState: AgentState; currentGoalId: string | null; activity: string; minecraftState: ConnectionState; discordState: ConnectionState; aiState: "READY" | "BUSY" | "ERROR"; }
export interface ErrorInfo { code: string; message: string; component: string; sessionId: string | null; goalId: string | null; recoverable: boolean; }
export interface BuildInfo { version: string; commit: string; buildTimestamp: string; environment: string; }
export interface ProviderInfo { id: string; name: string; status: string; priority: number; endpoint: string | undefined; config: Record<string, unknown>; free: boolean; latency: number | null; models: ModelInfo[]; circuitState: string; failures: number; lastVerified: number; }
export interface ModelInfo { id: string; name: string; providerId: string; supportsStructuredOutput: boolean; supportsTools: boolean; supportsStreaming: boolean; supportsVision: boolean; free: boolean; role: string; }
export interface GoalProgressed { goalId: string; progress: number; }
