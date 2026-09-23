import { ConnectionState } from "../events/types";

export interface Session {
  id: string;
  ownerId: string;
  host: string;
  port: number;
  username: string;
  guildId: string;
  minecraftVersion: string;
  connectionState: ConnectionState;
  agentState: string;
  autonomy: string;
  currentGoalId: string | null;
  createdAt: string;
  connectedAt: string | null;
  lastActivityAt: string;
}

export interface CreateSessionData {
  ownerId: string;
  host: string;
  port: number;
  username: string;
  guildId: string;
  minecraftVersion?: string;
}
