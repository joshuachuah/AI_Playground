import {
  parseRuntimeEventEnvelope,
  type RuntimeEventStreamListener,
  type RuntimeEventTransport,
} from './transport.js';

export interface WebSocketMessageEventLike {
  data: string;
}

export interface WebSocketCloseEventLike {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export interface WebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: WebSocketMessageEventLike) => void) | null;
  onerror: ((error: unknown) => void) | null;
  onclose: ((event: WebSocketCloseEventLike) => void) | null;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface WebSocketRuntimeTransportConfig {
  url: string;
  createWebSocket: WebSocketFactory;
}

export class WebSocketRuntimeTransport implements RuntimeEventTransport {
  private socket: WebSocketLike | null = null;
  private listener: RuntimeEventStreamListener | null = null;
  private isDisconnecting = false;
  private hasErrored = false;
  private pendingDisconnect: Promise<void> | null = null;
  private resolvePendingDisconnect: (() => void) | null = null;

  constructor(private readonly config: WebSocketRuntimeTransportConfig) {}

  async connect(listener: RuntimeEventStreamListener): Promise<void> {
    if (this.socket) {
      if (this.listener === listener) return;
      await this.disconnect();
    }

    this.listener = listener;
    this.isDisconnecting = false;
    this.hasErrored = false;
    listener.onStatusChange?.('connecting');

    const socket = this.config.createWebSocket(this.config.url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket || this.listener !== listener) return;
      listener.onStatusChange?.('connected');
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket || this.listener !== listener) return;

      try {
        const envelope = parseRuntimeEventEnvelope(event.data);
        listener.onRuntimeEvent(envelope.event);
      } catch (error) {
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

      this.clearSocket(socket);

      if (this.isDisconnecting) {
        this.isDisconnecting = false;
        if (this.listener === listener) {
          listener.onStatusChange?.('disconnected');
          this.listener = null;
        }
        this.hasErrored = false;
        this.finishPendingDisconnect();
        return;
      }

      if (this.listener === listener) {
        if (this.hasErrored) {
          if (event.wasClean === false) {
            listener.onError?.(
              new Error(`WebSocket closed unexpectedly${event.reason ? `: ${event.reason}` : ''}`),
            );
          }
        } else if (event.wasClean === false) {
          listener.onStatusChange?.('error');
          listener.onError?.(
            new Error(`WebSocket closed unexpectedly${event.reason ? `: ${event.reason}` : ''}`),
          );
        } else {
          listener.onStatusChange?.('disconnected');
        }

        this.listener = null;
      }

      this.hasErrored = false;
      this.finishPendingDisconnect();
    };
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
