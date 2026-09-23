# Architecture

Ashbound is a layered autonomous AI agent system:

## Layers

1. **Discord Layer** - User input, authorization, status display
2. **Agent Layer** - Goals, planning, reasoning, evaluation
3. **Tools Layer** - Validate and execute actions
4. **Minecraft Layer** - Connection, world state, execution
5. **Memory Layer** - Persistent knowledge
6. **Sessions Layer** - Connection lifecycle
7. **Events Layer** - Communication between subsystems
8. **Storage Layer** - Data persistence (SQLite)
9. **AI Layer** - LLM integration

## Agent States

| State | Description |
|-------|-------------|
| IDLE | Not executing any goal |
| PLANNING | Creating a plan |
| RUNNING | Executing a plan |
| PAUSED | Temporarily stopped |
| ERROR | Error occurred |

## Connection States

| State | Description |
|-------|-------------|
| CREATED | Session initialized |
| CONNECTING | Attempting connection |
| CONNECTED | Successfully connected |
| DISCONNECTED | Disconnected |
| ERROR | Connection error |

## Goal States

| State | Description |
|-------|-------------|
| CREATED | Goal created but not started |
| RUNNING | Plan being executed |
| PAUSED | Goal paused |
| COMPLETED | Goal completed |
| FAILED | Goal failed |
| CANCELLED | Goal cancelled |

## AI Cost Control

- AI is used for planning, decision making, evaluation
- Deterministic code handles movement, pathfinding, inventory
- AI is NOT called every game tick
