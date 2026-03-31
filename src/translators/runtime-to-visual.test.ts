import assert from 'node:assert/strict';
import test from 'node:test';

import type { RuntimeEvent } from '../contracts/runtime-events.js';
import { OpenClawRuntimeTranslator } from './runtime-to-visual.js';

const translator = new OpenClawRuntimeTranslator();

test('translates task progress into an activity visual event', () => {
  const event: RuntimeEvent<'task.progressed'> = {
    id: 'evt-task-progressed',
    timestamp: '2026-03-31T16:00:00.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'task.progressed',
    actor: {
      id: 'agent-1',
      name: 'Willy',
    },
    payload: {
      taskId: 'task-1',
      title: 'Implement dashboard',
      status: 'in_progress',
      progress: 75,
      summary: 'Wiring live state',
    },
  };

  assert.deepEqual(translator.translate(event), [
    {
      id: 'evt-task-progressed:visual',
      timestamp: '2026-03-31T16:00:00.000Z',
      sessionId: 'session-1',
      actorId: 'agent-1',
      type: 'actor.activity.changed',
      summary: 'Willy is working on Implement dashboard',
      scene: {
        target: { zone: 'coding' },
        activity: 'coding',
      },
      ui: {
        detail: 'Wiring live state (75%)',
      },
      sourceRuntimeEventIds: ['evt-task-progressed'],
    },
  ]);
});

test('translates tool completion into a tool completed visual event', () => {
  const event: RuntimeEvent<'tool.completed'> = {
    id: 'evt-tool-completed',
    timestamp: '2026-03-31T16:01:00.000Z',
    sessionId: 'session-1',
    source: 'openclaw.tooling',
    kind: 'tool.completed',
    actor: {
      id: 'agent-1',
      name: 'Willy',
    },
    payload: {
      tool: {
        name: 'read',
      },
      status: 'completed',
      outputSummary: 'Loaded architecture notes',
    },
  };

  assert.deepEqual(translator.translate(event), [
    {
      id: 'evt-tool-completed:visual',
      timestamp: '2026-03-31T16:01:00.000Z',
      sessionId: 'session-1',
      actorId: 'agent-1',
      type: 'actor.tool.completed',
      summary: 'Willy completed read',
      scene: {
        target: { zone: 'files' },
        activity: 'idle',
      },
      ui: {
        label: 'read',
        detail: 'Loaded architecture notes',
      },
      sourceRuntimeEventIds: ['evt-tool-completed'],
    },
  ]);
});

test('translates handoff-style messages into coordination visuals', () => {
  const event: RuntimeEvent<'message.sent'> = {
    id: 'evt-message-sent',
    timestamp: '2026-03-31T16:02:00.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'message.sent',
    actor: {
      id: 'agent-1',
      name: 'Willy',
    },
    payload: {
      messageId: 'msg-1',
      fromActorId: 'agent-1',
      toActorId: 'agent-2',
      summary: 'Handing off implementation',
    },
  };

  assert.deepEqual(translator.translate(event), [
    {
      id: 'evt-message-sent:visual',
      timestamp: '2026-03-31T16:02:00.000Z',
      sessionId: 'session-1',
      actorId: 'agent-1',
      type: 'actor.handoff',
      summary: 'Handing off implementation',
      scene: {
        target: { zone: 'coordination' },
        activity: 'handoff',
      },
      ui: {
        detail: 'agent-1 -> agent-2',
      },
      sourceRuntimeEventIds: ['evt-message-sent'],
    },
  ]);
});

test('translates warnings into warning severity session updates', () => {
  const event: RuntimeEvent<'warning'> = {
    id: 'evt-warning',
    timestamp: '2026-03-31T16:03:00.000Z',
    sessionId: 'session-1',
    source: 'system',
    kind: 'warning',
    payload: {
      code: 'demo.buffering',
      message: 'Fixture-backed stream',
      retryable: false,
    },
  };

  assert.deepEqual(translator.translate(event), [
    {
      id: 'evt-warning:visual',
      timestamp: '2026-03-31T16:03:00.000Z',
      sessionId: 'session-1',
      actorId: undefined,
      type: 'session.summary.updated',
      summary: 'Fixture-backed stream',
      ui: {
        severity: 'warning',
        detail: 'demo.buffering',
      },
      sourceRuntimeEventIds: ['evt-warning'],
    },
  ]);
});
