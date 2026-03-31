import assert from 'node:assert/strict';
import test from 'node:test';

import type { RuntimeVisualActorProjection, RuntimeVisualSessionProjection } from '../state/runtime-visual-store.js';
import { renderActorCards, renderSessionSummary } from './live-dashboard.js';

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
  const actors: Record<string, RuntimeVisualActorProjection> = {
    'session-1:agent-1': {
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
  };

  const html = renderActorCards(actors);

  assert.match(html, /Willy/);
  assert.match(html, /implementation/);
  assert.match(html, /Implement dashboard/);
  assert.match(html, /Writing the dashboard shell/);
});
