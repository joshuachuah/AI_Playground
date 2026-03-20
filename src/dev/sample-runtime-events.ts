import type { RuntimeEvent } from '../contracts/runtime-events.js';

export const localInspectorSessionId = 'session-local-inspector';

export const localInspectorActor = {
  id: 'agent-willy',
  name: 'Willy',
  kind: 'agent' as const,
};

export const sampleRuntimeEvents: RuntimeEvent[] = [
  {
    id: 'evt-session-started',
    timestamp: '2026-03-19T19:40:00.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.runtime',
    kind: 'session.started',
    actor: localInspectorActor,
    payload: {
      status: 'started',
      title: 'Local runtime inspector demo',
      goal: 'Verify end-to-end transport → store → inspector flow',
    },
  },
  {
    id: 'evt-actor-spawned',
    timestamp: '2026-03-19T19:40:01.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.runtime',
    kind: 'actor.spawned',
    actor: localInspectorActor,
    payload: {
      status: 'spawned',
      summary: 'Willy joined the local session',
    },
  },
  {
    id: 'evt-task-started',
    timestamp: '2026-03-19T19:40:02.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.runtime',
    kind: 'task.started',
    actor: localInspectorActor,
    payload: {
      taskId: 'task-boot',
      title: 'Wire local inspector',
      status: 'started',
      summary: 'Booting the developer-facing inspector flow',
    },
  },
  {
    id: 'evt-tool-started',
    timestamp: '2026-03-19T19:40:03.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.tooling',
    kind: 'tool.started',
    actor: localInspectorActor,
    payload: {
      status: 'started',
      tool: {
        name: 'read',
        invocationId: 'inv-local-1',
      },
      inputSummary: 'Read docs/architecture.md',
    },
  },
  {
    id: 'evt-tool-completed',
    timestamp: '2026-03-19T19:40:04.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.tooling',
    kind: 'tool.completed',
    actor: localInspectorActor,
    payload: {
      status: 'completed',
      tool: {
        name: 'read',
        invocationId: 'inv-local-1',
      },
      outputSummary: 'Loaded architecture notes successfully',
    },
  },
  {
    id: 'evt-task-progressed',
    timestamp: '2026-03-19T19:40:05.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.runtime',
    kind: 'task.progressed',
    actor: localInspectorActor,
    payload: {
      taskId: 'task-boot',
      title: 'Wire local inspector',
      status: 'in_progress',
      progress: 75,
      summary: 'Timeline and inspector are receiving live updates',
    },
  },
  {
    id: 'evt-warning',
    timestamp: '2026-03-19T19:40:06.000Z',
    sessionId: localInspectorSessionId,
    source: 'system',
    kind: 'warning',
    actor: localInspectorActor,
    payload: {
      code: 'demo.buffering',
      message: 'Demo stream is fixture-backed, not yet attached to a real OpenClaw daemon',
      retryable: false,
    },
  },
  {
    id: 'evt-task-completed',
    timestamp: '2026-03-19T19:40:07.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.runtime',
    kind: 'task.completed',
    actor: localInspectorActor,
    payload: {
      taskId: 'task-boot',
      title: 'Wire local inspector',
      status: 'completed',
      summary: 'Local developer inspector flow is ready',
    },
  },
  {
    id: 'evt-session-completed',
    timestamp: '2026-03-19T19:40:08.000Z',
    sessionId: localInspectorSessionId,
    source: 'openclaw.runtime',
    kind: 'session.completed',
    actor: localInspectorActor,
    payload: {
      status: 'completed',
      title: 'Local runtime inspector demo',
      goal: 'Verify end-to-end transport → store → inspector flow',
    },
  },
];
