# Harbor Eval Studio

An agentic workbench that turns operational workflows into validated Harbor eval task packs and publishes them to the Harbor registry.

## Quick start

```bash
npm install
cp .env.example .env.local            # add at least one LLM key for live mode
npm run db:migrate                    # optional: persist sessions to Postgres
npm run dev                           # http://localhost:3000
```

## Live mode setup

The workbench runs in **live mode only** — real LLM orchestration via the Vercel AI SDK.

```bash
cp .env.example .env.local
# Add at least one LLM key to .env.local
npm run check:env             # verify keys + harbor + gh
harbor auth login             # required for registry publish
npm run dev                   # restart after editing .env.local
```

Required for chat/tools:

- At least one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`

Required for registry publish (default):

- `harbor auth login`
- `HARBOR_PUBLISH_ORG` in `.env.local`
- `harbor` on `$PATH` (or `HARBOR_BIN`)

Optional GitHub export (`PUBLISH_TARGET=github` or `both`):

- `gh auth login`

## Workflow

1. Open `/`. Describe your workflow in chat or the briefing panel.
2. `/weakness` maps 5–10 weakness candidates (`map_workflow_weaknesses`).
3. Approve candidates in the **Map** tab, then batch probe → decision report.
4. For promoted weaknesses: scaffold → fixtures → lint → oracle/nop/target sweeps (pass@3 = 3 trials) → audit.
5. **Publish** pushes to [Harbor hub](https://hub.harborframework.com) via `harbor publish`. Enable GitHub export in the dialog if needed.

## Smoke tests

```bash
npm run smoke:harbor      # golden pack: validate + oracle/nop (no dev server)
npm run smoke:pipeline    # full SSE pipeline against localhost:3000
```

## Persistence

```bash
docker run -d --name abundant-pg -e POSTGRES_USER=abundant -e POSTGRES_PASSWORD=abundant -e POSTGRES_DB=abundant_harbor -p 5432:5432 postgres:16
npm run db:migrate
```

Workbench state auto-saves to `workspace_sessions` after each agent turn (`GET/POST /api/projects`).

## Key routes

- `/` workbench.
- `POST /api/agent` SSE stream of `AgentEvent`s.
- `POST /api/publish` materialize + validate + `harbor publish` (+ optional `gh` export).
- `GET /api/env/status` — LLM keys, harbor auth, publish org.
- `GET/POST /api/projects` — list/save session snapshots.
- `GET /api/projects/[id]/state` — hydrate a saved session.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘B` / `Ctrl+B` | Toggle file explorer |
| `⌘J` / `Ctrl+J` | Focus chat composer |
| `⌘E` / `Ctrl+E` | Open briefing |
| `Esc` | Close modal |

## Architecture

- `lib/agent/llm-runtime.ts` — AI SDK orchestration, slash routing.
- `lib/agent/llm-tools.ts` — map/probe/scaffold/sweep/publish tools.
- `lib/ai/weakness-map.ts` — multi-candidate WeaknessReport.
- `lib/harbor/task-toml.ts` + `validate-task.ts` — Harbor-valid packs.
- `lib/harbor/connector.ts` — registry publish flow.
- `lib/db/sessions.ts` — Postgres session snapshots.
- `DESIGN.md` — UI principles and component inventory.
