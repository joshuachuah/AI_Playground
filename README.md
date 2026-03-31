# AI_Playground

AI_Playground is a real-time observability interface for AI agent runtimes, currently focused on OpenClaw-first integration.

The goal is to turn real agent and runtime activity into a truthful, readable live interface instead of forcing people to infer behavior from logs, chat transcripts, or raw tool traces alone.

## Project description

AI_Playground is intentionally contract-first and pipeline-oriented:

1. Runtime ingestion
2. OpenClaw adapter boundary
3. Normalization into repo-owned `RuntimeEvent` contracts
4. Translation into `VisualEvent` contracts
5. Store and projection layer
6. Browser visualization layer

The product stance is:

- truthful abstraction over theatrical animation
- readable current state over raw trace overload
- repo-owned contracts over provider-coupled UI logic
- live OpenClaw integration before broader provider coverage

## What is implemented

The repository already includes the current live-pipeline foundation:

- a TypeScript, contract-first architecture
- repo-owned runtime event contracts and visual event contracts
- an explicit OpenClaw adapter boundary
- a default OpenClaw event normalizer that maps loose OpenClaw-style input into typed `RuntimeEvent` values
- OpenClaw-specific SSE, WebSocket, and in-memory transports that normalize raw OpenClaw envelopes before they enter the app and store pipeline
- stricter transport error handling so invalid raw OpenClaw events surface errors instead of failing silently
- expanded runtime-to-visual translation coverage for session events, task start/progress/completion/failure, tool start/completion/failure, message handoff events, artifact events, warnings, and errors
- a runtime visual store that keeps both raw buffers and derived projections for `runtimeEvents`, `visualEvents`, `actorsById`, and `sessionsById`
- actor projections that are session-scoped, remove actors on `actor.removed`, preserve role and kind across sparse events, and clear active tools on task failure
- a lightweight, framework-free local browser dashboard that shows connection state, runtime and visual event counts, warning and error counts, session snapshot, active actors for the current session, event timeline, latest event inspector, and last error
- a built-in test suite covering normalization, transports, translator behavior, store projections, and dashboard rendering helpers

## What is left to build

The main remaining gaps are productizing the current foundation:

- real end-to-end OpenClaw integration against an upstream runtime or daemon instead of only local fixture-backed previews
- a production-grade live endpoint and a realistic local developer flow for OpenClaw
- richer browser controls for filtering, sorting, actor and session selection, and better inspection workflows
- replay and history support for previous runs
- stronger state-machine behavior to stabilize visual state under noisy real streams
- a real scene, spatial, or 3D observability layer
- better multi-agent orchestration UX beyond basic handoff and state representation
- broader provider integrations beyond OpenClaw

## Implementation plan

### Phase 1: Real OpenClaw event pipeline

- connect to a real OpenClaw source
- wire a real SSE and WebSocket path
- validate and harden ingestion and normalization against real upstream behavior
- document a reliable local end-to-end run flow

### Phase 2: Usable browser product

- upgrade the browser UI into a practical observability dashboard
- add session and actor filtering plus explicit selection
- improve inspector and detail workflows
- make derived current-state views central to the UI

### Phase 3: State quality and replay

- strengthen translator, store, and state-machine behavior
- add replay and history for completed runs
- stabilize event-to-visual behavior under realistic stream conditions
- reduce ambiguity and stale state in projections

### Phase 4: Product identity layer

- add a spatial or scene-based observability experience
- keep the visualization truthful rather than theatrical
- improve multi-agent coordination UX
- synchronize scene, inspector, and timeline views cleanly

## Highest-leverage next PR

The single highest-leverage next PR-sized feature is a real OpenClaw live endpoint plus a documented local end-to-end dev flow.

That slice unlocks the rest of the roadmap because it replaces fixture-backed confidence with real-stream confidence. It is also the shortest path to learning where the current normalizer, translator, store projections, and dashboard assumptions break under actual upstream conditions.

## Current repository structure

