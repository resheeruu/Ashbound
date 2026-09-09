ASHBOUND — IMPORT THE COMPLETE CURRENT FREELLMAPI PROVIDER CATALOG

OBJECTIVE

Upgrade the existing Ashbound Discord AI bot so its provider/model coverage is functionally equivalent to the current upstream FreeLLMAPI provider catalog, while preserving Ashbound's existing architecture and every existing feature.

Do NOT install FreeLLMAPI as a separate service.

Do NOT replace Ashbound with FreeLLMAPI.

Do NOT create a second router/provider architecture.

Do NOT remove or disable any existing Ashbound provider.

The result must remain:

- one Ashbound Discord bot
- one existing AI router
- one provider registry
- one health system
- one rate-limit system
- one model catalog
- one tool system
- existing Discord functionality
- existing memory/conversation
- existing personality
- existing music/voice functionality
- existing web server
- existing security architecture

---

1. SOURCE OF TRUTH

Inspect the CURRENT upstream FreeLLMAPI repository before making changes.

Repository:

https://github.com/tashfeenahmed/freellmapi

Relevant areas include:

- "server/src/providers/"
- "server/src/providers/index.ts"
- model catalog/database definitions
- provider configuration
- router
- rate limiting
- model capability metadata
- provider health behavior

Do not rely on an old provider list from memory or from an outdated audit.

FreeLLMAPI's catalog is dynamic and currently advertises approximately 29 free providers and hundreds of free model endpoints. The provider list can change over time.

Therefore:

1. Inspect the actual current provider registry.
2. Extract every provider.
3. Extract supported models/endpoints where practical.
4. Compare against Ashbound's ACTUAL provider registry.
5. Produce an internal provider diff.
6. Implement every missing provider.
7. Do not duplicate providers Ashbound already supports.

---

2. REQUIRED PROVIDER MIGRATION

For every FreeLLMAPI provider that Ashbound does not already support:

- add a native Ashbound provider adapter
- register it in Ashbound's existing provider registry
- add configuration/env variables following Ashbound's existing conventions
- add default models based on the current FreeLLMAPI catalog
- add capability metadata
- add streaming support where the upstream supports it
- add tool-calling capability where actually supported
- add vision capability where actually supported
- add context-window metadata
- add model aliases/groups where appropriate
- add health integration
- add rate-limit metadata where available
- add failure classification integration
- add fallback compatibility
- add tests

Use Ashbound's existing provider interface and abstractions.

Do NOT create another provider framework.

---

3. IMPORTANT: DO NOT DUPLICATE EXISTING PROVIDERS

Before creating a provider:

Compare FreeLLMAPI's provider against Ashbound's registry.

If Ashbound already has the provider:

DO NOT create another adapter.

Instead:

- update its model catalog if FreeLLMAPI has newer models
- update capability metadata
- update aliases/groups
- update free-model metadata
- update rate-limit metadata when appropriate
- preserve Ashbound's existing implementation unless a compatibility improvement is genuinely required

Examples of providers that may already exist in Ashbound include:

- Google/Gemini
- Groq
- Cerebras
- Mistral
- OpenRouter
- Cohere
- NVIDIA
- Cloudflare
- HuggingFace
- Zhipu/Z.ai
- GitHub Models
- Ollama
- Pollinations
- OpenCode Zen
- custom OpenAI-compatible endpoint

Do not assume the list above is complete.

Inspect the actual code.

---

4. PROVIDERS THAT ARE FREE VS OPTIONAL/PAID

Do NOT claim that every upstream API is universally free.

FreeLLMAPI aggregates free tiers/free routes.

A provider may:

- require an API key
- have a limited free tier
- have anonymous free access
- have promotional/free models
- have paid models alongside free models
- change its free quota

Ashbound must represent this correctly in model/provider metadata.

Never silently route a user to a paid model merely because the provider exists.

Preserve Ashbound's existing provider configuration model.

---

5. FREE MODEL CATALOG

Extend Ashbound's existing "modelCatalog.ts".

Do NOT create another model catalog.

Add the current FreeLLMAPI-supported free models/endpoints that are relevant to chat inference.

For each model store, where available:

- provider
- model ID
- display name
- aliases
- model group
- context window
- supports streaming
- supports tools
- supports vision
- free/paid classification
- availability
- rate-limit metadata
- priority/weight

Do not blindly copy hundreds of stale models.

Prefer the CURRENT upstream registry/catalog.

If FreeLLMAPI obtains a model dynamically, design Ashbound's catalog so it can be updated without restructuring the entire bot.

---

6. DYNAMIC CATALOG

Inspect how FreeLLMAPI maintains its current model catalog.

If a safe, lightweight equivalent can be implemented in Ashbound without introducing unnecessary dependencies, add it to Ashbound's existing model catalog.

Requirements:

- no SQLite requirement
- Termux compatible
- no separate FreeLLMAPI server
- no duplicated router
- safe failure if catalog update is unavailable
- existing static catalog remains usable
- no startup failure because a catalog update fails
- sanitize all catalog/update logs
- never download or execute arbitrary code

A remote catalog must NEVER override security policy.

Capabilities and permissions must remain controlled by Ashbound.

---

7. ROUTER INTEGRATION

Use Ashbound's existing "src/ai/router.ts".

Do NOT create "router2.ts".

All new providers must participate in:

- health scoring
- latency scoring
- capability filtering
- rate-limit headroom
- cooldowns
- in-flight leases
- provider failure classification
- model availability
- fallback
- model weights

The router must never select a model that cannot satisfy the request.

Examples:

If request requires vision:

- exclude models without vision.

If request requires tools:

- exclude models without tool calling.

If request requires a large context:

- exclude models whose context window is insufficient.

If provider is rate limited:

- exclude it until eligible.

If provider credentials are invalid:

- mark appropriately and avoid repeatedly hammering it.

If transport failure occurs:

- classify as transient and apply existing cooldown logic.

---

8. HEALTH SYSTEM

Use existing:

"src/ai/health.ts"

Do not create another health implementation.

Every newly added provider must integrate with:

- health status
- periodic probes
- cooldown
- transport-error detection
- invalid-credential detection
- consecutive failure tracking
- recovery

Health probes must never log:

- API keys
- bearer tokens
- authorization headers
- credentials
- secret URLs
- sensitive response bodies

Use "SecretRedactor".

---

9. RATE LIMITING

Use existing:

"src/ai/rateLimit.ts"

Do not create another rate limiter.

Where provider documentation exposes limits, represent them appropriately:

- RPM
- RPD
- TPM
- TPD
- concurrency

Continue using:

- provider-level limits
- model-level limits
- key-level limits
- leases
- cooldowns
- provisional token accounting

Never invent quota values.

If the upstream quota is unknown, leave it unknown rather than fabricating a limit.

---

10. CONFIGURATION

Extend the existing configuration system.

Do NOT hard-code credentials.

For each newly added provider:

- add API key env variable if required
- add model env variable if appropriate
- add base URL if appropriate
- add timeout if appropriate
- document it in ".env.example"

Follow the naming conventions already used by Ashbound.

Do not make newly added providers mandatory.

Ashbound must still start with only:

- "DISCORD_TOKEN"
- "DISCORD_CLIENT_ID"

and zero AI providers, exactly as the current architecture allows.

If no AI provider is configured:

- Discord bot may start
- AI functionality reports unavailable
- startup must not crash

---

11. CUSTOM OPENAI-COMPATIBLE SUPPORT

FreeLLMAPI supports custom OpenAI-compatible endpoints.

Ashbound already has custom endpoint functionality.

DO NOT create another custom provider.

Improve the existing custom provider if required so it can cover the same relevant compatibility surface:

- OpenAI-compatible chat
- streaming
- tools
- vision where endpoint supports it
- configurable model
- configurable base URL
- timeout
- fallback
- health
- rate limiting

---

12. FREE ROUTES / ANONYMOUS PROVIDERS

Some FreeLLMAPI providers may support anonymous/free routes.

Inspect their actual implementation.

If a provider can be safely integrated without credentials:

- add it as keyless if appropriate
- enforce upstream rate limits
- integrate it into health/routing
- never treat anonymous access as guaranteed
- disable gracefully when unavailable

