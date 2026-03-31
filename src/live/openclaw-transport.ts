import type {
  NormalizeOpenClawEventContext,
  OpenClawAdapter,
  OpenClawRawEventEnvelope,
} from '../adapters/openclaw.js';
import type { EventSourceFactory, EventSourceLike } from './sse-transport.js';
import type {
  RuntimeEventStreamListener,
  RuntimeEventTransport,
} from './transport.js';
import type {
  WebSocketCloseEventLike,
  WebSocketFactory,
  WebSocketLike,
  WebSocketMessageEventLike,
} from './websocket-transport.js';

export interface OpenClawEventEnvelope {
  event: OpenClawRawEventEnvelope;
}

export interface OpenClawSseRuntimeTransportConfig {
  url: string;
  adapter: OpenClawAdapter;
  createEventSource: EventSourceFactory;
  defaultNormalizeContext?: NormalizeOpenClawEventContext;
}

export interface OpenClawWebSocketRuntimeTransportConfig {
  url: string;
  adapter: OpenClawAdapter;
  createWebSocket: WebSocketFactory;
  defaultNormalizeContext?: NormalizeOpenClawEventContext;
}

export function parseOpenClawEventEnvelope(payload: string): OpenClawEventEnvelope {
  const parsed: unknown = JSON.parse(payload);

  if (!isOpenClawEventEnvelope(parsed)) {
    throw new Error('Invalid OpenClaw event envelope payload');
  }

  return parsed;
}

export class OpenClawSseRuntimeTransport implements RuntimeEventTransport {
  private source: EventSourceLike | null = null;
  private listener: RuntimeEventStreamListener | null = null;
  private hasErrored = false;

  constructor(private readonly config: OpenClawSseRuntimeTransportConfig) {}

  async connect(listener: RuntimeEventStreamListener): Promise<void> {
    if (this.source) {
      if (this.listener === listener) return;
      await this.disconnect();
    }

    this.listener = listener;
    this.hasErrored = false;
    listener.onStatusChange?.('connecting');

    const source = this.config.createEventSource(this.config.url);
    this.source = source;

    source.onopen = () => {
      if (this.source !== source || this.listener !== listener) return;
      listener.onStatusChange?.('connected');
    };

    source.onmessage = (event) => {
      if (this.source !== source || this.listener !== listener) return;

      try {
        const envelope = parseOpenClawEventEnvelope(event.data);
        emitNormalizedOpenClawEvents(
          envelope.event,
          this.config.adapter,
          listener,
          this.config.defaultNormalizeContext,
        );
      } catch (error) {
        this.hasErrored = true;
        listener.onStatusChange?.('error');
        listener.onError?.(error);
      }
    };

    source.onerror = (error) => {
      if (this.source !== source || this.listener !== listener) return;
      this.hasErrored = true;
      listener.onStatusChange?.('error');
      listener.onError?.(error);
    };
  }

  async disconnect(): Promise<void> {
    if (!this.source) {
      this.listener = null;
      this.hasErrored = false;
      return;
    }

    this.closeSource();
    if (!this.hasErrored) {
      this.listener?.onStatusChange?.('disconnected');
    }
    this.listener = null;
    this.hasErrored = false;
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

export class OpenClawWebSocketRuntimeTransport implements RuntimeEventTransport {
  private socket: WebSocketLike | null = null;
  private listener: RuntimeEventStreamListener | null = null;
  private isDisconnecting = false;
  private hasErrored = false;
  private pendingDisconnect: Promise<void> | null = null;
  private resolvePendingDisconnect: (() => void) | null = null;

  constructor(private readonly config: OpenClawWebSocketRuntimeTransportConfig) {}

  async connect(listener: RuntimeEventStreamListener): Promise<void> {
    if (this.socket) {
      if (this.listener === listener) return;
      await this.disconnect();
    }

    this.listener = listener;
    this.isDisconnecting = false;
    this.hasErrored = false;

    const socket = this.config.createWebSocket(this.config.url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket || this.listener !== listener) return;
      listener.onStatusChange?.('connected');
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket || this.listener !== listener) return;

      try {
        const envelope = parseOpenClawEventEnvelope(event.data);
        emitNormalizedOpenClawEvents(
          envelope.event,
          this.config.adapter,
          listener,
          this.config.defaultNormalizeContext,
        );
      } catch (error) {
        this.hasErrored = true;
        listener.onStatusChange?.('error');
        listener.onError?.(error);
      }
    };

    socket.onerror = (error) => {
      if (this.socket !== socket || this.listener !== listener) return;
      this.hasErrored = true;
      listener.onStatusChange?.('error');
      listener.onError?.(error);
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return;

      const activeListener = this.listener === listener ? listener : null;
      const wasDisconnecting = this.isDisconnecting;
      const hadErrored = this.hasErrored;
      const errorMessage = `WebSocket closed unexpectedly${event.reason ? `: ${event.reason}` : ''}`;

      this.clearSocket(socket);
      this.isDisconnecting = false;
      this.hasErrored = false;

      if (activeListener) {
        this.listener = null;
      }

      this.finishPendingDisconnect();

      if (!activeListener) return;

      if (wasDisconnecting) {
        activeListener.onStatusChange?.('disconnected');
        return;
      }

      if (event.wasClean === false) {
        if (!hadErrored) {
          activeListener.onStatusChange?.('error');
        }
        activeListener.onError?.(new Error(errorMessage));
        return;
      }

      if (!hadErrored) {
        activeListener.onStatusChange?.('disconnected');
      }
    };

    listener.onStatusChange?.('connecting');
  }

