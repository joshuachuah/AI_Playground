# AI_Playground Architecture

## Live MVP goal

Build a truthful, live MVP that visualizes **real OpenClaw runtime activity** in a 3D interface.

The initial target is **not** a synthetic demo loop. The MVP should reflect actual runtime state, session activity, tool usage, and agent handoffs. When the upstream runtime includes OpenAI-specific metadata, the system should preserve and expose it as enrichment rather than making it a hard dependency.

## Product stance

- **OpenClaw-first**: the first integration target is the OpenClaw runtime
- **live before pretty**: reliable event streaming matters more than polished scene fidelity
- **truthful abstraction**: the visualization may compress or smooth events, but it should never invent fake underlying agent behavior
- **metadata-aware**: OpenAI metadata is optional enrichment, not the source of truth

## System architecture

```text
OpenClaw runtime / adapters
        |
        v
raw runtime event stream
        |
        v
runtime normalization layer
        |
        v
runtime-to-visual translator
        |
        +--> visual event stream --> 3D scene / timeline / inspector UI
        |
        +--> session state store --> summaries / bot status / replay basis
```

### Layer responsibilities

#### 1. Runtime event source
Emits raw events from OpenClaw, plus optional metadata from OpenAI-backed model/tool usage.

#### 2. Normalization layer
Ensures incoming events are shaped into a stable repository-owned schema even if upstream formats change.

#### 3. Translation layer
Converts runtime events into fewer, more readable visual events suitable for animation, timelines, and inspection.

#### 4. Client state + scene
Consumes visual events to render:
- bot presence
- zone transitions
- activity state
- collaboration/handoff indicators
- timeline and detail panels

## Raw runtime event schema

The raw runtime schema should remain close to the truth of what happened. It should preserve identifiers, timestamps, actor references, tool calls, artifacts, and model metadata.

Core properties:
- `id`: unique event id
- `timestamp`: event occurrence time in ISO-8601 UTC
- `sessionId`: runtime session/run identifier
- `source`: emitting subsystem, such as `openclaw.runtime` or `openai.responses`
- `kind`: normalized event kind
- `actor`: agent/bot metadata if applicable
- `payload`: event-specific data
- `openai`: optional metadata enrichment

Supported initial event categories:
- session lifecycle
- actor lifecycle
- task lifecycle
- tool lifecycle
- message/handoff
- artifact lifecycle
- model response metadata
- error/warning

Important rule: raw runtime events may be verbose, but they should not be “visualized” directly.

## Visual event schema

Visual events are scene-oriented and intentionally more compact than runtime events.

Core properties:
- `id`
- `timestamp`
- `sessionId`
- `actorId`
- `type`
- `summary`
- `scene`
- `ui`
- `sourceRuntimeEventIds`

Supported initial visual categories:
- actor spawned/despawned
- actor moved to zone
- actor activity state changed
- actor began/ended tool interaction
- actor sent/received handoff
- actor created artifact
- session summary update
- actor error state

Visual events are allowed to compress multiple runtime events into one readable action if:
- the mapping remains truthful
- the source runtime event ids are retained
- the compression improves readability

## Translation strategy

The translator is the core product differentiator.

### Translation principles

1. **truth over spectacle**
   - no fake work loops
   - no invented progress states without runtime support

2. **compress noise**
   - repeated low-level runtime events can map to one visible action block
   - internal reasoning traces should generally not animate as separate actions

3. **preserve traceability**
   - every visual event should reference source runtime event ids
   - inspectors can always link back to runtime truth

4. **stabilize UX**
   - avoid flickering state changes for transient runtime activity
   - hold short-lived events long enough to be legible

5. **stay deterministic**
   - the same runtime event sequence should produce the same visual sequence

### Initial translation examples

| Runtime event(s) | Visual result |
| --- | --- |
| `task.started` by planner actor | actor focus state set to planning zone + planning activity |
| `tool.started` for `web_search` | actor moved or pinned to research zone + searching state |
| repeated token/model deltas | no scene movement; optional inspector/timeline metadata only |
| `artifact.created` | artifact pulse/marker in UI + artifact created event |
| `task.completed` | success state + session summary update |
| `task.failed` | error state + error summary |

## Minimal implementation roadmap

### PR 1 - Foundation
- define architecture and contracts
- establish translator boundary
- avoid heavy frontend boilerplate

### PR 2 - Runtime ingestion
- implement a local event source adapter for OpenClaw
- normalize runtime events into repo contracts
- add fixture-based tests for known event shapes

### PR 3 - Stateful translation
- add actor/session state machines
- map runtime events to visual events deterministically
- provide sample event streams for development

### PR 4 - Web client shell
- scaffold the browser app
- add timeline panel and event inspector
- connect a local event stream to the client

### PR 5 - 3D scene MVP
- add scene zones and actor placeholders
- animate move/state transitions from visual events
- keep assets intentionally simple

### PR 6 - OpenAI metadata enrichment
- surface model, token, request, and response metadata where present
- expose metadata in inspector/timeline without coupling scene behavior to provider-specific fields

## Risks and caveats

- upstream OpenClaw runtime event formats may evolve and require adapter work
- raw event volume may be high enough to require buffering/coalescing
- visual clarity can degrade quickly if translation rules are too literal
- provider-specific metadata is useful but should not contaminate core contracts

## Non-goals for PR 1

- no fake click-through demo
- no production scene rendering yet
- no full framework bootstrap unless needed by later work
- no persistence/replay implementation yet
