# AI Playground

## Implementation Status Snapshot (2026-03-31)

### Concise project description

AI_Playground is a real-time observability interface for AI agent runtimes, currently focused on OpenClaw-first integration. The product goal is to turn real agent and runtime activity into a truthful, readable live interface instead of relying only on logs, chat transcripts, or raw tool traces.

The implementation is intentionally contract-first and pipeline-oriented:

1. Runtime ingestion
2. OpenClaw adapter boundary
3. Normalization into repo-owned `RuntimeEvent` contracts
4. Translation into `VisualEvent` contracts
5. Store and projection layer
6. Browser visualization layer

### What is already implemented

- TypeScript repo with contract-first architecture
- repo-owned runtime event contracts and visual event contracts
- OpenClaw adapter boundary
- default OpenClaw event normalizer for loose OpenClaw-style input
- OpenClaw SSE, WebSocket, and in-memory transports that normalize raw envelopes before app ingestion
- transport hardening so invalid raw events surface errors instead of failing silently
- runtime-to-visual translation coverage for session, task, tool, handoff, artifact, warning, and error events
- runtime visual store with raw buffers plus derived projections for `runtimeEvents`, `visualEvents`, `actorsById`, and `sessionsById`
- session-scoped actor projections that preserve sparse identity fields, remove actors on `actor.removed`, and clear active tools on task failure
- lightweight framework-free browser dashboard showing connection state, counts, warnings and errors, session snapshot, active actors, timeline, latest event inspector, and last error
- test coverage for normalization, transports, translator behavior, store projections, and dashboard rendering helpers

### What is left to build

- real end-to-end OpenClaw integration against an upstream runtime or daemon
- production-grade live endpoint and realistic local dev flow
- richer browser controls for filtering, sorting, actor and session selection, and inspection
- replay and history support for previous runs
- stronger state-machine behavior under noisy real streams
- a true scene, spatial, or 3D observability layer
- better multi-agent orchestration UX beyond basic handoff and state representation
- broader provider integrations beyond OpenClaw

### Phase plan guiding development

#### Phase 1: Real OpenClaw event pipeline

- connect to a real OpenClaw source
- wire a real SSE and WebSocket path
- validate and harden ingestion and normalization
- document a reliable local end-to-end run flow

#### Phase 2: Usable browser product

- upgrade the browser UI into a practical observability dashboard
- add session and actor filtering plus selection
- improve inspector and detail workflows
- make derived current-state views central to the UI

#### Phase 3: State quality and replay

- strengthen translator, store, and state-machine behavior
- add replay and history for completed runs
- stabilize event-to-visual behavior under realistic stream conditions
- reduce ambiguity and stale state in projections

#### Phase 4: Product identity layer

- add a spatial or scene-based observability experience
- keep the visualization truthful rather than theatrical
- improve multi-agent coordination UX
- synchronize scene, inspector, and timeline views cleanly

### Highest-leverage next PR-sized feature

Implement a real OpenClaw live endpoint plus a documented local end-to-end developer flow.

This is the best next slice because it exercises the entire current pipeline against real upstream behavior, exposes contract and projection gaps early, and creates the foundation every later browser, replay, and scene improvement depends on.

---

> Status: PR 1 adds the live MVP foundation in `README.md`, `docs/architecture.md`, and `src/` shared contracts. This original concept document remains useful background, but the implementation source of truth is now the typed contracts and architecture docs in the repo.

## Overview

**AI Playground** is a real-time 3D visualization environment for AI agents. Instead of showing agent activity only as text logs or status indicators, the platform represents each bot as a character moving and acting inside a shared 3D space.

When a user assigns a task to an LLM or a team of agents, the playground visually shows what is happening in real time. For example, a research bot may walk to a browser station, a planner bot may stand at a whiteboard, and a coding bot may move to a workstation and begin typing. Each character is labeled with the bot’s name and role, making agent workflows easier to understand, monitor, and demonstrate.

The goal of the project is to make AI systems feel more transparent, interactive, and intuitive by transforming invisible backend processes into a visible simulated world.

---

## Problem Statement

