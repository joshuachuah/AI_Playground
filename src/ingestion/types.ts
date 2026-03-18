import type { RuntimeEnvelope, RuntimeEvent } from '../contracts/runtime-events.js';

export type OpenClawRawEvent = Record<string, unknown>;

export type RuntimeNormalizerInput = RuntimeEvent | RuntimeEnvelope<OpenClawRawEvent> | OpenClawRawEvent;

export interface RuntimeNormalizer {
  normalize(input: RuntimeNormalizerInput): RuntimeEvent;
}
