import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { ActorActivityState, SceneZone, VisualEvent } from '../contracts/visual-events.js';
import type { RuntimeToVisualTranslator } from '../translators/runtime-to-visual.js';

export interface RuntimeVisualActorProjection {
  id: string;
  name: string;
  role?: string;
  kind?: string;
  sessionId: string;
  currentTaskId?: string;
  currentTaskTitle?: string;
  currentToolName?: string;
  currentZone?: SceneZone;
  currentActivity?: ActorActivityState;
  lastRuntimeEventId: string;
  lastVisualEventId?: string;
  lastSummary?: string;
  lastError?: string;
  lastArtifactId?: string;
  lastArtifactName?: string;
  updatedAt: string;
}

export interface RuntimeVisualSessionProjection {
  id: string;
  status?: 'started' | 'running' | 'completed' | 'failed';
  title?: string;
  goal?: string;
  actorIds: string[];
  latestSummary?: string;
  lastRuntimeEventId?: string;
  lastVisualEventId?: string;
  updatedAt?: string;
}

export interface RuntimeVisualState {
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  runtimeEvents: RuntimeEvent[];
  visualEvents: VisualEvent[];
  actorsById: Record<string, RuntimeVisualActorProjection>;
  sessionsById: Record<string, RuntimeVisualSessionProjection>;
  lastError?: string;
}

export interface RuntimeVisualStoreOptions {
  translator: RuntimeToVisualTranslator;
  maxRuntimeEvents?: number;
  maxVisualEvents?: number;
}

export type RuntimeVisualSubscriber = (state: Readonly<RuntimeVisualState>) => void;

const DEFAULT_MAX_RUNTIME_EVENTS = 200;
const DEFAULT_MAX_VISUAL_EVENTS = 200;

export class RuntimeVisualStore {
  private state: RuntimeVisualState = {
    connectionStatus: 'idle',
    runtimeEvents: [],
    visualEvents: [],
    actorsById: {},
    sessionsById: {},
  };

  private subscribers = new Set<RuntimeVisualSubscriber>();

  private readonly maxRuntimeEvents: number;
  private readonly maxVisualEvents: number;

  constructor(private readonly options: RuntimeVisualStoreOptions) {
    this.maxRuntimeEvents = options.maxRuntimeEvents ?? DEFAULT_MAX_RUNTIME_EVENTS;
    this.maxVisualEvents = options.maxVisualEvents ?? DEFAULT_MAX_VISUAL_EVENTS;
  }

  getSnapshot(): Readonly<RuntimeVisualState> {
    return createSnapshot(this.state);
  }

  subscribe(subscriber: RuntimeVisualSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(createSnapshot(this.state));
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  setConnectionStatus(status: RuntimeVisualState['connectionStatus']): void {
    this.update({
      ...this.state,
      connectionStatus: status,
      lastError: status === 'error' ? this.state.lastError : undefined,
    });
  }

  recordError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.update({
      ...this.state,
      connectionStatus: 'error',
      lastError: message,
    });
  }

  ingestRuntimeEvent(event: RuntimeEvent): void {
    const nextRuntimeEvents = trimTail([...this.state.runtimeEvents, event], this.maxRuntimeEvents);
    const translatedVisualEvents = this.options.translator.translate(event);
    const nextVisualEvents = trimTail([...this.state.visualEvents, ...translatedVisualEvents], this.maxVisualEvents);
    const nextActorsById = deriveActorsById(this.state.actorsById, event, translatedVisualEvents);
    const nextSessionsById = deriveSessionsById(this.state.sessionsById, event, translatedVisualEvents);

    this.update({
      ...this.state,
      runtimeEvents: nextRuntimeEvents,
      visualEvents: nextVisualEvents,
      actorsById: nextActorsById,
      sessionsById: nextSessionsById,
    });
  }

