# Harbor Eval Studio

An agentic workbench that turns operational workflows into validated Harbor eval task packs and ships them to GitHub.

## Quick start

```bash
npm install
cp .env.example .env.local            # add at least one LLM key for live mode
npm run dev                           # http://localhost:3000
```

## Modes

- **Live**: real LLM orchestrator (Vercel AI SDK + your API keys) drives the chat. Tools call real probes against the target model, scaffold/fixture generators, and the real `harbor` CLI for sweeps.
- **Demo**: scripted ds-25 walkthrough. Works without API keys.

Toggle from the top bar. Demo is forced (with a warning toast) when no API key is present.

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
3. Hit **Publish** in the top bar (or `/publish` in chat) to push the canonical Harbor task pack to a brand-new GitHub repo via the `gh` CLI. Validation runs oracle + nop locally first and blocks publish if either fails.

## Snapshots

```bash
npm run snapshot -- "label-this-checkpoint"
```

Or use the **Snapshots** button in the top bar. Restore from the snapshot list — the working tree must be clean.

## Key routes

- `/` workbench.
- `POST /api/agent` SSE stream of `AgentEvent`s. Accepts `{ input, mode, history, workspace, trialsPerVariant? }`.
- `GET /api/snapshots` list tags. `POST /api/snapshots {label}` create one. `POST /api/snapshots/restore {tag}` reset to one.
- `POST /api/publish` materialize + validate + push to GitHub via `gh`.
- `GET /api/env/status` reports which provider keys + binaries are available.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘B` / `Ctrl+B` | Toggle task pack drawer |
| `⌘J` / `Ctrl+J` | Focus chat composer |
| `Enter` (in chat) | Send message |
| `Shift+Enter` | Newline in chat |
| `Esc` | Close modal / drawer |

## Architecture

- `lib/agent/llm-runtime.ts` AI SDK `streamText` loop, maps to the SSE protocol.
- `lib/agent/llm-tools.ts` AI SDK `tool()` defs backed by real impls; auto-lints on instruction/policy writes.
- `lib/ai/*` real implementations: workflow intake, probe runner, scaffold generator, fixture generator, spoiler lint (regex + LLM), trajectory audit.
- `lib/harbor/adapter.ts` spawns the `harbor` CLI.
- `lib/harbor/materialize.ts` writes the canonical Harbor scaffold to disk from the in-app workspace.
- `lib/harbor/connector.ts` validates + creates the GitHub repo and pushes the pack.
- `lib/agent/scripted-runtime.ts` deterministic ds-25 walkthrough for Demo mode.
- `lib/snapshot/git.ts` git tag + restore helpers driving the snapshot menu.