```text
.
├─ docs/
│  └─ architecture.md
├─ src/
│  ├─ adapters/
│  │  ├─ openclaw.ts
│  │  └─ index.ts
│  ├─ app/
│  │  ├─ index.ts
│  │  └─ live-client-shell.ts
│  ├─ contracts/
│  │  ├─ runtime-events.ts
│  │  ├─ runtime-events.typecheck.ts
│  │  ├─ visual-events.ts
│  │  └─ index.ts
│  ├─ live/
│  │  ├─ transport.ts
│  │  ├─ sse-transport.ts
│  │  └─ index.ts
│  ├─ state/
│  │  ├─ runtime-visual-store.ts
│  │  └─ index.ts
│  ├─ translators/
│  │  ├─ runtime-to-visual.ts
│  │  └─ index.ts
│  ├─ dev/
│  │  └─ live-shell.ts
│  └─ index.ts
├─ Project.md
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Why the repo is still lightweight

The highest-leverage work early on is not graphics boilerplate.
It is:

- defining the event contracts
- keeping runtime normalization honest
- making translation behavior safe and understandable
- preventing the UI from becoming misleading later

That is why the repository currently focuses more on contracts, ingestion, and translation than on framework-heavy frontend setup.

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

## Minimal developer wiring example

```ts
import { createLiveClientShell, createInMemoryRuntimeTransport } from 'ai_playground';

const { shell, store } = createLiveClientShell(createInMemoryRuntimeTransport([]));

store.subscribe((state) => {
  console.log(state.connectionStatus, state.visualEvents.length);
});

await shell.connect();
```

WebSocket transport is also available for live runtime delivery:

```ts
import { createLiveClientShell, WebSocketRuntimeTransport } from 'ai_playground';

const transport = new WebSocketRuntimeTransport({
  url: 'ws://localhost:3000/runtime',
  createWebSocket: (url) => new WebSocket(url),
});

const { shell } = createLiveClientShell(transport);
await shell.connect();
```

For local developer-oriented previews, see `src/dev/live-shell.ts` and `src/dev/live-inspector.ts`.

### OpenClaw dev source selection

The local dashboard and inspector now support three source modes:

- `fixture`: built-in sample runtime events
- `sse`: a real OpenClaw SSE endpoint
- `ws`: a real OpenClaw WebSocket endpoint

Use these environment variables to choose the source:

- `OPENCLAW_TRANSPORT=fixture|sse|ws`
- `OPENCLAW_SSE_URL=http://...`
- `OPENCLAW_WS_URL=ws://...`

If no transport is configured, the local tools default to `fixture`.

### Local live dashboard

Run the first local browser UI slice:

```bash
npm run dev:dashboard
```

That command builds the TypeScript sources into `.build/`, starts a tiny local HTTP server, and serves a browser dashboard that boots through the existing `bootLiveClientApp(...)` path.

Open the printed URL in your browser to see:
- connection status
- runtime/visual event counters
- event timeline/list
- latest-event inspector
- last error state

Run it against a real OpenClaw SSE endpoint:

```bash
OPENCLAW_TRANSPORT=sse OPENCLAW_SSE_URL=http://localhost:4318/runtime npm run dev:dashboard
```

Run it against a real OpenClaw WebSocket endpoint:

```bash
OPENCLAW_TRANSPORT=ws OPENCLAW_WS_URL=ws://localhost:4318/runtime npm run dev:dashboard
```

### Local live inspector

The terminal inspector is still available:

```bash
npm run dev:inspect
```

That flow prints:
- connection status updates
- runtime/visual event counters
- a timeline of newly received runtime events
- a latest-event inspector snapshot

Run it against a real OpenClaw SSE endpoint:

```bash
OPENCLAW_TRANSPORT=sse OPENCLAW_SSE_URL=http://localhost:4318/runtime npm run dev:inspect
```

The inspector keeps the fixture mode auto-finishing for previews, but for real SSE or WebSocket streams it stays attached until the stream disconnects or you stop it with `Ctrl+C`.

## Real local end-to-end flow

The practical Phase 1 local loop is now:

1. Start or expose a real OpenClaw runtime stream over SSE or WebSocket.
2. Point AI_Playground at it with `OPENCLAW_TRANSPORT` plus `OPENCLAW_SSE_URL` or `OPENCLAW_WS_URL`.
3. Run `npm run dev:inspect` to verify normalization, translation, and projection behavior in the terminal.
4. Run `npm run dev:dashboard` to inspect the same live pipeline in the browser.

This keeps the transport boundary OpenClaw-specific while preserving the repo-owned `RuntimeEvent` and `VisualEvent` contracts inside the app.

## More detail

For deeper implementation notes, see:
- `Project.md`
- `docs/architecture.md`
