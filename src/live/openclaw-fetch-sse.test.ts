import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultOpenClawAdapter } from '../adapters/openclaw.js';
import { createOpenClawFetchSseRuntimeEventSource } from './openclaw-fetch-sse.js';

test('normalizes OpenClaw SSE fetch streams into runtime event envelopes', async () => {
  const source = createOpenClawFetchSseRuntimeEventSource({
    url: 'http://localhost:4318/runtime',
    adapter: createDefaultOpenClawAdapter(),
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"event":{"id":"evt-1","timestamp":"2026-03-31T14:00:00.000Z","sessionId":"session-1",',
              ),
            );
            controller.enqueue(
              new TextEncoder().encode(
                '"kind":"task.started","payload":{"taskId":"task-1","title":"Stream real OpenClaw events"}}}\n\n',
              ),
            );
            controller.close();
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
          },
        },
      ),
  });

  const envelopes: unknown[] = [];

  for await (const envelope of source.stream(new AbortController().signal)) {
    envelopes.push(envelope);
  }

  assert.equal(envelopes.length, 1);
  assert.deepEqual(envelopes[0], {
    event: {
      id: 'evt-1',
      timestamp: '2026-03-31T14:00:00.000Z',
      sessionId: 'session-1',
      source: 'openclaw.runtime',
      kind: 'task.started',
      actor: undefined,
      openai: undefined,
      payload: {
        taskId: 'task-1',
        title: 'Stream real OpenClaw events',
        status: 'started',
        parentTaskId: undefined,
        progress: undefined,
        summary: undefined,
      },
    },
  });
});

test('throws when the OpenClaw SSE fetch response is unsuccessful', async () => {
  const source = createOpenClawFetchSseRuntimeEventSource({
    url: 'http://localhost:4318/runtime',
    adapter: createDefaultOpenClawAdapter(),
    fetch: async () => new Response('nope', { status: 503, statusText: 'Service Unavailable' }),
  });

  await assert.rejects(
    async () => {
      for await (const _envelope of source.stream(new AbortController().signal)) {
        assert.fail('expected failed SSE response to stop the stream');
      }
    },
    /503 Service Unavailable/,
  );
});
