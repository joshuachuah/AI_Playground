import type { RuntimeEvent } from '../contracts/runtime-events.js';
import { OpenClawRuntimeNormalizer } from './openclaw-normalization.js';
import type { RuntimeNormalizerInput } from './types.js';

export type RuntimeEventListener = (event: RuntimeEvent) => void;

export class RuntimeEventIngestion {
  private readonly normalizer: OpenClawRuntimeNormalizer;
  private readonly listeners = new Set<RuntimeEventListener>();

  constructor(normalizer: OpenClawRuntimeNormalizer = new OpenClawRuntimeNormalizer()) {
    this.normalizer = normalizer;
  }

  ingest(input: RuntimeNormalizerInput): RuntimeEvent {
    const normalizedEvent = this.normalizer.normalize(input);
    for (const listener of this.listeners) {
      listener(normalizedEvent);
    }
    return normalizedEvent;
  }

  subscribe(listener: RuntimeEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
