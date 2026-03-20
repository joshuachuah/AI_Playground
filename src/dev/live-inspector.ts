import { bootLiveClientApp } from '../app/boot.js';
import {
  LocalRuntimeEventSourceTransport,
  createIntervalRuntimeEventSource,
} from '../live/local-runtime-event-source.js';
import type { RuntimeVisualState } from '../state/runtime-visual-store.js';
import { sampleRuntimeEvents } from './sample-runtime-events.js';

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