Most AI and agent systems currently expose activity through:
- chat messages
- logs
- tool call traces
- status badges
- terminal output

While useful, these interfaces are often hard to interpret, especially for non-technical users. It can be difficult to understand:
- what the agent is doing
- whether progress is being made
- which bot is responsible for which task
- where the workflow is blocked
- how multiple bots are collaborating

This creates a gap between what the AI is doing and what the user can actually perceive.

---

## Solution

AI Playground solves this by mapping agent activity into a real-time 3D environment.

Each bot is represented as a character in a virtual workspace. Backend events such as task assignment, tool usage, collaboration, waiting, success, or failure are translated into visible motion and animation.

Examples:
- A **Research Bot** walks to a browser desk and searches.
- A **Planner Bot** moves to a whiteboard and creates a plan.
- A **Code Bot** sits at a workstation and types.
- A **Reviewer Bot** moves to a QA desk and inspects work.
- A **File Bot** carries items between zones representing file operations.

This turns abstract AI behavior into a readable, engaging visual system.

---

## Core Concept

The product is not just a chatbot interface. It is a **3D observability layer for AI agents**.

A user should be able to:
1. assign a task to one or more agents
2. watch the bots move and act in the environment
3. inspect what each bot is currently doing
4. understand dependencies and collaboration
5. review outputs and artifacts generated by the agents

The system should make AI workflows:
- visible
- explainable
- debuggable
- demo-friendly
- easier to trust

---

## Goals

### Primary Goals
- Visualize AI agent workflows in real time
- Represent multiple bots clearly inside a shared 3D space
- Make agent behavior easier to understand and debug
- Create an engaging environment for demos and experimentation
- Support both single-agent and multi-agent workflows

### Secondary Goals
- Provide replay functionality for previous runs
- Surface useful metadata such as task status and tool usage
- Allow users to click into bots and inspect their current state
- Make the experience enjoyable and memorable, not just functional

---

## Target Users

### 1. Developers
Developers can use the playground to observe and debug agent workflows, tool usage, and coordination problems.

### 2. Product Teams
Product managers and designers can use the visualization to understand how agent systems behave without reading logs.

### 3. Demo Audiences / Clients
The 3D interface makes agent systems more presentable and easier to communicate during demos.

### 4. Learners and Experimenters
People learning about AI agents can use the platform as a sandbox to see how agent orchestration works.

---

## Example User Experience

A user enters the prompt:

> Build me a landing page for a coffee shop.

The system breaks the work into multiple responsibilities:
- planning
- research
- design
- code generation
- review

Inside the scene:
- **PlannerBot** moves to a whiteboard and outlines steps
- **ResearchBot** walks to a browser station and gathers references
- **DesignerBot** moves to a moodboard area and reviews style options
- **CodeBot** goes to a workstation and begins implementing
- **ReviewerBot** moves to a testing area and checks results

A side panel shows:
- current task
- active bot
- tool usage
- timeline of events
- generated artifacts
- completion state

The user can click a bot to inspect:
- bot name
- role
- current task
- recent actions
- active tool
- progress summary

---

## Key Features

### Real-Time 3D Agent Visualization
Bots are represented as labeled characters in a virtual space and respond to live backend events.

### Bot Roles and Zones
Different work areas in the environment visually correspond to different types of actions:
- whiteboard area for planning
- browser/library area for research
- workstation area for coding
- file/archive area for file operations
- QA desk for review and validation
- meeting table for collaboration

### Live Task State
Each bot displays:
- current status
- assigned task
- role
- active tool or action

### Event Timeline
A timeline or log panel tracks the sequence of agent events and visual transitions.

### Bot Detail Panel
Selecting a bot reveals more information about what it is doing and why.

### Multi-Agent Collaboration
Multiple bots can operate in parallel, pass work to each other, and visibly coordinate.

### Replay Mode
Users can replay a task run to inspect how the workflow unfolded over time.

---

## MVP Scope

The MVP should focus on clarity and delivery speed rather than realism.

### MVP Environment
A single room or workspace containing:
- desks
- a whiteboard
- a browser station
- a file shelf
- a review table

