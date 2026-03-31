import assert from 'node:assert/strict';
import test from 'node:test';

import type { RuntimeVisualActorProjection, RuntimeVisualSessionProjection } from '../state/runtime-visual-store.js';
import type { RuntimeVisualState } from '../state/runtime-visual-store.js';
import { readCurrentActors, renderActorCards, renderSessionSummary } from './live-dashboard.js';

test('renders a session summary from derived session state', () => {
  const session: RuntimeVisualSessionProjection = {
    id: 'session-1',
    status: 'running',
    title: 'Dashboard demo',
    goal: 'Show live activity',
    actorIds: ['agent-1', 'agent-2'],
    latestSummary: 'Willy is working on Implement dashboard',
    lastRuntimeEventId: 'evt-1',
    lastVisualEventId: 'evt-1:visual',
    updatedAt: '2026-03-31T20:00:00.000Z',
  };

  const html = renderSessionSummary(session);

  assert.match(html, /Dashboard demo/);
  assert.match(html, /Show live activity/);
  assert.match(html, />2</);
});

test('renders actor cards from derived actor projections', () => {
  const actors: RuntimeVisualActorProjection[] = [
    {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
      sessionId: 'session-1',
      currentTaskTitle: 'Implement dashboard',
      currentZone: 'coding',
      currentActivity: 'coding',
      lastRuntimeEventId: 'evt-1',
      lastVisualEventId: 'evt-1:visual',
      lastSummary: 'Writing the dashboard shell',
      updatedAt: '2026-03-31T20:00:00.000Z',
    },
  ];

  const html = renderActorCards(actors);

  assert.match(html, /Willy/);
  assert.match(html, /implementation/);
  assert.match(html, /Implement dashboard/);
  assert.match(html, /Writing the dashboard shell/);
});

test('reads current actors for the selected session only', () => {
  const state = {
    connectionStatus: 'connected',
    runtimeEvents: [],
    visualEvents: [],
    lastError: undefined,
    sessionsById: {
      'session-2': {
        id: 'session-2',
        actorIds: ['agent-2'],
      },
    },
    actorsById: {
      'session-1:agent-1': {
        id: 'agent-1',
        name: 'Willy',
        sessionId: 'session-1',
        lastRuntimeEventId: 'evt-1',
        updatedAt: '2026-03-31T20:00:00.000Z',
      },
      'session-2:agent-2': {
        id: 'agent-2',
        name: 'Nick',
        sessionId: 'session-2',
        lastRuntimeEventId: 'evt-2',
        updatedAt: '2026-03-31T20:00:01.000Z',
      },
    },
  } as RuntimeVisualState;

  const actors = readCurrentActors(state, {
    id: 'session-2',
    actorIds: ['agent-2'],
  });

  assert.deepEqual(actors.map((actor) => actor.id), ['agent-2']);
});
