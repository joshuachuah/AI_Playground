import { bootLiveClientApp } from '../app/boot.js';
import type { RuntimeEvent } from '../contracts/runtime-events.js';
import {
  LocalRuntimeEventSourceTransport,
  createIntervalRuntimeEventSource,
} from '../live/local-runtime-event-source.js';
import type { RuntimeVisualState } from '../state/runtime-visual-store.js';

const sessionId = 'session-local-inspector';
const actor = {
  id: 'agent-willy',
  name: 'Willy',
  kind: 'agent' as const,
};

const sampleRuntimeEvents: RuntimeEvent[] = [
  {
    id: 'evt-session-started',
    timestamp: '2026-03-19T19:40:00.000Z',
    sessionId,
    source: 'openclaw.runtime',
    kind: 'session.started',
    actor,
    payload: {
      status: 'started',
      title: 'Local runtime inspector demo',
      goal: 'Verify end-to-end transport → store → inspector flow',
    },
  },
  {
    id: 'evt-actor-spawned',
    timestamp: '2026-03-19T19:40:01.000Z',
    sessionId,
    source: 'openclaw.runtime',
    kind: 'actor.spawned',
    actor,
    payload: {
      status: 'spawned',
      summary: 'Willy joined the local session',
    },
  },
  {
    id: 'evt-task-started',
    timestamp: '2026-03-19T19:40:02.000Z',
    sessionId,
    source: 'openclaw.runtime',
    kind: 'task.started',
    actor,
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
    sessionId,
    source: 'openclaw.tooling',
    kind: 'tool.started',
    actor,
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
    sessionId,
    source: 'openclaw.tooling',
    kind: 'tool.completed',
    actor,
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
    sessionId,
    source: 'openclaw.runtime',
    kind: 'task.progressed',
    actor,
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
    sessionId,
    source: 'system',
    kind: 'warning',
    actor,
    payload: {
      code: 'demo.buffering',
      message: 'Demo stream is fixture-backed, not yet attached to a real OpenClaw daemon',
      retryable: false,
    },
  },
  {
    id: 'evt-task-completed',
    timestamp: '2026-03-19T19:40:07.000Z',
    sessionId,
    source: 'openclaw.runtime',
    kind: 'task.completed',
    actor,
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
    sessionId,
    source: 'openclaw.runtime',
    kind: 'session.completed',
    actor,
    payload: {
      status: 'completed',
      title: 'Local runtime inspector demo',
      goal: 'Verify end-to-end transport → store → inspector flow',
    },
  },
];

export async function runLocalLiveInspector(): Promise<void> {
  const transport = new LocalRuntimeEventSourceTransport({
    source: createIntervalRuntimeEventSource(sampleRuntimeEvents, { intervalMs: 300 }),
  });

  const app = bootLiveClientApp({ transport });
  let previousRuntimeEventCount = 0;

  const unsubscribe = app.store.subscribe((state) => {
    renderInspectorFrame(state, previousRuntimeEventCount);
    previousRuntimeEventCount = state.runtimeEvents.length;
  });

  try {
    await app.start();
    await waitForCompletion(app.store, 6000);
  } finally {
    await app.stop();
    unsubscribe();
  }
}

function renderInspectorFrame(state: Readonly<RuntimeVisualState>, previousRuntimeEventCount: number): void {
  const latestRuntimeEvent = state.runtimeEvents.at(-1);
  const latestVisualEvent = state.visualEvents.at(-1);
  const newTimelineEntries = state.runtimeEvents.slice(previousRuntimeEventCount).map((event) => {
    const actorName = event.actor?.name ?? 'unknown';
    return `- ${event.timestamp} :: ${event.kind} :: ${actorName}`;
  });

  console.log('\n=== AI_Playground local live inspector ===');
  console.log(`connection: ${state.connectionStatus}`);
  console.log(`runtime events: ${state.runtimeEvents.length}`);
  console.log(`visual events: ${state.visualEvents.length}`);
  console.log(`last error: ${state.lastError ?? 'none'}`);

  if (newTimelineEntries.length > 0) {
    console.log('timeline:');
    for (const line of newTimelineEntries) {
      console.log(line);
    }
  }

  console.log('latest inspector:');
  console.log(
    JSON.stringify(
      {
        runtime: latestRuntimeEvent
          ? {
              id: latestRuntimeEvent.id,
              kind: latestRuntimeEvent.kind,
              source: latestRuntimeEvent.source,
              actor: latestRuntimeEvent.actor?.name,
              payload: latestRuntimeEvent.payload,
            }
          : null,
        visual: latestVisualEvent
          ? {
              id: latestVisualEvent.id,
              type: latestVisualEvent.type,
              summary: latestVisualEvent.summary,
              scene: latestVisualEvent.scene,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

async function waitForCompletion(store: { getSnapshot(): Readonly<RuntimeVisualState> }, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = store.getSnapshot();
    if (snapshot.connectionStatus === 'disconnected' || snapshot.connectionStatus === 'error') {
      return;
    }

    await sleep(100);
  }

  throw new Error('Timed out waiting for the local live inspector stream to finish');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLocalLiveInspector().catch((error: unknown) => {
    console.error('[live-inspector] failed', error);
    process.exitCode = 1;
  });
}
