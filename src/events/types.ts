export enum ConnectionState { CREATED = "CREATED", CONNECTING = "CONNECTING", CONNECTED = "CONNECTED", RECONNECTING = "RECONNECTING", DISCONNECTED = "DISCONNECTED", STOPPING = "STOPPING", STOPPED = "STOPPED", ERROR = "ERROR" }
export enum AgentState { IDLE = "IDLE", PLANNING = "PLANNING", RUNNING = "RUNNING", PAUSED = "PAUSED", STOPPING = "STOPPING", ERROR = "ERROR" }
export enum GoalStatus { CREATED = "CREATED", PLANNING = "PLANNING", RUNNING = "RUNNING", PAUSED = "PAUSED", COMPLETED = "COMPLETED", FAILED = "FAILED", CANCELLED = "CANCELLED" }
export interface Position { x: number; y: number; z: number; }
export interface MinecraftState { health: number; food: number; position: Position; velocity: Position; dimension: string; inventory: string[]; equipment: Record<string, string>; time: number; nearbyEntities: string[]; nearbyBlocks: string[]; connectionState: ConnectionState; }
export interface AgentInfo { agentState: AgentState; currentGoalId: string | null; activity: string; minecraftState: ConnectionState; discordState: ConnectionState; aiState: "READY" | "BUSY" | "ERROR"; }
export interface ErrorInfo { code: string; message: string; component: string; sessionId: string | null; goalId: string | null; recoverable: boolean; }
export interface BuildInfo { version: string; commit: string; buildTimestamp: string; environment: string; }