### MVP Bot States
Each bot only needs a small set of clear animation states:
- idle
- walking
- typing
- reading
- talking
- waiting
- success
- error

### MVP User Flow
1. User enters a task
2. Backend assigns the task to one or more bots
3. Bots receive events and move to the correct zones
4. Side panel shows progress and logs
5. Task completes and outputs are displayed

### MVP Interaction
- hover to see bot name
- click bot to open detail panel
- view active tasks and recent events
- watch live transitions between zones and states

---

## Architecture

The project can be thought of as three major layers.

### 1. Agent Runtime Layer
This is where the bots actually do work.

Responsibilities:
- receive tasks
- coordinate agent logic
- call tools
- create outputs
- emit structured activity events

This layer could connect to:
- OpenAI
- Anthropic
- custom LLM backends
- local agents
- orchestration frameworks such as LangGraph or custom pipelines

### 2. Event Translation Layer
This layer converts raw agent activity into visual actions.

For example:
- raw event: `research_bot called web_search`
- visual event: `ResearchBot moves to browser station and plays search animation`

This layer is important because raw logs are too noisy to map directly into animation.

Responsibilities:
- aggregate low-level events
- convert them into human-readable visual actions
- smooth transitions between states
- maintain a clean event schema for the frontend

### 3. 3D Visualization Client
This is the frontend application that renders the world, characters, labels, and UI.

Responsibilities:
- render the scene
- animate bot movement
- subscribe to live events
- show logs and metadata
- handle replay and inspection

---

## Suggested Technical Stack

### Frontend
- **Next.js**
- **React**
- **React Three Fiber**
- **Three.js**
- **Tailwind CSS**
- **Zustand**
- **Framer Motion**

### Backend
- **Node.js**
- **TypeScript**
- **WebSocket** or **Socket.IO** for real-time events
- Optional event queue or pub/sub layer for scaling

### AI / Orchestration
- OpenAI API
- Anthropic API
- custom agent runtime
- LangGraph or equivalent orchestration framework

### Optional Additions
- database for runs and replay data
- Redis for event streaming or temporary state
- Supabase/Postgres for persistence
- S3 or blob storage for artifacts

---

## Event Model

The system should use structured events so the frontend can stay decoupled from raw LLM logs.

Example schema:

```ts
type AgentEvent =
  | { type: 'bot_spawned'; botId: string; name: string; role: string }
  | { type: 'task_started'; botId: string; task: string }
  | { type: 'move_to_zone'; botId: string; zone: 'whiteboard' | 'browser' | 'workstation' | 'files' | 'qa' | 'meeting' }
  | { type: 'animation_state'; botId: string; state: 'idle' | 'walking' | 'typing' | 'reading' | 'talking' | 'waiting' | 'success' | 'error' }
  | { type: 'tool_called'; botId: string; tool: string; label: string }
  | { type: 'message_sent'; fromBotId: string; toBotId: string; summary: string }
  | { type: 'artifact_created'; botId: string; artifactType: string; name: string }
  | { type: 'task_completed'; botId: string; result: string }
  | { type: 'task_failed'; botId: string; error: string }
```

This event model can be extended later with:
- timestamps
- dependencies
- progress percentages
- cost/token metrics
- tool execution durations

---

## Visual Design Direction

A low-poly stylized office or lab is the best starting point.

Reasons:
- easier to build than realistic 3D
- clear and readable
- visually polished without needing expensive assets
- good performance in browser
- supports both playful and professional presentation

Possible themes:
- modern AI lab
- startup office
- control room
- digital workshop

Recommended starting direction:
**low-poly collaborative studio / office**

---

## Important Product Principles

### 1. Visual Abstraction Over Literal Accuracy
Not every internal reasoning step should create a new animation. The platform should compress noisy activity into meaningful visible states.

Example:
- many internal reasoning steps may simply appear as “thinking at desk”
- repeated tool calls may remain part of one “researching” animation block

### 2. Clarity Over Realism
The goal is not to create a game. The goal is to communicate system behavior clearly.

