# Configuration

Environment variables are documented in `.env.example`.

Required: `DISCORD_TOKEN`, `AI_API_KEY`, `DATABASE_URL`
Optional: `AI_PROVIDER`, `AI_MODEL`, `LOG_LEVEL`, `PORT`

## Autonomy Modes

- **MANUAL**: Only explicit user actions
- **ASSISTED** (Default): Agent may make low-risk decisions
- **AUTONOMOUS**: Agent pursues goals independently
