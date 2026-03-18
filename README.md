# AI_Playground

AI_Playground is a real-time 3D observability interface for AI agents.

PR 1 establishes the foundation for a **truthful live MVP** focused on **OpenClaw runtime visualization first**, with optional OpenAI metadata enrichment where available. This repository intentionally does **not** start with a fake clickable demo. Instead, it defines the event contracts, translation model, and implementation plan needed to build a live system.

## PR 1 goals

- define the live MVP target clearly
- establish a lightweight TypeScript project structure
- codify raw runtime and visual event schemas
- introduce the runtime-to-visual translation boundary
- provide a minimal shell for future app/server work

## PR 2 goals

- add a concrete runtime ingestion layer for OpenClaw-oriented events
- normalize raw-ish payloads into repository-owned runtime contracts
- validate known event shapes with fixture-driven executable checks
- improve translation coverage so normalized events produce more credible visual output

## Live MVP in one sentence

Stream real OpenClaw runtime events into a browser-based 3D scene, translate them into stable visual actions, and enrich the UI with OpenAI metadata when that data exists.

## Current repository structure

```text
.
├─ docs/
│  └─ architecture.md
├─ src/
│  ├─ app/
│  │  └─ index.ts
│  ├─ contracts/
│  │  ├─ runtime-events.ts
│  │  ├─ visual-events.ts
│  │  └─ index.ts
│  ├─ dev/
│  │  └─ validate-normalization.ts
│  ├─ ingestion/
│  │  ├─ fixtures.ts
│  │  ├─ index.ts
│  │  ├─ openclaw-normalization.ts
│  │  ├─ runtime-ingestion.ts
│  │  └─ types.ts
│  ├─ translators/
│  │  ├─ runtime-to-visual.ts
│  │  └─ index.ts
│  └─ index.ts
├─ Project.md
├─ package.json
├─ tsconfig.json
└─ README.md
```

## What PR 2 adds

### 1. Runtime ingestion + normalization
`src/ingestion/` introduces:
- `OpenClawRuntimeNormalizer` to map raw OpenClaw-ish payloads into stable `RuntimeEvent` objects
- `RuntimeEventIngestion` as a tiny subscribe/ingest seam for future streaming adapters
- fixture payloads that reflect plausible upstream event shapes without pretending we already know every final runtime detail

### 2. Better translation coverage
`src/translators/runtime-to-visual.ts` now handles:
- task started/progressed events
- tool started/progressed/completed events
- model response lifecycle events with OpenAI metadata surfaced into UI labels/badges

### 3. Executable validation
`src/dev/validate-normalization.ts` provides a small fixture-driven validation path.

Run it with:

```bash
npm run validate:normalization
```

## Why this is still intentionally lightweight

This still avoids a full frontend scaffold. The useful work here is making the runtime edge more real:
- a place for raw upstream events to enter the system
- normalization rules owned by this repo instead of implied by comments
- a fast way to validate event-shape assumptions before UI work begins

That is enough to make the next PRs build on truth instead of placeholder objects.

## Suggested next steps

1. add a local transport adapter that consumes real OpenClaw gateway/runtime streams
2. introduce session/actor state accumulation so the translator can emit less noisy scene updates
3. scaffold the web client and connect it to normalized + visual event streams
4. add timeline and inspector panels before richer 3D scene work
