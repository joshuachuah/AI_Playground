import { createLiveClientShell } from '../app/index.js';
import { createInMemoryRuntimeTransport } from '../live/sse-transport.js';
import type { RuntimeEvent } from '../contracts/runtime-events.js';

const sampleRuntimeEvents: RuntimeEvent[] = [
  {
    id: 'evt-1',
    timestamp: new Date().toISOString(),
    sessionId: 'session-dev-shell',
    source: 'system',
    kind: 'actor.spawned',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      kind: 'agent',
    },
    payload: {
      status: 'spawned',
      summary: 'Agent joined',
    },
  },
  {
    id: 'evt-2',
    timestamp: new Date().toISOString(),
    sessionId: 'session-dev-shell',
    source: 'openclaw.tooling',
    kind: 'tool.started',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      kind: 'agent',
    },
    payload: {
      status: 'started',
      tool: {
        name: 'read',
        invocationId: 'inv-1',
      },
      inputSummary: 'Read architecture notes',
    },
  },
  {
    id: 'evt-3',
    timestamp: new Date().toISOString(),
    sessionId: 'session-dev-shell',
    source: 'system',
    kind: 'task.completed',
    actor: {
      id: 'agent-1',
      name: 'Willy',
      kind: 'agent',
    },
    payload: {
      taskId: 'task-1',
      title: 'Scaffold app shell',
      status: 'completed',
      summary: 'Live shell wired',
    },
  },
];

/**
 * Developer-oriented example for non-UI verification.
 *
 * Run inside a local script/REPL by importing this and calling `runLiveShellPreview`.
 */
export async function runLiveShellPreview(): Promise<void> {
  const { shell, store } = createLiveClientShell(createInMemoryRuntimeTransport(sampleRuntimeEvents));

  const unsubscribe = store.subscribe((state) => {
    // Keep this intentionally simple and framework-neutral.
    console.log('[live-shell-preview]', {
      connectionStatus: state.connectionStatus,
      runtimeEvents: state.runtimeEvents.length,
      visualEvents: state.visualEvents.length,
      latestVisualEvent: state.visualEvents.at(-1)?.summary,
    });
  });

  try {
    await shell.connect();
    await shell.disconnect();
  } finally {
    unsubscribe();
  }
}
