import type { RuntimeEvent } from '../contracts/runtime-events.js';

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

function isRuntimeEventEnvelope(value: unknown): value is RuntimeEventEnvelope {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as { event?: unknown };
  if (!candidate.event || typeof candidate.event !== 'object') return false;

  const event = candidate.event as { kind?: unknown; sessionId?: unknown; payload?: unknown; id?: unknown; timestamp?: unknown };
  return (
    typeof event.id === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.sessionId === 'string' &&
    typeof event.kind === 'string' &&
    typeof event.payload === 'object' &&
    event.payload !== null
  );
}
