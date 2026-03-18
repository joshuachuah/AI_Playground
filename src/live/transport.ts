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
  return JSON.parse(payload) as RuntimeEventEnvelope;
}
