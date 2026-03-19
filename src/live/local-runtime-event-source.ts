import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { RuntimeEventEnvelope, RuntimeEventStreamListener, RuntimeEventTransport } from './transport.js';

export interface LocalRuntimeEventSource {
  stream(signal: AbortSignal): AsyncIterable<RuntimeEventEnvelope>;
}

export interface LocalRuntimeEventSourceTransportConfig {
  source: LocalRuntimeEventSource;
}

export class LocalRuntimeEventSourceTransport implements RuntimeEventTransport {
  private listener: RuntimeEventStreamListener | null = null;
  private controller: AbortController | null = null;
  private activePump: Promise<void> | null = null;

  constructor(private readonly config: LocalRuntimeEventSourceTransportConfig) {}

  async connect(listener: RuntimeEventStreamListener): Promise<void> {
    if (this.activePump) {
      if (this.listener === listener) return;
      await this.disconnect();
    }

    const controller = new AbortController();
    this.listener = listener;
    this.controller = controller;

    listener.onStatusChange?.('connecting');
    listener.onStatusChange?.('connected');

    this.activePump = this.pump(listener, controller.signal);
  }

  async disconnect(): Promise<void> {
    const activePump = this.activePump;
    const controller = this.controller;
    const listener = this.listener;

    this.controller = null;
    this.activePump = null;
    this.listener = null;
    controller?.abort();

    try {
      await activePump;
    } finally {
      // Keep the final state explicit for app consumers.
      listener?.onStatusChange?.('disconnected');
    }
  }

  private async pump(listener: RuntimeEventStreamListener, signal: AbortSignal): Promise<void> {
    try {
      for await (const envelope of this.config.source.stream(signal)) {
        if (signal.aborted || this.listener !== listener) return;
        listener.onRuntimeEvent(envelope.event);
      }

      if (!signal.aborted && this.listener === listener) {
        listener.onStatusChange?.('disconnected');
        this.listener = null;
        this.controller = null;
        this.activePump = null;
      }
    } catch (error) {
      if (signal.aborted) return;
      if (this.listener !== listener) return;
      listener.onStatusChange?.('error');
      listener.onError?.(error);
      this.listener = null;
      this.controller = null;
      this.activePump = null;
    }
  }
}

export interface IntervalRuntimeEventSourceOptions {
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 350;

export function createIntervalRuntimeEventSource(
  events: RuntimeEvent[],
  options: IntervalRuntimeEventSourceOptions = {},
): LocalRuntimeEventSource {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  return {
    async *stream(signal: AbortSignal): AsyncIterable<RuntimeEventEnvelope> {
      for (const event of events) {
        await delay(intervalMs, signal);
        if (signal.aborted) return;
        yield { event };
      }
    },
  };
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}
