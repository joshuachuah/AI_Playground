import type { RuntimeEvent } from '../contracts/runtime-events.js';
import {
  parseRuntimeEventEnvelope,
  type RuntimeEventStreamListener,
  type RuntimeEventTransport,
} from './transport.js';

export interface EventSourceLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((error: unknown) => void) | null;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

export interface SseRuntimeTransportConfig {
  url: string;
  createEventSource: EventSourceFactory;
}

export class SseRuntimeTransport implements RuntimeEventTransport {
  private source: EventSourceLike | null = null;
  private listener: RuntimeEventStreamListener | null = null;

  constructor(private readonly config: SseRuntimeTransportConfig) {}

  async connect(listener: RuntimeEventStreamListener): Promise<void> {
    if (this.source) {
      if (this.listener === listener) return;
      await this.disconnect();
    }

    this.listener = listener;
    listener.onStatusChange?.('connecting');

    const source = this.config.createEventSource(this.config.url);
    this.source = source;

    source.onopen = () => {
      listener.onStatusChange?.('connected');
    };

    source.onmessage = (event) => {
      try {
        const envelope = parseRuntimeEventEnvelope(event.data);
        listener.onRuntimeEvent(envelope.event);
      } catch (error) {
        listener.onError?.(error);
      }
    };

    source.onerror = (error) => {
      listener.onStatusChange?.('error');
      listener.onError?.(error);
    };
  }

  async disconnect(): Promise<void> {
    if (!this.source) {
      this.listener = null;
      return;
    }

    this.closeSource();
    this.listener?.onStatusChange?.('disconnected');
    this.listener = null;
  }

  private closeSource(): void {
    if (!this.source) return;
    this.source.close();
    this.source.onopen = null;
    this.source.onmessage = null;
    this.source.onerror = null;
    this.source = null;
  }
}

export function createInMemoryRuntimeTransport(events: RuntimeEvent[]): RuntimeEventTransport {
  return new InMemoryRuntimeTransport(events);
}

class InMemoryRuntimeTransport implements RuntimeEventTransport {
  private connected = false;
  private listener: RuntimeEventStreamListener | null = null;

  constructor(private readonly events: RuntimeEvent[]) {}

  async connect(listener: RuntimeEventStreamListener): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.listener = listener;

    listener.onStatusChange?.('connecting');
    listener.onStatusChange?.('connected');

    for (const event of this.events) {
      listener.onRuntimeEvent(event);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      this.listener = null;
      return;
    }

    this.connected = false;
    this.listener?.onStatusChange?.('disconnected');
    this.listener = null;
  }
}
