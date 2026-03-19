import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { VisualEvent } from '../contracts/visual-events.js';
import type { RuntimeToVisualTranslator } from '../translators/runtime-to-visual.js';

export interface RuntimeVisualState {
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  runtimeEvents: RuntimeEvent[];
  visualEvents: VisualEvent[];
  lastError?: string;
}

export interface RuntimeVisualStoreOptions {
  translator: RuntimeToVisualTranslator;
  maxRuntimeEvents?: number;
  maxVisualEvents?: number;
}

export type RuntimeVisualSubscriber = (state: Readonly<RuntimeVisualState>) => void;

const DEFAULT_MAX_RUNTIME_EVENTS = 200;
const DEFAULT_MAX_VISUAL_EVENTS = 200;

export class RuntimeVisualStore {
  private state: RuntimeVisualState = {
    connectionStatus: 'idle',
    runtimeEvents: [],
    visualEvents: [],
  };

  private subscribers = new Set<RuntimeVisualSubscriber>();

  private readonly maxRuntimeEvents: number;
  private readonly maxVisualEvents: number;

  constructor(private readonly options: RuntimeVisualStoreOptions) {
    this.maxRuntimeEvents = options.maxRuntimeEvents ?? DEFAULT_MAX_RUNTIME_EVENTS;
    this.maxVisualEvents = options.maxVisualEvents ?? DEFAULT_MAX_VISUAL_EVENTS;
  }

  getSnapshot(): Readonly<RuntimeVisualState> {
    return createSnapshot(this.state);
  }

  subscribe(subscriber: RuntimeVisualSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(createSnapshot(this.state));
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  setConnectionStatus(status: RuntimeVisualState['connectionStatus']): void {
    this.update({
      ...this.state,
      connectionStatus: status,
      lastError: status === 'error' ? this.state.lastError : undefined,
    });
  }

  recordError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.update({
      ...this.state,
      connectionStatus: 'error',
      lastError: message,
    });
  }

  ingestRuntimeEvent(event: RuntimeEvent): void {
    const nextRuntimeEvents = trimTail([...this.state.runtimeEvents, event], this.maxRuntimeEvents);
    const translatedVisualEvents = this.options.translator.translate(event);
    const nextVisualEvents = trimTail([...this.state.visualEvents, ...translatedVisualEvents], this.maxVisualEvents);

    this.update({
      ...this.state,
      runtimeEvents: nextRuntimeEvents,
      visualEvents: nextVisualEvents,
    });
  }

  private update(state: RuntimeVisualState): void {
    this.state = state;
    for (const subscriber of this.subscribers) {
      subscriber(createSnapshot(this.state));
    }
  }
}

function createSnapshot(state: RuntimeVisualState): Readonly<RuntimeVisualState> {
  return structuredClone(state);
}

function trimTail<T>(values: T[], max: number): T[] {
  if (values.length <= max) return values;
  return values.slice(values.length - max);
}
