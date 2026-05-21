# Abundant Harbor Eval Studio

Full-stack Next.js app for automating Harbor eval task design:

- Model + runner registration with run-config lineage
- Weakness mapping against the eight distilled failure modes
- Probe generation and scoring surfaces
- Harbor task scaffold, fixture, verifier, sweep, audit, and iteration flows
- Attio-grade warm-light marketing and product UI

## Quick Start

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Key Routes

- `/` - chaptered marketing site with live mini-demos
- `/projects/new` - run-config/model onboarding
- `/projects/demo-ds25` - redirects to the ds-25 project workspace
- `/projects/demo-ds25/sweeps` - ds-25 revocation cascade sweep view

## Notes

`lib/harbor/adapter.ts` shells to `HARBOR_BIN` and parses `reward.txt`, `ctrf.json`, and trajectory artifacts. The API routes currently expose the queue/stream contract and can be wired to a background worker for long-running Harbor jobs.
