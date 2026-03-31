import assert from 'node:assert/strict';
import test from 'node:test';

import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { RuntimeVisualActorProjection, RuntimeVisualSessionProjection } from '../state/runtime-visual-store.js';
import type { RuntimeVisualState } from '../state/runtime-visual-store.js';
import {
  filterActors,
  filterTimelineEvents,
  readCurrentActors,
  renderActorCards,
  renderSelectedActor,
  renderSessionSummary,
  selectDashboardState,
} from './live-dashboard.js';

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

test('renders actor cards from derived actor projections and highlights selection', () => {
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

  const html = renderActorCards(actors, 'agent-1');

  assert.match(html, /Willy/);
  assert.match(html, /implementation/);
  assert.match(html, /Implement dashboard/);
  assert.match(html, /Writing the dashboard shell/);
  assert.match(html, /is-selected/);
});

test('renders selected actor details', () => {
  const html = renderSelectedActor({
    id: 'agent-1',
    name: 'Willy',
    role: 'implementation',
    kind: 'agent',
    sessionId: 'session-1',
    currentTaskTitle: 'Implement dashboard',
    currentToolName: 'read_file',
    currentZone: 'coding',
    currentActivity: 'coding',
    lastRuntimeEventId: 'evt-1',
    lastVisualEventId: 'evt-1:visual',
    lastSummary: 'Writing the dashboard shell',
    lastError: 'none',
    updatedAt: '2026-03-31T20:00:00.000Z',
  });

  assert.match(html, /read_file/);
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

test('filters actors by name, role, task, and summary text', () => {
  const actors: RuntimeVisualActorProjection[] = [
    {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      kind: 'agent',
      sessionId: 'session-1',
      currentTaskTitle: 'Implement dashboard',
      lastSummary: 'Adding timeline filters',
      lastRuntimeEventId: 'evt-1',
      updatedAt: '2026-03-31T20:00:00.000Z',
    },
    {
      id: 'agent-2',
      name: 'Nick',
      role: 'review',
      kind: 'agent',
      sessionId: 'session-1',
      currentTaskTitle: 'Review dashboard',
      lastSummary: 'Checking regressions',
      lastRuntimeEventId: 'evt-2',
      updatedAt: '2026-03-31T20:00:01.000Z',
    },
  ];

  assert.deepEqual(filterActors(actors, 'timeline').map((actor) => actor.id), ['agent-1']);
  assert.deepEqual(filterActors(actors, 'review').map((actor) => actor.id), ['agent-2']);
});

test('filters timeline events to the selected session and actor', () => {
  const events: RuntimeEvent[] = [
    {
      id: 'evt-1',
      timestamp: '2026-03-31T20:00:00.000Z',
      sessionId: 'session-1',
      source: 'openclaw.runtime',
      kind: 'task.started',
      actor: { id: 'agent-1', name: 'Willy' },
      payload: { taskId: 'task-1', title: 'Implement dashboard', status: 'started' },
    },
    {
      id: 'evt-2',
      timestamp: '2026-03-31T20:00:01.000Z',
      sessionId: 'session-2',
      source: 'openclaw.runtime',
      kind: 'task.started',
      actor: { id: 'agent-2', name: 'Nick' },
      payload: { taskId: 'task-2', title: 'Review dashboard', status: 'started' },
    },
  ] as RuntimeEvent[];

  assert.deepEqual(
    filterTimelineEvents(events, 'session-1', 'agent-1').map((event) => event.id),
    ['evt-1'],
  );
});

test('selectDashboardState prefers explicit session and actor selection with filter applied', () => {
  const state = {
    connectionStatus: 'connected',
    runtimeEvents: [
      {
        id: 'evt-1',
        timestamp: '2026-03-31T20:00:00.000Z',
        sessionId: 'session-1',
        source: 'openclaw.runtime',
        kind: 'task.started',
        actor: { id: 'agent-1', name: 'Willy' },
        payload: { taskId: 'task-1', title: 'Implement dashboard', status: 'started' },
      },
      {
        id: 'evt-2',
        timestamp: '2026-03-31T20:00:01.000Z',
        sessionId: 'session-2',
        source: 'openclaw.runtime',
        kind: 'task.started',
        actor: { id: 'agent-2', name: 'Nick' },
        payload: { taskId: 'task-2', title: 'Review dashboard', status: 'started' },
      },
    ],
    visualEvents: [],
    lastError: undefined,
    sessionsById: {
      'session-1': {
        id: 'session-1',
        actorIds: ['agent-1'],
        updatedAt: '2026-03-31T20:00:00.000Z',
      },
      'session-2': {
        id: 'session-2',
        actorIds: ['agent-2'],
        updatedAt: '2026-03-31T20:00:01.000Z',
      },
    },
    actorsById: {
      'session-1:agent-1': {
        id: 'agent-1',
        name: 'Willy',
        role: 'implementation',
        sessionId: 'session-1',
        currentTaskTitle: 'Implement dashboard',
        lastRuntimeEventId: 'evt-1',
        updatedAt: '2026-03-31T20:00:00.000Z',
      },
      'session-2:agent-2': {
        id: 'agent-2',
        name: 'Nick',
        role: 'review',
        sessionId: 'session-2',
        currentTaskTitle: 'Review dashboard',
        lastRuntimeEventId: 'evt-2',
        updatedAt: '2026-03-31T20:00:01.000Z',
      },
    },
  } as RuntimeVisualState;

  const selection = selectDashboardState(state, {
    selectedSessionId: 'session-2',
    selectedActorKey: 'session-2:agent-2',
    actorFilterText: 'review',
  });

  assert.equal(selection.selectedSession?.id, 'session-2');
  assert.equal(selection.selectedActor?.id, 'agent-2');
  assert.deepEqual(selection.timelineEvents.map((event) => event.id), ['evt-2']);
});

test('selectDashboardState keeps session-wide timeline when actor is not explicitly selected', () => {
  const state = {
    connectionStatus: 'connected',
    runtimeEvents: [
      {
        id: 'evt-1',
        timestamp: '2026-03-31T20:00:00.000Z',
        sessionId: 'session-2',
        source: 'openclaw.runtime',
        kind: 'task.started',
        actor: { id: 'agent-2', name: 'Nick' },
        payload: { taskId: 'task-2', title: 'Review dashboard', status: 'started' },
      },
      {
        id: 'evt-2',
        timestamp: '2026-03-31T20:00:01.000Z',
        sessionId: 'session-2',
        source: 'openclaw.runtime',
        kind: 'tool.started',
        actor: { id: 'agent-3', name: 'Yuqi' },
        payload: { toolName: 'web_search', status: 'started' },
      },
    ],
    visualEvents: [],
    lastError: undefined,
    sessionsById: {
      'session-2': {
        id: 'session-2',
        actorIds: ['agent-2', 'agent-3'],
        updatedAt: '2026-03-31T20:00:01.000Z',
      },
    },
    actorsById: {
      'session-2:agent-2': {
        id: 'agent-2',
        name: 'Nick',
        role: 'review',
        sessionId: 'session-2',
        currentTaskTitle: 'Review dashboard',
        lastRuntimeEventId: 'evt-1',
        updatedAt: '2026-03-31T20:00:00.000Z',
      },
      'session-2:agent-3': {
        id: 'agent-3',
        name: 'Yuqi',
        role: 'research',
        sessionId: 'session-2',
        currentTaskTitle: 'Search references',
        lastRuntimeEventId: 'evt-2',
        updatedAt: '2026-03-31T20:00:01.000Z',
      },
    },
  } as RuntimeVisualState;

  const selection = selectDashboardState(state, {
    selectedSessionId: 'session-2',
    actorFilterText: '',
  });

  assert.equal(selection.selectedSession?.id, 'session-2');
  assert.equal(selection.selectedActor, undefined);
  assert.deepEqual(selection.timelineEvents.map((event) => event.id), ['evt-1', 'evt-2']);
});