  async disconnect(): Promise<void> {
    if (!this.socket) {
      this.listener = null;
      this.isDisconnecting = false;
      this.hasErrored = false;
      this.finishPendingDisconnect();
      return;
    }

    if (this.pendingDisconnect) {
      return this.pendingDisconnect;
    }

    this.isDisconnecting = true;
    this.pendingDisconnect = new Promise<void>((resolve) => {
      this.resolvePendingDisconnect = resolve;
    });

    this.socket.close();
    return this.pendingDisconnect;
  }

  private finishPendingDisconnect(): void {
    const resolve = this.resolvePendingDisconnect;
    this.resolvePendingDisconnect = null;
    this.pendingDisconnect = null;
    resolve?.();
  }

  private clearSocket(socket: WebSocketLike): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (this.socket === socket) {
      this.socket = null;
    }
  }
}

export function createInMemoryOpenClawRuntimeTransport(
  events: OpenClawRawEventEnvelope[],
  adapter: OpenClawAdapter,
  defaultNormalizeContext?: NormalizeOpenClawEventContext,
): RuntimeEventTransport {
  return new InMemoryOpenClawRuntimeTransport(events, adapter, defaultNormalizeContext);
}

class InMemoryOpenClawRuntimeTransport implements RuntimeEventTransport {
  private connected = false;
  private listener: RuntimeEventStreamListener | null = null;

  constructor(
    private readonly events: OpenClawRawEventEnvelope[],
    private readonly adapter: OpenClawAdapter,
    private readonly defaultNormalizeContext?: NormalizeOpenClawEventContext,
  ) {}

  async connect(listener: RuntimeEventStreamListener): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.listener = listener;

    listener.onStatusChange?.('connecting');
    listener.onStatusChange?.('connected');

    try {
      for (const event of this.events) {
        emitNormalizedOpenClawEvents(event, this.adapter, listener, this.defaultNormalizeContext);
      }
    } catch (error) {
      this.connected = false;
      listener.onStatusChange?.('error');
      listener.onError?.(error);
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

function emitNormalizedOpenClawEvents(
  event: OpenClawRawEventEnvelope,
  adapter: OpenClawAdapter,
  listener: RuntimeEventStreamListener,
  defaultNormalizeContext?: NormalizeOpenClawEventContext,
): void {
  const normalized = adapter.normalizeEvent(event, {
    ...defaultNormalizeContext,
    receivedAt: defaultNormalizeContext?.receivedAt ?? new Date().toISOString(),
  });

  if (!normalized) {
    throw new Error('Unsupported or invalid OpenClaw runtime event');
  }

  const events = Array.isArray(normalized) ? normalized : [normalized];
  for (const runtimeEvent of events) {
    listener.onRuntimeEvent(runtimeEvent);
  }
}

function isOpenClawEventEnvelope(value: unknown): value is OpenClawEventEnvelope {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as { event?: unknown };
  return !!candidate.event && typeof candidate.event === 'object' && !Array.isArray(candidate.event);
}