### 3. Smooth State Transitions
Bots should not snap rapidly between states. Actions should be queued and stabilized for readability.

### 4. Role-Based Readability
Different bot types should have clearly recognizable patterns, destinations, and labels.

---

## Main Challenges

### Event Noise
AI systems produce many small internal actions. Direct mapping would create chaos.
- Solution: create an event abstraction layer

### Synchronization
The frontend must remain synchronized with backend task state.
- Solution: use timestamps and authoritative server-side state

### Pathfinding and Movement
Natural bot movement in 3D is not trivial.
- Solution: use fixed waypoints or simple nav paths for MVP

### Performance
Multiple animated characters can become expensive in browser rendering.
- Solution: low-poly assets, reusable rigs, capped active bots, optimized scene design

### UX Complexity
Too much information can make the scene feel overwhelming.
- Solution: keep visuals simple and let details live in side panels

---

## Development Roadmap

## Phase 1: Visual Prototype
Goal: prove the 3D visualization concept

Deliverables:
- one room
- one bot character
- fake event stream
- movement between zones
- basic idle, walking, typing states
- side panel with logs

Success criteria:
- a user can watch one bot perform a fake task sequence in a believable way

## Phase 2: Live Agent Integration
Goal: connect real backend events to the scene

Deliverables:
- live event streaming from backend
- real task assignment
- bot labels and task indicators
- click-to-inspect bot details
- basic output display

Success criteria:
- a real prompt triggers real backend activity that appears correctly in the 3D scene

## Phase 3: Multi-Agent Collaboration
Goal: show teamwork between bots

Deliverables:
- multiple bots in one scene
- visible handoffs
- collaboration animations
- task dependencies
- richer role-based zones

Success criteria:
- users can understand how multiple bots split and coordinate work

## Phase 4: Replay and History
Goal: make past runs inspectable

Deliverables:
- saved run history
- timeline scrubber
- replay mode
- event stepping
- visual debugging tools

Success criteria:
- users can review and explain a previous run after it finishes

---

## Future Ideas

- voice narration of bot actions
- replay export for demos
- team performance stats
- token/cost overlays
- support for different world themes
- customizable avatars
- manual task assignment through drag-and-drop
- collaborative multiplayer mode where users watch together
- browser-based sandbox for testing orchestration strategies
- support for external tool integrations and file previews

---

## Repository Structure Suggestion

```text
ai-playground/
├─ app/
│  ├─ page.tsx
│  ├─ layout.tsx
│  └─ api/
├─ components/
│  ├─ scene/
│  ├─ bots/
│  ├─ ui/
│  └─ panels/
├─ lib/
│  ├─ events/
│  ├─ agents/
│  ├─ orchestration/
│  └─ utils/
├─ server/
│  ├─ websocket/
│  ├─ runtime/
│  └─ translators/
├─ public/
│  ├─ models/
│  ├─ textures/
│  └─ icons/
├─ types/
├─ docs/
└─ Project.md
```

---

## Why This Project Matters

AI Playground combines several strong ideas into one product:
- AI agents
- real-time systems
- 3D interaction
- observability
- developer tooling
- visual storytelling

It is both practically useful and visually distinctive. As a portfolio project, it shows strength in:
- product thinking
- system design
- frontend engineering
- backend event architecture
- user experience design

This project can stand out because it does not just build another AI interface. It rethinks how AI workflows can be seen and understood.

---

## One-Sentence Pitch

**AI Playground is a real-time 3D observability platform for AI agents, where bots appear as characters in a virtual workspace and visibly perform tasks, use tools, and collaborate as work happens.**

---

## Resume-Friendly Description

Built a real-time 3D visualization platform for AI agent workflows, mapping LLM tasks, tool calls, and collaboration events into animated characters within a virtual workspace using React, React Three Fiber, TypeScript, and WebSockets.

---

## Conclusion

AI Playground is a strong and unique project idea with real product value. It makes AI agents more understandable, more interactive, and more human-readable by giving them a visible shared world. By starting with a simple visual prototype and gradually connecting real agent backends, the project can grow into both a compelling technical demo and a genuinely useful tool for observing AI systems.
