import { createDefaultOpenClawAdapter } from '../adapters/openclaw.js';
import { sampleRuntimeEvents } from './sample-runtime-events.js';
import type { OpenClawDevConnectionConfig } from './openclaw-dev-config.js';
import { createIntervalRuntimeEventSource, LocalRuntimeEventSourceTransport } from '../live/local-runtime-event-source.js';
import {
  OpenClawSseRuntimeTransport,
  OpenClawWebSocketRuntimeTransport,
  type OpenClawSseRuntimeTransportConfig,
  type OpenClawWebSocketRuntimeTransportConfig,
} from '../live/openclaw-transport.js';
import { createOpenClawFetchSseRuntimeEventSource } from '../live/openclaw-fetch-sse.js';
import type { RuntimeEventTransport } from '../live/transport.js';
import type { EventSourceLike } from '../live/sse-transport.js';
import type { WebSocketLike } from '../live/websocket-transport.js';

export function createBrowserOpenClawDevTransport(config: OpenClawDevConnectionConfig): RuntimeEventTransport {
  switch (config.mode) {
    case 'fixture':
      return createFixtureTransport();
    case 'sse':
      return new OpenClawSseRuntimeTransport(createBrowserSseConfig(config.sseUrl));
    case 'ws':
      return new OpenClawWebSocketRuntimeTransport(createBrowserWebSocketConfig(config.wsUrl));
  }
}

export function createNodeOpenClawDevTransport(config: OpenClawDevConnectionConfig): RuntimeEventTransport {
  switch (config.mode) {
    case 'fixture':
      return createFixtureTransport();
    case 'sse':
      return new LocalRuntimeEventSourceTransport({
        source: createOpenClawFetchSseRuntimeEventSource({
          url: requireUrl(config.sseUrl, 'OpenClaw SSE'),
          adapter: createDefaultOpenClawAdapter(),
        }),
      });
    case 'ws':
      return new OpenClawWebSocketRuntimeTransport(createNodeWebSocketConfig(config.wsUrl));
  }
}

export function describeOpenClawDevConnection(config: OpenClawDevConnectionConfig): string {
  switch (config.mode) {
    case 'fixture':
      return 'fixture sample stream';
    case 'sse':
      return `OpenClaw SSE at ${config.sseUrl}`;
    case 'ws':
      return `OpenClaw WebSocket at ${config.wsUrl}`;
  }
}

function createFixtureTransport(): RuntimeEventTransport {
  return new LocalRuntimeEventSourceTransport({
    source: createIntervalRuntimeEventSource(sampleRuntimeEvents, { intervalMs: 350 }),
  });
}

function createBrowserSseConfig(url: string | undefined): OpenClawSseRuntimeTransportConfig {
  if (!url) {
    throw new Error('Missing OpenClaw SSE URL');
  }

  return {
    url,
    adapter: createDefaultOpenClawAdapter(),
    createEventSource: (targetUrl) => {
      if (typeof EventSource === 'undefined') {
        throw new Error('EventSource is not available in this environment');
      }

      return adaptBrowserEventSource(new EventSource(targetUrl));
    },
  };
}

function createBrowserWebSocketConfig(url: string | undefined): OpenClawWebSocketRuntimeTransportConfig {
  if (!url) {
    throw new Error('Missing OpenClaw WebSocket URL');
  }

  return {
    url,
    adapter: createDefaultOpenClawAdapter(),
    createWebSocket: (targetUrl) => {
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is not available in this environment');
      }

      return adaptBrowserWebSocket(new WebSocket(targetUrl));
    },
  };
}

function createNodeWebSocketConfig(url: string | undefined): OpenClawWebSocketRuntimeTransportConfig {
  if (!url) {
    throw new Error('Missing OpenClaw WebSocket URL');
  }

  return {
    url,
    adapter: createDefaultOpenClawAdapter(),
    createWebSocket: (targetUrl) => {
      const ctor = readNodeWebSocketCtor();
      return adaptBrowserWebSocket(new ctor(targetUrl));
    },
  };
}

function readNodeWebSocketCtor(): new (url: string) => WebSocket {
  const candidate = (globalThis as { WebSocket?: new (url: string) => WebSocket }).WebSocket;

  if (!candidate) {
    throw new Error('WebSocket is not available in this Node runtime. Use OPENCLAW_TRANSPORT=sse or upgrade Node.');
  }

  return candidate;
}

function adaptBrowserEventSource(source: EventSource): EventSourceLike {
  const adapted: EventSourceLike = {
    onopen: null,
    onmessage: null,
    onerror: null,
    close() {
      source.close();
    },
  };

  source.onopen = () => {
    adapted.onopen?.();
  };

  source.onmessage = (event) => {
    adapted.onmessage?.({ data: event.data });
  };

  source.onerror = (error) => {
    adapted.onerror?.(error);
  };

  return adapted;
}

function adaptBrowserWebSocket(socket: WebSocket): WebSocketLike {
  const adapted: WebSocketLike = {
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    close(code?: number, reason?: string) {
      socket.close(code, reason);
    },
  };

  socket.onopen = () => {
    adapted.onopen?.();
  };

  socket.onmessage = (event) => {
    adapted.onmessage?.({ data: String(event.data) });
  };

  socket.onerror = (error) => {
    adapted.onerror?.(error);
  };

  socket.onclose = (event) => {
    adapted.onclose?.({
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
  };

  return adapted;
}

function requireUrl(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label} URL`);
  }

  return value;
}
