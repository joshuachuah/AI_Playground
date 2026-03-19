import type { RuntimeEvent, RuntimeEventKind } from '../contracts/runtime-events.js';

export type TransportConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RuntimeEventStreamListener {
  onRuntimeEvent(event: RuntimeEvent): void;
  onStatusChange?(status: TransportConnectionStatus): void;
  onError?(error: unknown): void;
}

export interface RuntimeEventTransport {
  connect(listener: RuntimeEventStreamListener): Promise<void>;
  disconnect(): Promise<void>;
}

export interface RuntimeEventEnvelope {
  event: RuntimeEvent;
}

export function parseRuntimeEventEnvelope(payload: string): RuntimeEventEnvelope {
  const parsed: unknown = JSON.parse(payload);

  if (!isRuntimeEventEnvelope(parsed)) {
    throw new Error('Invalid runtime event envelope payload');
  }

  return parsed;
}

const RUNTIME_EVENT_KINDS = new Set<RuntimeEventKind>([
  'session.started',
  'session.updated',
  'session.completed',
  'session.failed',
  'actor.spawned',
  'actor.updated',
  'actor.removed',
  'task.started',
  'task.progressed',
  'task.completed',
  'task.failed',
  'tool.started',
  'tool.progressed',
  'tool.completed',
  'tool.failed',
  'message.sent',
  'message.received',
  'artifact.created',
  'artifact.updated',
  'model.response.created',
  'model.response.delta',
  'model.response.completed',
  'warning',
  'error',
]);

function isRuntimeEventEnvelope(value: unknown): value is RuntimeEventEnvelope {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as { event?: unknown };
  if (!candidate.event || typeof candidate.event !== 'object') return false;

  const event = candidate.event as {
    kind?: unknown;
    sessionId?: unknown;
    payload?: unknown;
    id?: unknown;
    timestamp?: unknown;
    source?: unknown;
  };

  return (
    typeof event.id === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.sessionId === 'string' &&
    isRuntimeEventKind(event.kind) &&
    typeof event.source === 'string' &&
    typeof event.payload === 'object' &&
    event.payload !== null
  );
}

function isRuntimeEventKind(value: unknown): value is RuntimeEventKind {
  return typeof value === 'string' && RUNTIME_EVENT_KINDS.has(value as RuntimeEventKind);
}
