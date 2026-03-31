import assert from 'node:assert/strict';
import test from 'node:test';

import type { RuntimeEvent } from '../contracts/runtime-events.js';
import { OpenClawRuntimeTranslator } from '../translators/runtime-to-visual.js';
import { RuntimeVisualStore } from './runtime-visual-store.js';

test('derives actor and session state from runtime and visual events', () => {
  const store = new RuntimeVisualStore({
    translator: new OpenClawRuntimeTranslator(),
  });

  const actorSpawned: RuntimeEvent<'actor.spawned'> = {
    id: 'evt-actor-spawned',
    timestamp: '2026-03-31T18:00:00.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'actor.spawned',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
    },
    payload: {
      status: 'spawned',
      summary: 'Willy joined',
    },
  };

  const taskStarted: RuntimeEvent<'task.started'> = {
    id: 'evt-task-started',
    timestamp: '2026-03-31T18:00:01.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'task.started',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
    },
    payload: {
      taskId: 'task-1',
      title: 'Implement dashboard',
      status: 'started',
      summary: 'Starting implementation',
    },
  };

  const toolStarted: RuntimeEvent<'tool.started'> = {
    id: 'evt-tool-started',
    timestamp: '2026-03-31T18:00:02.000Z',
    sessionId: 'session-1',
    source: 'openclaw.tooling',
    kind: 'tool.started',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
    },
    payload: {
      tool: {
        name: 'write',
      },
      status: 'started',
      inputSummary: 'Write the dashboard shell',
    },
  };

  const artifactCreated: RuntimeEvent<'artifact.created'> = {
    id: 'evt-artifact-created',
    timestamp: '2026-03-31T18:00:03.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'artifact.created',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
    },
    payload: {
      artifact: {
        id: 'artifact-1',
        type: 'file',
        name: 'dashboard.ts',
      },
      summary: 'Created dashboard.ts',
    },
  };

  const taskCompleted: RuntimeEvent<'task.completed'> = {
    id: 'evt-task-completed',
    timestamp: '2026-03-31T18:00:04.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'task.completed',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
    },
    payload: {
      taskId: 'task-1',
      title: 'Implement dashboard',
      status: 'completed',
      summary: 'Dashboard implementation done',
    },
  };

  const sessionCompleted: RuntimeEvent<'session.completed'> = {
    id: 'evt-session-completed',
    timestamp: '2026-03-31T18:00:05.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'session.completed',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
    },
    payload: {
      status: 'completed',
      title: 'Dashboard demo',
      goal: 'Show live activity',
    },
  };

  store.ingestRuntimeEvent(actorSpawned);
  store.ingestRuntimeEvent(taskStarted);
  store.ingestRuntimeEvent(toolStarted);
  store.ingestRuntimeEvent(artifactCreated);
  store.ingestRuntimeEvent(taskCompleted);
  store.ingestRuntimeEvent(sessionCompleted);

  const snapshot = store.getSnapshot();
  const actor = snapshot.actorsById['agent-1'];
  const session = snapshot.sessionsById['session-1'];

  assert.deepEqual(actor, {
    id: 'agent-1',
    name: 'Willy',
    role: 'implementation',
    kind: 'agent',
    sessionId: 'session-1',
    currentTaskId: undefined,
    currentTaskTitle: undefined,
    currentToolName: undefined,
    currentZone: 'idle',
    currentActivity: 'success',
    lastRuntimeEventId: 'evt-session-completed',
    lastVisualEventId: 'evt-session-completed:visual',
    lastSummary: 'Dashboard demo completed',
    lastError: undefined,
    lastArtifactId: 'artifact-1',
    lastArtifactName: 'dashboard.ts',
    updatedAt: '2026-03-31T18:00:05.000Z',
  });

  assert.deepEqual(session, {
    id: 'session-1',
    status: 'completed',
    title: 'Dashboard demo',
    goal: 'Show live activity',
    actorIds: ['agent-1'],
    latestSummary: 'Dashboard demo completed',
    lastRuntimeEventId: 'evt-session-completed',
    lastVisualEventId: 'evt-session-completed:visual',
    updatedAt: '2026-03-31T18:00:05.000Z',
  });
});

test('records actor error state from runtime and visual failures', () => {
  const store = new RuntimeVisualStore({
    translator: new OpenClawRuntimeTranslator(),
  });

  const taskFailed: RuntimeEvent<'task.failed'> = {
    id: 'evt-task-failed',
    timestamp: '2026-03-31T18:10:00.000Z',
    sessionId: 'session-2',
    source: 'openclaw.runtime',
    kind: 'task.failed',
    actor: {
      id: 'agent-2',
      name: 'Nick',
    },
    payload: {
      taskId: 'task-2',
      title: 'Review output',
      status: 'failed',
      summary: 'Validation failed',
    },
  };

  store.ingestRuntimeEvent(taskFailed);

  const actor = store.getSnapshot().actorsById['agent-2'];

  assert.equal(actor.currentActivity, 'error');
  assert.equal(actor.lastError, 'Nick hit an error');
  assert.equal(actor.lastSummary, 'Nick hit an error');
});
