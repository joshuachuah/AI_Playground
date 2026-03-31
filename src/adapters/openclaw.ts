import type { RuntimeEvent, RuntimeEventSource } from '../contracts/runtime-events.js';

export interface OpenClawRawActorRef {
  id?: string;
  name?: string;
  role?: string;
  kind?: string;
}

export interface OpenClawRawToolRef {
  name?: string;
  invocationId?: string;
  displayName?: string;
}

export interface OpenClawRawArtifactRef {
  id?: string;
  type?: string;
  name?: string;
  uri?: string;
}

export interface OpenClawRawEventEnvelope {
  id?: string;
  timestamp?: string;
  sessionId?: string;
  source?: string;
  kind?: string;
  actor?: OpenClawRawActorRef;
  tool?: OpenClawRawToolRef;
  artifact?: OpenClawRawArtifactRef;
  payload?: unknown;
  openai?: unknown;
  [key: string]: unknown;
}

export interface NormalizeOpenClawEventContext {
  defaultSource?: RuntimeEventSource;
  receivedAt?: string;
}

export interface OpenClawEventNormalizer {
  normalize(
    envelope: OpenClawRawEventEnvelope,
    context?: NormalizeOpenClawEventContext,
  ): RuntimeEvent | RuntimeEvent[] | null;
}

export interface OpenClawAdapter {
  readonly runtime: 'openclaw';
  normalizeEvent(
    envelope: OpenClawRawEventEnvelope,
    context?: NormalizeOpenClawEventContext,
  ): RuntimeEvent | RuntimeEvent[] | null;
}

export interface OpenClawAdapterConfig {
  normalizer: OpenClawEventNormalizer;
}

export class DefaultOpenClawAdapter implements OpenClawAdapter {
  readonly runtime = 'openclaw' as const;

  constructor(private readonly config: OpenClawAdapterConfig) {}

  normalizeEvent(
    envelope: OpenClawRawEventEnvelope,
    context?: NormalizeOpenClawEventContext,
  ): RuntimeEvent | RuntimeEvent[] | null {
    return this.config.normalizer.normalize(envelope, context);
  }
}

export function createOpenClawAdapter(config: OpenClawAdapterConfig): OpenClawAdapter {
  return new DefaultOpenClawAdapter(config);
}
