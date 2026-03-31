import assert from 'node:assert/strict';
import test from 'node:test';

import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { VisualEvent } from '../contracts/visual-events.js';
import type { RuntimeVisualActorProjection, RuntimeVisualSessionProjection } from '../state/runtime-visual-store.js';
import type { RuntimeVisualState } from '../state/runtime-visual-store.js';
import {
  filterActors,
  filterTimelineByCategory,
  filterTimelineEvents,
  readCurrentActors,
  renderActorCards,
  renderCurrentStateSummary,
  renderInspectorSummary,
  renderSelectedActor,
  renderSessionRail,
  renderSessionSummary,
  renderTimeline,
  selectDashboardState,
  sortActors,
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

test('renders session rail with selected session state', () => {
  const html = renderSessionRail(
    [
      {
        id: 'session-1',
        title: 'Planning run',
        status: 'running',
        actorIds: ['agent-1'],
      },
    ],
    'session-1',
  );

  assert.match(html, /Planning run/);
  assert.match(html, /is-selected/);
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

test('renders current state summary for the selected session', () => {
  const html = renderCurrentStateSummary(
    {
      visibleActors: 3,
      activeTasks: 2,
      activeTools: 1,
      actorsWithErrors: 1,
      dominantActivity: 'coding',
    },
    {
      id: 'session-2',
      title: 'Current run',
      actorIds: ['agent-1', 'agent-2', 'agent-3'],
    },
  );

  assert.match(html, /Current run/);
  assert.match(html, />2</);
  assert.match(html, /coding/);
});

test('renders inspector summary with linked visual evidence', () => {
  const html = renderInspectorSummary(
    {
      id: 'evt-1',
      timestamp: '2026-03-31T20:00:00.000Z',
      sessionId: 'session-1',
      source: 'openclaw.runtime',
      kind: 'task.started',
      payload: { taskId: 'task-1', title: 'Implement dashboard', status: 'started' },
    } as RuntimeEvent,
    {
      id: 'vis-1',
      timestamp: '2026-03-31T20:00:00.000Z',
      sessionId: 'session-1',
      type: 'actor.activity.changed',
      summary: 'Willy started coding',
      sourceRuntimeEventIds: ['evt-1'],
    } as VisualEvent,
  );

  assert.match(html, /evt-1/);
  assert.match(html, /vis-1/);
});

test('renders timeline with focused event state', () => {
  const html = renderTimeline(
    [
      {
        id: 'evt-1',
        timestamp: '2026-03-31T20:00:00.000Z',
        sessionId: 'session-1',
        source: 'openclaw.runtime',
        kind: 'task.started',
        actor: { id: 'agent-1', name: 'Willy' },
        payload: { taskId: 'task-1', title: 'Implement dashboard', status: 'started' },
      },
    ] as RuntimeEvent[],
    'evt-1',
  );

  assert.match(html, /is-selected/);
  assert.match(html, /Implement dashboard/);
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

test('sorts actors by configured sort key', () => {
  const actors: RuntimeVisualActorProjection[] = [
    {
      id: 'agent-2',
      name: 'Nick',
      role: 'review',
      sessionId: 'session-1',
      currentActivity: 'waiting',
      lastRuntimeEventId: 'evt-2',
      updatedAt: '2026-03-31T20:00:01.000Z',
    },
    {
      id: 'agent-1',
      name: 'Willy',
      role: 'implementation',
      sessionId: 'session-1',
      currentActivity: 'coding',
      lastRuntimeEventId: 'evt-1',
      updatedAt: '2026-03-31T20:00:00.000Z',
    },
  ];

  assert.deepEqual(sortActors(actors, 'name').map((actor) => actor.id), ['agent-2', 'agent-1']);
  assert.deepEqual(sortActors(actors, 'updated').map((actor) => actor.id), ['agent-2', 'agent-1']);
  assert.deepEqual(sortActors(actors, 'activity').map((actor) => actor.id), ['agent-1', 'agent-2']);
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

test('filters timeline events by category', () => {
  const events: RuntimeEvent[] = [
    {
      id: 'evt-task',
      timestamp: '2026-03-31T20:00:00.000Z',
      sessionId: 'session-1',
      source: 'openclaw.runtime',
      kind: 'task.started',
      payload: { taskId: 'task-1', title: 'Implement dashboard', status: 'started' },
    },
    {
      id: 'evt-tool',
      timestamp: '2026-03-31T20:00:01.000Z',
      sessionId: 'session-1',
      source: 'openclaw.tooling',
      kind: 'tool.started',
      payload: { tool: { name: 'read' }, status: 'started' },
    },
    {
      id: 'evt-error',
      timestamp: '2026-03-31T20:00:02.000Z',
      sessionId: 'session-1',
      source: 'system',
      kind: 'warning',
      payload: { message: 'Heads up' },
    },
  ] as RuntimeEvent[];

  assert.deepEqual(filterTimelineByCategory(events, 'tools').map((event) => event.id), ['evt-tool']);
  assert.deepEqual(filterTimelineByCategory(events, 'system').map((event) => event.id), ['evt-error']);
});

test('selectDashboardState prefers explicit session, actor, and event focus', () => {
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
        kind: 'tool.started',
        actor: { id: 'agent-2', name: 'Nick' },
        payload: { tool: { name: 'read' }, status: 'started' },
      },
    ],
    visualEvents: [
      {
        id: 'vis-2',
        timestamp: '2026-03-31T20:00:01.000Z',
        sessionId: 'session-2',
        actorId: 'agent-2',
        type: 'actor.tool.started',
        summary: 'Nick started read',
        sourceRuntimeEventIds: ['evt-2'],
      },
    ],
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
        currentActivity: 'coding',
        lastRuntimeEventId: 'evt-1',
        updatedAt: '2026-03-31T20:00:00.000Z',
      },
      'session-2:agent-2': {
        id: 'agent-2',
        name: 'Nick',
        role: 'review',
        sessionId: 'session-2',
        currentToolName: 'read',
        currentActivity: 'reading',
        lastRuntimeEventId: 'evt-2',
        updatedAt: '2026-03-31T20:00:01.000Z',
      },
    },
  } as RuntimeVisualState;

  const selection = selectDashboardState(state, {
    selectedSessionId: 'session-2',
    selectedActorKey: 'session-2:agent-2',
    selectedRuntimeEventId: 'evt-2',
    actorFilterText: 'review',
    actorSort: 'updated',
    timelineFilter: 'tools',
  });

  assert.equal(selection.selectedSession?.id, 'session-2');
  assert.equal(selection.selectedActor?.id, 'agent-2');
  assert.equal(selection.selectedRuntimeEvent?.id, 'evt-2');
  assert.equal(selection.selectedVisualEvent?.id, 'vis-2');
  assert.equal(selection.currentStateSummary.activeTools, 1);
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
        payload: { tool: { name: 'web_search' }, status: 'started' },
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
        currentActivity: 'coding',
        lastRuntimeEventId: 'evt-1',
        updatedAt: '2026-03-31T20:00:00.000Z',
      },
      'session-2:agent-3': {
        id: 'agent-3',
        name: 'Yuqi',
        role: 'research',
        sessionId: 'session-2',
        currentTaskTitle: 'Search references',
        currentActivity: 'researching',
        lastRuntimeEventId: 'evt-2',
        updatedAt: '2026-03-31T20:00:01.000Z',
      },
    },
  } as RuntimeVisualState;

  const selection = selectDashboardState(state, {
    selectedSessionId: 'session-2',
    actorFilterText: '',
    actorSort: 'updated',
    timelineFilter: 'all',
  });

  assert.equal(selection.selectedSession?.id, 'session-2');
  assert.equal(selection.selectedActor, undefined);
  assert.equal(selection.selectedRuntimeEvent?.id, 'evt-2');
  assert.deepEqual(selection.timelineEvents.map((event) => event.id), ['evt-1', 'evt-2']);
  assert.equal(selection.currentStateSummary.visibleActors, 2);
});
