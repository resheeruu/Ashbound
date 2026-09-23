# Ashbound

An autonomous AI agent that can inhabit interactive environments. Minecraft is the first environment. Discord is the human interface.

Ashbound plans and evaluates goals with an LLM, executes deterministic tool actions (movement, inventory, chat), and persists memory in SQLite. AI is used for planning and decision-making — not every game tick.

This repository is independent of AshenwakeAI. It has its own package name, dependencies, CI, Docker image, and GitHub remote.

## Architecture

| Layer | Role |
|-------|------|
| Discord | User input, commands, status |
| Agent | Goals, planning, evaluation |
| Tools | Validate and execute actions |
| Minecraft | Connection, world state, execution |
| Memory | Persistent knowledge |
| Sessions | Connection lifecycle |
| Events | Cross-subsystem messages |
| Storage | SQLite persistence |
| AI | LLM provider integration |

See [docs/architecture.md](docs/architecture.md) for state machines (agent, connection, goals).

```
Discord command
  → conversation router
  → goal engine (CREATED → RUNNING → COMPLETED | FAILED | CANCELLED)
  → planner (LLM plan)
  → executor (action queue)
  → Minecraft tools / safety checks
  → memory + events + SQLite
```

## Minecraft mode

- Connects as a bot client (`src/minecraft/client.ts`, lifecycle, navigation, perception)
- Registers typed tools (`src/minecraft/tools/`)
- Safety layer enforces host/port/input validation before execution
- Autonomy modes: `MANUAL`, `ASSISTED` (default), `AUTONOMOUS`

Minecraft is an environment adapter — not a game-specific product surface. The agent core (goals/planner/executor) is environment-agnostic.

## Auth modes

| Mode | Meaning |
|------|---------|
| Discord guild | Bot operates inside a configured guild (`DISCORD_GUILD_ID`) |
| Owner / policy | Permission checks in `src/security/permissions.ts` and `src/security/policy.ts` |
| Autonomy | `MANUAL` / `ASSISTED` / `AUTONOMOUS` controls how much the agent may act without confirmation |

Secrets come only from environment variables (`.env` is gitignored). Never commit tokens.

## AI configuration

```bash
AI_PROVIDER=openai          # provider id
AI_API_KEY=...              # required for AI features
AI_MODEL=gpt-4o-mini        # default model
```

Provider interface: `src/ai/provider.ts` (`generate`, `generateStructured`). OpenAI-compatible chat completions over HTTPS. Failures are classified and logged without echoing the API key.

## Memory

- Ephemeral conversation / goal context in-process
- Persistent sessions and guild data in SQLite (`src/storage/`)
- Schema created by `npm run db:migrate` (`scripts/migrate.ts`)

## Goals

Goal state machine in `src/agent/goals/`:

`CREATED → RUNNING → (PAUSED) → COMPLETED | FAILED | CANCELLED`

Planner produces ordered plan steps; executor enqueues tool actions and reports progress back to the goal engine. Covered by unit tests in `tests/unit/agent.test.ts`.

## Install

Requires Node.js >= 22.

```bash
git clone https://github.com/resheeruu/Ashbound.git
cd Ashbound
npm ci
cp .env.example .env   # then fill in values
npm run db:migrate
```

## Run

```bash
# development (tsx)
npm run dev

# production
npm run build
npm start

# Docker
docker build -t ashbound .
docker-compose up -d
```

Health check: `curl http://localhost:9002/health` (when the HTTP surface is enabled).

## Test

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc → dist/
npm test            # unit tests (node:test via tsx)
```

## Configuration

All environment variables are listed in [.env.example](.env.example). Required: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `AI_API_KEY`, `DATABASE_URL`. Details: [docs/configuration.md](docs/configuration.md).

## Project layout

```
src/
  agent/        goals, planner, executor, evaluator
  ai/           provider interface, OpenAI adapter
  bootstrap/    graceful shutdown, startup
  config/       env loading and validation
  discord/      client and command handler
  events/       event bus and types
  memory/       memory manager
  minecraft/    client, lifecycle, navigation, tools
  security/     permissions, policy
  sessions/     session model
  storage/      SQLite database and repositories
scripts/        migrate, healthcheck
tests/unit/     node:test suites
docs/           architecture, configuration, development, deployment
```

## Relationship to AshenwakeAI

Ashbound was extracted from the AshenwakeAI monorepo history into this standalone repository. AshenwakeAI no longer contains Ashbound runtime sources. This project does not import AshenwakeAI packages, configs, or test runners.

## License

MIT — see [LICENSE](LICENSE).
