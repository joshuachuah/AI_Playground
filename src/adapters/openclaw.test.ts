import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultOpenClawEventNormalizer } from './openclaw.js';

test('normalizes a task event with inferred source and actor metadata', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  const event = normalizer.normalize({
    id: 'evt-task-progressed',
    timestamp: '2026-03-31T08:00:00.000Z',
    sessionId: 'session-123',
    kind: 'task.progressed',
    actor: {
      id: 'agent-willy',
      name: 'Willy',
      role: 'implementation',
    },
    payload: {
      taskId: 'task-1',
      title: 'Normalize runtime events',
      progress: 50,
      summary: 'Halfway done',
    },
  });

  assert.deepEqual(event, {
    id: 'evt-task-progressed',
    timestamp: '2026-03-31T08:00:00.000Z',
    sessionId: 'session-123',
    source: 'openclaw.runtime',
    kind: 'task.progressed',
    actor: {
      id: 'agent-willy',
      name: 'Willy',
      role: 'implementation',
      kind: undefined,
    },
    openai: undefined,
    payload: {
      taskId: 'task-1',
      title: 'Normalize runtime events',
      status: 'in_progress',
      parentTaskId: undefined,
      progress: 50,
      summary: 'Halfway done',
    },
  });
});

test('normalizes tool and OpenAI metadata with explicit source', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  const event = normalizer.normalize({
    id: 'evt-tool-started',
    timestamp: '2026-03-31T08:01:00.000Z',
    sessionId: 'session-123',
    source: 'openclaw.tooling',
    kind: 'tool.started',
    payload: {
      tool: {
        name: 'read',
        invocationId: 'inv-1',
      },
      inputSummary: 'Read docs/architecture.md',
    },
    openai: {
      model: 'gpt-5.4',
      responseId: 'resp_123',
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    },
  });

  assert.deepEqual(event, {
    id: 'evt-tool-started',
    timestamp: '2026-03-31T08:01:00.000Z',
    sessionId: 'session-123',
    source: 'openclaw.tooling',
    kind: 'tool.started',
    actor: undefined,
    openai: {
      provider: 'openai',
      model: 'gpt-5.4',
      responseId: 'resp_123',
      requestId: undefined,
      conversationId: undefined,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
      finishReason: undefined,
    },
    payload: {
      tool: {
        name: 'read',
        invocationId: 'inv-1',
        displayName: undefined,
      },
      inputSummary: 'Read docs/architecture.md',
      outputSummary: undefined,
      status: 'started',
    },
  });
});

test('uses the received timestamp fallback and supports model response payloads', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  const event = normalizer.normalize(
    {
      id: 'evt-model-delta',
      sessionId: 'session-123',
      kind: 'model.response.delta',
      payload: {
        summary: 'Streaming partial output',
      },
      openai: {
        responseId: 'resp_456',
        finishReason: 'stop',
      },
    },
    {
      receivedAt: '2026-03-31T08:02:00.000Z',
    },
  );

  assert.deepEqual(event, {
    id: 'evt-model-delta',
    timestamp: '2026-03-31T08:02:00.000Z',
    sessionId: 'session-123',
    source: 'openai.responses',
    kind: 'model.response.delta',
    actor: undefined,
    openai: {
      provider: 'openai',
      model: undefined,
      responseId: 'resp_456',
      requestId: undefined,
      conversationId: undefined,
      usage: undefined,
      finishReason: 'stop',
    },
    payload: {
      responseId: 'resp_456',
      status: 'streaming',
      summary: 'Streaming partial output',
    },
  });
});

test('uses payload-level OpenAI metadata for model response payload correlation', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  const event = normalizer.normalize({
    id: 'evt-model-created',
    timestamp: '2026-03-31T08:02:30.000Z',
    sessionId: 'session-123',
    kind: 'model.response.created',
    payload: {
      summary: 'Model response created',
      openai: {
        responseId: 'resp_from_payload',
        model: 'gpt-5.4',
      },
    },
  });

  assert.deepEqual(event, {
    id: 'evt-model-created',
    timestamp: '2026-03-31T08:02:30.000Z',
    sessionId: 'session-123',
    source: 'openai.responses',
    kind: 'model.response.created',
    actor: undefined,
    openai: {
      provider: 'openai',
      model: 'gpt-5.4',
      responseId: 'resp_from_payload',
      requestId: undefined,
      conversationId: undefined,
      usage: undefined,
      finishReason: undefined,
    },
    payload: {
      responseId: 'resp_from_payload',
      status: 'created',
      summary: 'Model response created',
    },
  });
});

test('falls back to top-level tool data when payload tool ref is partial', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  const event = normalizer.normalize({
    id: 'evt-tool-partial',
    timestamp: '2026-03-31T08:03:00.000Z',
    sessionId: 'session-123',
    kind: 'tool.started',
    tool: {
      name: 'write',
      invocationId: 'inv-top-level',
      displayName: 'Write File',
    },
    payload: {
      tool: {
        invocationId: 'inv-payload',
      },
      inputSummary: 'Write src/index.ts',
    },
  });

  assert.deepEqual(event, {
    id: 'evt-tool-partial',
    timestamp: '2026-03-31T08:03:00.000Z',
    sessionId: 'session-123',
    source: 'openclaw.tooling',
    kind: 'tool.started',
    actor: undefined,
    openai: undefined,
    payload: {
      tool: {
        name: 'write',
        invocationId: 'inv-payload',
        displayName: 'Write File',
      },
      inputSummary: 'Write src/index.ts',
      outputSummary: undefined,
      status: 'started',
    },
  });
});

test('returns null for unsupported event kinds', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  const event = normalizer.normalize({
    id: 'evt-unknown',
    timestamp: '2026-03-31T08:03:00.000Z',
    sessionId: 'session-123',
    kind: 'custom.event',
    payload: {},
  });

  assert.equal(event, null);
});

test('throws when a required identity field is missing', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  assert.throws(
    () =>
      normalizer.normalize({
        id: 123 as unknown as string,
        timestamp: '2026-03-31T08:04:00.000Z',
        sessionId: 'session-123',
        kind: 'task.started',
        payload: {
          title: 'Missing task id',
        },
      }),
    /Missing OpenClaw event id/,
  );
});

test('throws when a top-level string field is malformed', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  assert.throws(
    () =>
      normalizer.normalize({
        id: 'evt-malformed-timestamp',
        timestamp: 123 as unknown as string,
        sessionId: 'session-123',
        kind: 'task.started',
        payload: {
          taskId: 'task-1',
          title: 'Malformed timestamp',
        },
      }),
    /Missing OpenClaw event timestamp/,
  );
});

test('throws when a required task identity field is missing', () => {
  const normalizer = createDefaultOpenClawEventNormalizer();

  assert.throws(
    () =>
      normalizer.normalize({
        id: 'evt-task-invalid',
        timestamp: '2026-03-31T08:04:00.000Z',
        sessionId: 'session-123',
        kind: 'task.started',
        payload: {
          title: 'Missing task id',
        },
      }),
    /Missing OpenClaw task id/,
  );
});
