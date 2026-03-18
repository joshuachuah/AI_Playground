# AI_Playground

AI_Playground is a real-time 3D observability interface for AI agents.

Instead of forcing people to understand agent execution through logs, chat transcripts, or tool traces alone, AI_Playground turns live runtime activity into a visual world. Bots appear as entities in a shared scene, move between work zones, and expose what they are doing in a way that is easier to read, debug, and demo.

The current direction is **live OpenClaw-first visualization**, with **OpenAI metadata enrichment** where available.

## What the project does

AI_Playground is being built to:

- visualize real AI/agent runtime activity in real time
- map runtime events into readable visual states and movements
- make agent workflows easier to understand and debug
- provide a more intuitive interface for demos, monitoring, and experimentation
- show what is happening now without pretending the system is doing something it is not

In practical terms, the project is aiming for a flow like this:

1. OpenClaw runs a real task
2. runtime events are captured and normalized
3. those events are translated into scene-friendly visual events
4. the browser renders entities, status, and timeline updates live
5. the UI shows extra metadata such as model/provider/tool context when available

## Product philosophy

AI_Playground is **not** intended to be a fake animation demo or a game.

The goal is:
- **truthful abstraction**, not spectacle
- **observability**, not roleplay
- **clarity**, not noisy literal playback

That means the system should summarize runtime behavior honestly:
- if an agent is waiting, it should look like waiting
- if a tool failed, that failure should be visible
- if a model response completed, the UI should reflect that terminal state correctly

## Current architecture direction

The repo is structured around a few core layers:

### 1. Runtime ingestion
Accept raw or semi-structured runtime signals from OpenClaw-oriented sources.

### 2. Normalization
Convert upstream payloads into a repo-owned runtime event contract.

### 3. Translation
Map runtime events into visual events that a scene/UI can render clearly.

### 4. Visualization client
A future browser client will render:
- scene zones
- runtime entities/bots
- live activity states
- timeline/details panels

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
│  │  ├─ runtime-events.typecheck.ts
│  │  ├─ visual-events.ts
│  │  └─ index.ts
│  ├─ ingestion/
│  │  ├─ fixtures.ts
│  │  ├─ openclaw-normalization.ts
│  │  ├─ runtime-ingestion.ts
│  │  ├─ types.ts
│  │  └─ index.ts
│  ├─ translators/
│  │  ├─ runtime-to-visual.ts
│  │  └─ index.ts
│  ├─ dev/
│  │  └─ validate-normalization.ts
│  └─ index.ts
├─ Project.md
├─ package.json
├─ tsconfig.json
└─ README.md
```

## What exists right now

The project currently includes the engineering foundation for the live MVP:

- a repo-owned runtime event contract
- a visual event contract
- an OpenClaw-oriented normalization layer
- a runtime-to-visual translator layer
- fixture-driven validation for normalization and translation behavior
- architecture documentation for the live MVP

This is intentionally foundation-first. The goal was to lock in the event model and translation seam before investing in UI and rendering work.

## What does not exist yet

Not built yet:

- the full frontend app
- the 3D scene
- live browser transport/wiring
- real-time OpenClaw stream integration end-to-end
- replay/history UI
- multi-agent scene orchestration

Those come after the event pipeline is solid.

## Why the repo is still lightweight

The highest-leverage work early on is not graphics boilerplate.
It is:

- defining the event contracts
- keeping runtime normalization honest
- making translation behavior safe and understandable
- preventing the UI from becoming misleading later

That is why the repository currently focuses more on contracts, ingestion, and translation than on framework-heavy frontend setup.

## Near-term roadmap

### Done
- define runtime event contract
- define visual event contract
- establish translation layer
- add normalization layer for OpenClaw-style events
- add validation for key normalization/translation paths

### Next
- build live transport from runtime to browser
- scaffold the frontend shell
- render timeline/details UI
- introduce scene zones and entity state rendering
- connect the live event pipeline to the UI

## Tech direction

Current foundation:
- TypeScript
- lightweight contract-first architecture

Planned implementation direction:
- Next.js
- React
- React Three Fiber
- Zustand
- WebSocket/SSE-style live event delivery

## More detail

For deeper implementation notes, see:
- `Project.md`
- `docs/architecture.md`