  private update(state: RuntimeVisualState): void {
    this.state = state;
    const errors: unknown[] = [];

    for (const subscriber of this.subscribers) {
      try {
        subscriber(createSnapshot(this.state));
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more runtime visual store subscribers failed');
    }
  }
}

function createSnapshot(state: RuntimeVisualState): Readonly<RuntimeVisualState> {
  return structuredClone(state);
}

function trimTail<T>(values: T[], max: number): T[] {
  if (values.length <= max) return values;
  return values.slice(values.length - max);
}

function deriveActorsById(
  currentActorsById: Record<string, RuntimeVisualActorProjection>,
  runtimeEvent: RuntimeEvent,
  visualEvents: VisualEvent[],
): Record<string, RuntimeVisualActorProjection> {
  const actor = runtimeEvent.actor;
  if (!actor?.id) return currentActorsById;

  const current = currentActorsById[actor.id];
  const next: RuntimeVisualActorProjection = {
    id: actor.id,
    name: actor.name,
    role: actor.role,
    kind: actor.kind,
    sessionId: runtimeEvent.sessionId,
    currentTaskId: current?.currentTaskId,
    currentTaskTitle: current?.currentTaskTitle,
    currentToolName: current?.currentToolName,
    currentZone: current?.currentZone,
    currentActivity: current?.currentActivity,
    lastRuntimeEventId: runtimeEvent.id,
    lastVisualEventId: visualEvents.at(-1)?.id ?? current?.lastVisualEventId,
    lastSummary: current?.lastSummary,
    lastError: current?.lastError,
    lastArtifactId: current?.lastArtifactId,
    lastArtifactName: current?.lastArtifactName,
    updatedAt: runtimeEvent.timestamp,
  };

  applyRuntimeActorProjection(next, runtimeEvent);

  for (const visualEvent of visualEvents) {
    applyVisualActorProjection(next, visualEvent);
  }

  return {
    ...currentActorsById,
    [actor.id]: next,
  };
}

function deriveSessionsById(
  currentSessionsById: Record<string, RuntimeVisualSessionProjection>,
  runtimeEvent: RuntimeEvent,
  visualEvents: VisualEvent[],
): Record<string, RuntimeVisualSessionProjection> {
  const current = currentSessionsById[runtimeEvent.sessionId];
  const actorIds = new Set(current?.actorIds ?? []);
  if (runtimeEvent.actor?.id) actorIds.add(runtimeEvent.actor.id);

  const next: RuntimeVisualSessionProjection = {
    id: runtimeEvent.sessionId,
    status: current?.status,
    title: current?.title,
    goal: current?.goal,
    actorIds: [...actorIds],
    latestSummary: current?.latestSummary,
    lastRuntimeEventId: runtimeEvent.id,
    lastVisualEventId: visualEvents.at(-1)?.id ?? current?.lastVisualEventId,
    updatedAt: runtimeEvent.timestamp,
  };

  applyRuntimeSessionProjection(next, runtimeEvent);

  for (const visualEvent of visualEvents) {
    if (visualEvent.type === 'session.summary.updated') {
      next.latestSummary = visualEvent.summary;
      next.lastVisualEventId = visualEvent.id;
    }
  }

  return {
    ...currentSessionsById,
    [runtimeEvent.sessionId]: next,
  };
}

function applyRuntimeActorProjection(actor: RuntimeVisualActorProjection, event: RuntimeEvent): void {
  switch (event.kind) {
    case 'task.started':
    case 'task.progressed': {
      const payload = event.payload as { taskId: string; title: string; summary?: string };
      actor.currentTaskId = payload.taskId;
      actor.currentTaskTitle = payload.title;
      actor.lastSummary = payload.summary ?? actor.lastSummary;
      return;
    }

    case 'task.completed': {
      const payload = event.payload as { summary?: string };
      actor.currentTaskId = undefined;
      actor.currentTaskTitle = undefined;
      actor.currentToolName = undefined;
      actor.lastSummary = payload.summary ?? actor.lastSummary;
      return;
    }

    case 'task.failed': {
      const payload = event.payload as { summary?: string };
      actor.currentTaskId = undefined;
      actor.currentTaskTitle = undefined;
      actor.lastSummary = payload.summary ?? actor.lastSummary;
      actor.lastError = payload.summary ?? actor.lastError;
      return;
    }

    case 'tool.started':
    case 'tool.progressed': {
      const payload = event.payload as { tool: { name: string }; inputSummary?: string };
      actor.currentToolName = payload.tool.name;
      actor.lastSummary = payload.inputSummary ?? actor.lastSummary;
      return;
    }

    case 'tool.completed': {
      const payload = event.payload as { outputSummary?: string };
      actor.currentToolName = undefined;
      actor.lastSummary = payload.outputSummary ?? actor.lastSummary;
      return;
    }

    case 'tool.failed': {
      const payload = event.payload as { tool: { name: string }; outputSummary?: string };
      actor.currentToolName = undefined;
      actor.lastError = payload.outputSummary ?? `${payload.tool.name} failed`;
      return;
    }

    case 'artifact.created':
    case 'artifact.updated': {
      const payload = event.payload as { artifact: { id: string; name?: string; type: string }; summary?: string };
      actor.lastArtifactId = payload.artifact.id;
      actor.lastArtifactName = payload.artifact.name ?? payload.artifact.type;
      actor.lastSummary = payload.summary ?? actor.lastSummary;
      return;
    }

    case 'warning':
    case 'error': {
      const payload = event.payload as { message: string };
      actor.lastError = payload.message;
      return;
    }
  }
}

function applyVisualActorProjection(actor: RuntimeVisualActorProjection, visualEvent: VisualEvent): void {
  actor.lastVisualEventId = visualEvent.id;
  actor.lastSummary = visualEvent.summary;

  if (visualEvent.scene?.target?.zone) {
    actor.currentZone = visualEvent.scene.target.zone;
  }

  if (visualEvent.scene?.activity) {
    actor.currentActivity = visualEvent.scene.activity;
  }

  if (visualEvent.type === 'actor.error') {
    actor.lastError = visualEvent.summary;
  }
}

function applyRuntimeSessionProjection(session: RuntimeVisualSessionProjection, event: RuntimeEvent): void {
  switch (event.kind) {
    case 'session.started':
    case 'session.updated':
    case 'session.completed':
    case 'session.failed': {
      const payload = event.payload as { status: RuntimeVisualSessionProjection['status']; title?: string; goal?: string };
      session.status = payload.status;
      session.title = payload.title ?? session.title;
      session.goal = payload.goal ?? session.goal;
      session.latestSummary = payload.title ?? session.latestSummary;
      return;
    }

    case 'warning':
    case 'error': {
      const payload = event.payload as { message: string };
      session.latestSummary = payload.message;
      return;
    }
  }
}
