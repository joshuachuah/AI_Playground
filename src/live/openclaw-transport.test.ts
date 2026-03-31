import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultOpenClawAdapter } from '../adapters/openclaw.js';
import {
  createInMemoryOpenClawRuntimeTransport,
  OpenClawSseRuntimeTransport,
  OpenClawWebSocketRuntimeTransport,
  parseOpenClawEventEnvelope,
} from './openclaw-transport.js';

test('parses an OpenClaw envelope payload', () => {
  const parsed = parseOpenClawEventEnvelope(
    JSON.stringify({
      event: {
        id: 'evt-1',
        kind: 'task.started',
        sessionId: 'session-1',
        payload: {
          taskId: 'task-1',
          title: 'Do work',
        },
      },
    }),
  );

  assert.equal(parsed.event.id, 'evt-1');
  assert.equal(parsed.event.kind, 'task.started');
});

test('normalizes raw OpenClaw events through the in-memory transport', async () => {
  const transport = createInMemoryOpenClawRuntimeTransport(
    [
      {
        id: 'evt-1',
        timestamp: '2026-03-31T14:00:00.000Z',
        sessionId: 'session-1',
        kind: 'task.started',
        payload: {
          taskId: 'task-1',
          title: 'Ship transport normalization',
        },
      },
    ],
    createDefaultOpenClawAdapter(),
  );

  const statuses: string[] = [];
  const events: unknown[] = [];

  await transport.connect({
    onStatusChange(status) {
      statuses.push(status);
    },
    onRuntimeEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(statuses, ['connecting', 'connected']);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    id: 'evt-1',
    timestamp: '2026-03-31T14:00:00.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'task.started',
    actor: undefined,
    openai: undefined,
    payload: {
      taskId: 'task-1',
      title: 'Ship transport normalization',
      status: 'started',
      parentTaskId: undefined,
      progress: undefined,
      summary: undefined,
    },
  });
});

test('SSE transport emits normalized runtime events from raw OpenClaw messages', async () => {
  const source = {
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    onerror: null as ((error: unknown) => void) | null,
    closeCalled: false,
    close() {
      this.closeCalled = true;
    },
  };

  const transport = new OpenClawSseRuntimeTransport({
    url: 'http://localhost:3000/runtime',
    adapter: createDefaultOpenClawAdapter(),
    createEventSource: () => source,
  });

  const statuses: string[] = [];
  const events: unknown[] = [];

  await transport.connect({
    onStatusChange(status) {
      statuses.push(status);
    },
    onRuntimeEvent(event) {
      events.push(event);
    },
  });

  source.onopen?.();
  source.onmessage?.({
    data: JSON.stringify({
      event: {
        id: 'evt-sse-1',
        timestamp: '2026-03-31T14:01:00.000Z',
        sessionId: 'session-1',
        kind: 'warning',
        payload: {
          message: 'Fixture-backed transport',
        },
      },
    }),
  });

  assert.deepEqual(statuses, ['connecting', 'connected']);
  assert.equal(events.length, 1);
  assert.equal((events[0] as { kind: string }).kind, 'warning');
});

test('WebSocket transport emits normalized runtime events from raw OpenClaw messages', async () => {
  const socket = {
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    onerror: null as ((error: unknown) => void) | null,
    onclose: null as ((event: { code?: number; reason?: string; wasClean?: boolean }) => void) | null,
    closeCalled: false,
    close() {
      this.closeCalled = true;
      this.onclose?.({ wasClean: true });
    },
  };

  const transport = new OpenClawWebSocketRuntimeTransport({
    url: 'ws://localhost:3000/runtime',
    adapter: createDefaultOpenClawAdapter(),
    createWebSocket: () => socket,
  });

  const statuses: string[] = [];
  const events: unknown[] = [];

  await transport.connect({
    onStatusChange(status) {
      statuses.push(status);
    },
    onRuntimeEvent(event) {
      events.push(event);
    },
  });

  socket.onopen?.();
  socket.onmessage?.({
    data: JSON.stringify({
      event: {
        id: 'evt-ws-1',
        timestamp: '2026-03-31T14:02:00.000Z',
        sessionId: 'session-1',
        kind: 'tool.started',
        payload: {
          tool: {
            name: 'read',
          },
        },
      },
    }),
  });

  await transport.disconnect();

  assert.deepEqual(statuses, ['connecting', 'connected', 'disconnected']);
  assert.equal(events.length, 1);
  assert.equal((events[0] as { kind: string }).kind, 'tool.started');
});
