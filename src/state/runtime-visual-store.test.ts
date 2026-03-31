import assert from 'node:assert/strict';
import test from 'node:test';

import type { RuntimeEvent } from '../contracts/runtime-events.js';
import { OpenClawRuntimeTranslator } from '../translators/runtime-to-visual.js';
import { createRuntimeVisualActorKey, RuntimeVisualStore } from './runtime-visual-store.js';

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
  const actor = snapshot.actorsById[createRuntimeVisualActorKey('session-1', 'agent-1')];
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

  const actor = store.getSnapshot().actorsById[createRuntimeVisualActorKey('session-2', 'agent-2')];

  assert.equal(actor.currentActivity, 'error');
  assert.equal(actor.lastError, 'Nick hit an error');
  assert.equal(actor.lastSummary, 'Nick hit an error');
});

test('keeps actor projections isolated across sessions', () => {
  const store = new RuntimeVisualStore({
    translator: new OpenClawRuntimeTranslator(),
  });

  const firstSessionEvent: RuntimeEvent<'actor.spawned'> = {
    id: 'evt-session-1-actor',
    timestamp: '2026-03-31T18:20:00.000Z',
    sessionId: 'session-1',
    source: 'openclaw.runtime',
    kind: 'actor.spawned',
    actor: {
      id: 'shared-actor',
      name: 'Willy',
    },
    payload: {
      status: 'spawned',
      summary: 'Joined session 1',
    },
  };

  const secondSessionEvent: RuntimeEvent<'actor.spawned'> = {
    id: 'evt-session-2-actor',
    timestamp: '2026-03-31T18:20:01.000Z',
    sessionId: 'session-2',
    source: 'openclaw.runtime',
    kind: 'actor.spawned',
    actor: {
      id: 'shared-actor',
      name: 'Willy clone',
    },
    payload: {
      status: 'spawned',
      summary: 'Joined session 2',
    },
  };

  store.ingestRuntimeEvent(firstSessionEvent);
  store.ingestRuntimeEvent(secondSessionEvent);

  const snapshot = store.getSnapshot();

  assert.equal(snapshot.actorsById[createRuntimeVisualActorKey('session-1', 'shared-actor')].sessionId, 'session-1');
  assert.equal(snapshot.actorsById[createRuntimeVisualActorKey('session-1', 'shared-actor')].name, 'Willy');
  assert.equal(snapshot.actorsById[createRuntimeVisualActorKey('session-2', 'shared-actor')].sessionId, 'session-2');
  assert.equal(snapshot.actorsById[createRuntimeVisualActorKey('session-2', 'shared-actor')].name, 'Willy clone');
});

test('preserves actor role and kind when later events omit optional actor metadata', () => {
  const store = new RuntimeVisualStore({
    translator: new OpenClawRuntimeTranslator(),
  });

  const actorSpawned: RuntimeEvent<'actor.spawned'> = {
    id: 'evt-actor-spawned',
    timestamp: '2026-03-31T18:25:00.000Z',
    sessionId: 'session-keep-metadata',
    source: 'openclaw.runtime',
    kind: 'actor.spawned',
    actor: {
      id: 'agent-metadata',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
    },
    payload: {
      status: 'spawned',
      summary: 'Actor joined',
    },
  };

  const taskStarted: RuntimeEvent<'task.started'> = {
    id: 'evt-task-started',
    timestamp: '2026-03-31T18:25:01.000Z',
    sessionId: 'session-keep-metadata',
    source: 'openclaw.runtime',
    kind: 'task.started',
    actor: {
      id: 'agent-metadata',
      name: 'Willy',
    },
    payload: {
      taskId: 'task-1',
      title: 'Implement dashboard',
      status: 'started',
      summary: 'Starting work',
    },
  };

  store.ingestRuntimeEvent(actorSpawned);
  store.ingestRuntimeEvent(taskStarted);

  const actor = store.getSnapshot().actorsById[createRuntimeVisualActorKey('session-keep-metadata', 'agent-metadata')];

  assert.equal(actor.role, 'implementation');
  assert.equal(actor.kind, 'agent');
});

test('removes actor projections when actors leave the session', () => {
  const store = new RuntimeVisualStore({
    translator: new OpenClawRuntimeTranslator(),
  });

  const actorSpawned: RuntimeEvent<'actor.spawned'> = {
    id: 'evt-actor-spawned',
    timestamp: '2026-03-31T18:30:00.000Z',
    sessionId: 'session-3',
    source: 'openclaw.runtime',
    kind: 'actor.spawned',
    actor: {
      id: 'agent-3',
      name: 'Yuqi',
    },
    payload: {
      status: 'spawned',
      summary: 'Joined session',
    },
  };

  const actorRemoved: RuntimeEvent<'actor.removed'> = {
    id: 'evt-actor-removed',
    timestamp: '2026-03-31T18:30:01.000Z',
    sessionId: 'session-3',
    source: 'openclaw.runtime',
    kind: 'actor.removed',
    actor: {
      id: 'agent-3',
      name: 'Yuqi',
    },
    payload: {
      status: 'removed',
      summary: 'Left session',
    },
  };

  store.ingestRuntimeEvent(actorSpawned);
  store.ingestRuntimeEvent(actorRemoved);

  const snapshot = store.getSnapshot();

  assert.equal(snapshot.actorsById[createRuntimeVisualActorKey('session-3', 'agent-3')], undefined);
  assert.deepEqual(snapshot.sessionsById['session-3'].actorIds, []);
});

test('clears active tools when a task fails', () => {
  const store = new RuntimeVisualStore({
    translator: new OpenClawRuntimeTranslator(),
  });

  const toolStarted: RuntimeEvent<'tool.started'> = {
    id: 'evt-tool-started',
    timestamp: '2026-03-31T18:35:00.000Z',
    sessionId: 'session-4',
    source: 'openclaw.tooling',
    kind: 'tool.started',
    actor: {
      id: 'agent-4',
      name: 'Nick',
    },
    payload: {
      tool: {
        name: 'write',
      },
      status: 'started',
      inputSummary: 'Writing review notes',
    },
  };

  const taskFailed: RuntimeEvent<'task.failed'> = {
    id: 'evt-task-failed',
    timestamp: '2026-03-31T18:35:01.000Z',
    sessionId: 'session-4',
    source: 'openclaw.runtime',
    kind: 'task.failed',
    actor: {
      id: 'agent-4',
      name: 'Nick',
    },
    payload: {
      taskId: 'task-4',
      title: 'Review output',
      status: 'failed',
      summary: 'Validation failed',
    },
  };

  store.ingestRuntimeEvent(toolStarted);
  store.ingestRuntimeEvent(taskFailed);

  const actor = store.getSnapshot().actorsById[createRuntimeVisualActorKey('session-4', 'agent-4')];

  assert.equal(actor.currentToolName, undefined);
  assert.equal(actor.currentActivity, 'error');
});
