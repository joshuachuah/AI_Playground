# AI_Playground

AI_Playground is a real-time 3D observability interface for AI agents.

PR 1 establishes the foundation for a **truthful live MVP** focused on **OpenClaw runtime visualization first**, with optional OpenAI metadata enrichment where available. This repository intentionally does **not** start with a fake clickable demo. Instead, it defines the event contracts, translation model, and implementation plan needed to build a live system.

## PR 1 goals

- define the live MVP target clearly
- establish a lightweight TypeScript project structure
- codify raw runtime and visual event schemas
- introduce the runtime-to-visual translation boundary
- provide a minimal shell for future app/server work

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
│  ├─ translators/
│  │  ├─ runtime-to-visual.ts
│  │  └─ index.ts
│  └─ index.ts
├─ Project.md
├─ package.json
├─ tsconfig.json
└─ README.md
```

## What PR 1 adds

### 1. Shared contracts
`src/contracts/` defines the foundational TypeScript interfaces for:
- raw runtime events emitted by OpenClaw-adjacent systems
- visual events consumed by the future scene/UI
- session, actor, tool, artifact, and metadata types

### 2. Translation boundary
`src/translators/runtime-to-visual.ts` adds a small, explicit translator interface and placeholder implementation shape. This is the seam where noisy runtime events will be compressed into scene-readable actions.

### 3. Documentation
`docs/architecture.md` defines:
- MVP goal
- architecture
- raw runtime event schema
- visual event schema
- translation strategy
- roadmap for follow-up PRs

### 4. Minimal app shell
`src/app/index.ts` provides a tiny placeholder entry point describing the future live client responsibilities without adding framework boilerplate yet.

## Why this is intentionally lightweight

A full Next.js or 3D app bootstrap at this stage would add noise faster than value. The highest-leverage work for PR 1 is to lock in:
- the product direction
- the contract between runtime and visualization
- the shape of future implementation work

That gives future PRs a clear path to build a real streaming system instead of a disposable prototype.

## Suggested next steps

1. add a local event ingestion/server layer for OpenClaw runtime streams
2. implement a deterministic translator with stateful bot/session tracking
3. scaffold the web client and event timeline UI
4. add scene zones and initial bot movement/state rendering
5. integrate OpenAI metadata enrichment and inspection panels
