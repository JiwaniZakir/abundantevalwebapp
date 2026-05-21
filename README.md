# Harbor Eval Studio

An agentic workbench that turns operational workflows into validated Harbor eval task packs and ships them to GitHub.

## Quick start

```bash
npm install
cp .env.example .env.local            # add at least one LLM key for live mode
docker compose up -d                  # optional, only if you use the DB seed
npm run dev                           # http://localhost:3000
```

## Modes

- **Live**: real LLM orchestrator (Vercel AI SDK + your API keys) drives the chat. Tools call real probes against the target model, real fixture/scaffold/lint/audit generators, and the real `harbor` CLI for sweeps.
- **Demo**: scripted ds-25 walkthrough. Works without API keys.

Toggle from the top bar. Demo is forced if no API key is present.

## Prerequisites

- Node 18+.
- `gh` authenticated for the publish connector (`gh auth status`).
- `harbor` on `$PATH` for real sweeps (set `HARBOR_BIN` to override).
- Optional API keys (any one enables Live mode):
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `GOOGLE_GENERATIVE_AI_API_KEY`

## Workflow

1. Open `/`. Describe your workflow in the intake panel.
2. The orchestrator calls `intake_workflow` to derive a weakness card, then walks the pipeline (probe → scaffold → fixtures → verifier → sweep → audit → iterate).
3. Hit **Publish** in the top bar (or the Publish stage briefing) to push the canonical Harbor task pack to a brand-new GitHub repo via the `gh` CLI.

## Snapshots

```bash
npm run snapshot -- "label-this-checkpoint"
```

Creates a git commit + signed tag like `snapshot/2026-05-21t070000z-label-this-checkpoint`, then pushes both to `origin`. The Snapshots menu in the top bar lists recent snapshots and also creates new ones.

## Key routes

- `/` workbench.
- `/api/agent` SSE stream of `AgentEvent`s. Accepts `{ input, mode, history, workspace }`.
- `/api/snapshots` `GET` lists tags, `POST { label }` creates one.
- `/api/publish` SSE that materializes the workspace, validates oracle/nop, and creates a fresh GitHub repo.
- `/api/env/status` reports which provider keys are loaded.

## Architecture

- `lib/agent/llm-runtime.ts` AI SDK `streamText` loop, maps to the SSE protocol.
- `lib/agent/llm-tools.ts` AI SDK `tool()` defs backed by real impls.
- `lib/ai/*` real implementations: workflow intake, probe runner, scaffold generator, fixture generator, spoiler lint, trajectory audit.
- `lib/harbor/adapter.ts` spawns the `harbor` CLI.
- `lib/harbor/materialize.ts` writes the canonical Harbor scaffold to disk from the in-app workspace.
- `lib/harbor/connector.ts` validates + creates the GitHub repo and pushes the pack.
- `lib/agent/scripted-runtime.ts` deterministic ds-25 walkthrough for Demo mode.