Do not add unsafe scraping or undocumented private endpoints.

Do not bypass authentication, quotas, CAPTCHAs, or provider restrictions.

---

13. WEB SECURITY MUST NOT CHANGE

Ashbound's web tools are OWNER/CREATOR ONLY.

Preserve:

"DISCORD_OWNER_ID"

Web search/fetch authorization MUST remain enforced at the tool execution boundary.

Adding providers must NOT give any provider the ability to bypass this.

Do not enable provider-native web search/grounding if doing so would bypass Ashbound's existing owner-only security boundary.

If a provider has native search/grounding:

- inspect it
- determine whether it can safely be exposed through Ashbound
- default to Ashbound's existing owner-only web tool boundary
- do not weaken permissions

SSRF protection remains mandatory.

---

14. SECURITY

Never expose secrets.

Audit every new provider adapter for:

- authorization headers
- API keys
- request logging
- error logging
- URLs containing credentials
- response logging

All errors must pass through the existing sanitization/redaction system.

Never log complete provider responses in production.

Never print ".env".

Never print API keys.

Never print bearer tokens.

Never include credentials in thrown error messages.

---

15. DISCORD + MUSIC MUST REMAIN UNTOUCHED

Do NOT modify or remove:

- Discord gateway behavior
- Discord commands
- music commands
- voice connection
- Discord Player
- audio extractors
- Lavalink integration if present
- existing web server
- memory system
- personality system

Provider work must remain isolated to the existing AI/provider architecture.

---

16. TESTING

For every new provider:

Add provider-specific tests covering:

- configuration detection
- request construction
- response parsing
- streaming where supported
- error handling
- authentication failure
- rate-limit failure
- timeout
- health behavior
- capability metadata
- router selection
- fallback

Add integration tests confirming:

- existing providers still work
- new providers participate in routing
- unavailable providers are skipped
- rate-limited providers are skipped
- incompatible models are skipped
- fallback works
- no web permission bypass occurs
- no secrets appear in logs

Run:

npm run typecheck
npm run build
npm test

All must pass.

Do not declare success if any test fails.

---

17. NO ARCHITECTURE DUPLICATION

Forbidden:

- router2.ts
- health2.ts
- rateLimit2.ts
- providerRegistry2.ts
- modelCatalog2.ts
- separate FreeLLMAPI server
- Docker FreeLLMAPI dependency
- duplicate tool system
- duplicate memory system

Extend the existing Ashbound architecture.

---

18. ACTUAL PROVIDER DIFF REPORT

Before implementation, produce:

FreeLLMAPI providers discovered

[number]

Ashbound providers discovered

[number]

Already supported

[list]

Missing from Ashbound

[list]

Needs model-catalog update only

[list]

Needs new provider adapter

[list]

Unsupported/incompatible providers

[list + reason]

Then implement the missing provider adapters.

Do NOT stop after the report.

---

19. FINAL VERIFICATION REPORT

At the end report:

Provider Coverage

Provider| FreeLLMAPI| Ashbound Before| Ashbound After| Status

Model Coverage

Report:

- providers added
- models added
- aliases added
- capability metadata added
- free models added

Architecture

Confirm:

- one router
- one provider registry
- one health system
- one rate limiter
- one model catalog
- one tool system
- no FreeLLMAPI service installed

Existing Features

Confirm:

- Discord
- AI
- memory
- personality
- commands
- music
- voice
- web server
- security
- web tools
- routing
- fallback

remain functional.

Security

Confirm:

- owner-only web access
- SSRF protection
- secret redaction
- no credentials in logs
- no provider bypasses security

Verification

Run and report exact results for:

"npm run typecheck"

"npm run build"

"npm test"

Do not start the production bot automatically.

Do not modify production secrets.

Do not invent missing API keys.

Do not ask for credentials unless a provider actually requires them.

---

SUCCESS CRITERION

The implementation is complete only when:

Ashbound natively supports every CURRENT FreeLLMAPI provider that can reasonably be integrated into its existing architecture, while retaining all existing Ashbound providers and functionality.

Ashbound must remain Ashbound.

FreeLLMAPI is the provider-coverage reference, NOT a dependency.
