# Harbor Eval Studio — Design System

Design principles and component inventory for the workbench UI.

## Principles

1. **Show the loop** — Chat, tool cards, and live feeds expose agent progress; never silent success on failures.
2. **Health first** — Default panel tab is the task checklist; results are secondary navigation.
3. **Honest metrics** — pass@3 means three trials; probe copy reflects 15 trials per variant.
4. **Stale over wrong** — After artifact edits, mark probe/sweep/audit/spoiler results stale until re-run.
5. **Focus surfaces** — Briefing, artifacts, and result cards share one focus column; tabs when unfocused.
6. **Registry-native publish** — Success links to Harbor hub; GitHub is optional export.
7. **Multi-weakness path** — Weakness map → batch probe → decision report → per-task scaffold.
8. **Minimal chrome** — Top bar: project name, stage pills, model picker, env badge, palette.
9. **Tokens from globals** — Use `--fg`, `--accent`, `--green-soft`, etc. from `app/globals.css`.
10. **Mono for paths** — Artifact paths, slugs, and CLI refs use `.mono`.
11. **Expandable tool cards** — Duration, args, truncated JSON, deep links to sweep results.
12. **Matrix for probes** — Toggle bars vs trial matrix on probe results.
13. **Trajectory on audit** — Failure classification plus step timeline when available.
14. **Motion sparingly** — Pulse for streaming; no decorative animation on data tables.

## Component inventory

| Area | Components |
|------|------------|
| Shell | `TopBar`, `LiveSetupBanner`, `NoticeStack`, `CommandPalette` |
| Left | `FileExplorer`, `CodeView` |
| Center | `Chat`, `ToolCallCard` |
| Right | `AgentPanel`, `TaskHealthChecklist`, `WeaknessMapPanel`, `BriefingPanel`, result cards |
| Live | `SweepLiveFeed`, `ProbeMatrix`, `TrajectoryPanel` |
| Publish | `PublishDialog` |
| Model | `ModelPicker` |

## Motion rules

- Streaming indicator: `animate-pulse` on 6px dot only.
- Tab transitions: color/border only, no layout animation.
- Dialog: backdrop blur + static enter (no slide).
