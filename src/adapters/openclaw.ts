import type { RuntimeEvent, RuntimeEventSource } from '../contracts/runtime-events.js';
import type { RuntimeEventKind, RuntimeEventPayloadByKind } from '../contracts/runtime-events.js';

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

const OPENCLAW_RUNTIME_EVENT_KINDS = new Set<RuntimeEventKind>([
  'session.started',
  'session.updated',
  'session.completed',
  'session.failed',
  'actor.spawned',
  'actor.updated',
  'actor.removed',
  'task.started',
  'task.progressed',
  'task.completed',
  'task.failed',
  'tool.started',
  'tool.progressed',
  'tool.completed',
  'tool.failed',
  'message.sent',
  'message.received',
  'artifact.created',
  'artifact.updated',
  'model.response.created',
  'model.response.delta',
  'model.response.completed',
  'warning',
  'error',
]);

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

export class DefaultOpenClawEventNormalizer implements OpenClawEventNormalizer {
  normalize(
    envelope: OpenClawRawEventEnvelope,
    context: NormalizeOpenClawEventContext = {},
  ): RuntimeEvent | RuntimeEvent[] | null {
    const kind = normalizeRuntimeEventKind(envelope.kind);
    if (!kind) return null;

    const payload = readRecord(envelope.payload);

    return {
      id: requireString(envelope.id, 'OpenClaw event id'),
      timestamp: readString(envelope.timestamp) ?? requireString(context.receivedAt, 'OpenClaw event timestamp'),
      sessionId:
        readString(envelope.sessionId) ??
        readString(payload?.sessionId) ??
        requireString(readString(readNestedRecord(payload, 'session')?.id), 'OpenClaw session id'),
      source: normalizeSource(envelope.source, context.defaultSource, kind),
      kind,
      actor: normalizeActor(envelope.actor ?? readNestedRecord(payload, 'actor')),
      openai: normalizeOpenAI(envelope.openai ?? readNestedRecord(payload, 'openai')),
      payload: normalizePayload(kind, envelope, payload),
    };
  }
}

export function createDefaultOpenClawEventNormalizer(): OpenClawEventNormalizer {
  return new DefaultOpenClawEventNormalizer();
}

export function createDefaultOpenClawAdapter(): OpenClawAdapter {
  return createOpenClawAdapter({
    normalizer: createDefaultOpenClawEventNormalizer(),
  });
}

function normalizeRuntimeEventKind(value: unknown): RuntimeEventKind | null {
  if (typeof value !== 'string') return null;
  return OPENCLAW_RUNTIME_EVENT_KINDS.has(value as RuntimeEventKind) ? (value as RuntimeEventKind) : null;
}

function normalizePayload<TKind extends RuntimeEventKind>(
  kind: TKind,
  envelope: OpenClawRawEventEnvelope,
  payload: Record<string, unknown> | null,
): RuntimeEventPayloadByKind[TKind] {
  switch (kind) {
    case 'session.started':
    case 'session.updated':
    case 'session.completed':
    case 'session.failed':
      return normalizeSessionPayload(kind, payload) as RuntimeEventPayloadByKind[TKind];

    case 'actor.spawned':
    case 'actor.updated':
    case 'actor.removed':
      return normalizeActorPayload(kind, payload) as RuntimeEventPayloadByKind[TKind];

    case 'task.started':
    case 'task.progressed':
    case 'task.completed':
    case 'task.failed':
      return normalizeTaskPayload(kind, envelope, payload) as RuntimeEventPayloadByKind[TKind];

    case 'tool.started':
    case 'tool.progressed':
    case 'tool.completed':
    case 'tool.failed':
      return normalizeToolPayload(kind, envelope, payload) as RuntimeEventPayloadByKind[TKind];

    case 'message.sent':
    case 'message.received':
      return normalizeMessagePayload(payload) as RuntimeEventPayloadByKind[TKind];

    case 'artifact.created':
    case 'artifact.updated':
      return normalizeArtifactPayload(envelope, payload) as RuntimeEventPayloadByKind[TKind];

    case 'model.response.created':
    case 'model.response.delta':
    case 'model.response.completed':
      return normalizeModelResponsePayload(kind, payload, envelope.openai) as RuntimeEventPayloadByKind[TKind];

    case 'warning':
    case 'error':
      return normalizeErrorPayload(payload) as RuntimeEventPayloadByKind[TKind];
  }
}

function normalizeSessionPayload(
  kind: 'session.started' | 'session.updated' | 'session.completed' | 'session.failed',
  payload: Record<string, unknown> | null,
) {
  return {
    status: readSessionStatus(payload?.status) ?? inferSessionStatus(kind),
    title: readString(payload?.title),
    goal: readString(payload?.goal),
  };
}

function normalizeActorPayload(
  kind: 'actor.spawned' | 'actor.updated' | 'actor.removed',
  payload: Record<string, unknown> | null,
) {
  return {
    status: readActorStatus(payload?.status) ?? inferActorStatus(kind),
    summary: readString(payload?.summary),
  };
}

function normalizeTaskPayload(
  kind: 'task.started' | 'task.progressed' | 'task.completed' | 'task.failed',
  envelope: OpenClawRawEventEnvelope,
  payload: Record<string, unknown> | null,
) {
  const task = readNestedRecord(payload, 'task') ?? readNestedRecord(envelope as Record<string, unknown>, 'task');
  const taskId =
    readString(payload?.taskId) ?? readString(payload?.id) ?? readString(task?.id) ?? fail('OpenClaw task id');
  const title =
    readString(payload?.title) ?? readString(task?.title) ?? readString(payload?.summary) ?? `Task ${taskId}`;

  return {
    taskId,
    title,
    status: readTaskStatus(payload?.status) ?? inferTaskStatus(kind),
    parentTaskId: readString(payload?.parentTaskId) ?? readString(task?.parentTaskId),
    progress: readNumber(payload?.progress),
    summary: readString(payload?.summary),
  };
}

function normalizeToolPayload(
  kind: 'tool.started' | 'tool.progressed' | 'tool.completed' | 'tool.failed',
  envelope: OpenClawRawEventEnvelope,
  payload: Record<string, unknown> | null,
) {
  const rawTool = readNestedRecord(payload, 'tool') ?? readRecord(envelope.tool);
  const name =
    readString(rawTool?.name) ?? readString(payload?.toolName) ?? readString(rawTool?.displayName) ?? fail('OpenClaw tool name');

  return {
    tool: {
      name,
      invocationId: readString(rawTool?.invocationId) ?? readString(payload?.invocationId),
      displayName: readString(rawTool?.displayName),
    },
    inputSummary: readString(payload?.inputSummary),
    outputSummary: readString(payload?.outputSummary),
    status: readToolStatus(payload?.status) ?? inferToolStatus(kind),
  };
}

function normalizeMessagePayload(payload: Record<string, unknown> | null) {
  const message = readNestedRecord(payload, 'message');
  const messageId =
    readString(payload?.messageId) ?? readString(payload?.id) ?? readString(message?.id) ?? fail('OpenClaw message id');

  return {
    messageId,
    fromActorId: readString(payload?.fromActorId) ?? readString(message?.fromActorId),
    toActorId: readString(payload?.toActorId) ?? readString(message?.toActorId),
    summary:
      readString(payload?.summary) ?? readString(payload?.text) ?? readString(message?.summary) ?? `Message ${messageId}`,
  };
}

function normalizeArtifactPayload(envelope: OpenClawRawEventEnvelope, payload: Record<string, unknown> | null) {
  const artifact = readNestedRecord(payload, 'artifact') ?? readRecord(envelope.artifact);
  const id = readString(artifact?.id) ?? readString(payload?.artifactId) ?? fail('OpenClaw artifact id');
  const type = readString(artifact?.type) ?? readString(payload?.type) ?? fail('OpenClaw artifact type');

  return {
    artifact: {
      id,
      type,
      name: readString(artifact?.name),
      uri: readString(artifact?.uri),
    },
    summary: readString(payload?.summary),
  };
}

function normalizeModelResponsePayload(
  kind: 'model.response.created' | 'model.response.delta' | 'model.response.completed',
  payload: Record<string, unknown> | null,
  openai: unknown,
) {
  const openaiRecord = readRecord(openai);
  return {
    responseId: readString(payload?.responseId) ?? readString(openaiRecord?.responseId),
    status: readModelResponseStatus(payload?.status) ?? inferModelResponseStatus(kind),
    summary: readString(payload?.summary),
  };
}

function normalizeErrorPayload(payload: Record<string, unknown> | null) {
  const message =
    readString(payload?.message) ?? readString(payload?.summary) ?? readString(payload?.detail) ?? fail('OpenClaw error message');

  return {
    code: readString(payload?.code),
    message,
    retryable: readBoolean(payload?.retryable),
  };
}

function normalizeActor(value: unknown) {
  const actor = readRecord(value);
  if (!actor) return undefined;

  const id = readString(actor.id);
  const name = readString(actor.name);
  if (!id || !name) return undefined;

  return {
    id,
    name,
    role: readString(actor.role),
    kind: readString(actor.kind),
  };
}

function normalizeOpenAI(value: unknown) {
  const openai = readRecord(value);
  if (!openai) return undefined;

  const usage = readNestedRecord(openai, 'usage');
  const metadata = {
    provider: 'openai' as const,
    model: readString(openai.model),
    responseId: readString(openai.responseId),
    requestId: readString(openai.requestId),
    conversationId: readString(openai.conversationId),
    usage:
      usage &&
      (readNumber(usage.inputTokens) !== undefined ||
        readNumber(usage.outputTokens) !== undefined ||
        readNumber(usage.totalTokens) !== undefined)
        ? {
            inputTokens: readNumber(usage.inputTokens),
            outputTokens: readNumber(usage.outputTokens),
            totalTokens: readNumber(usage.totalTokens),
          }
        : undefined,
    finishReason: readString(openai.finishReason),
  };

  const hasMetadata =
    metadata.model ||
    metadata.responseId ||
    metadata.requestId ||
    metadata.conversationId ||
    metadata.finishReason ||
    metadata.usage;

  return hasMetadata ? metadata : undefined;
}

function normalizeSource(
  source: unknown,
  defaultSource: RuntimeEventSource | undefined,
  kind: RuntimeEventKind,
): RuntimeEventSource {
  return readString(source) ?? defaultSource ?? inferSource(kind);
}

function inferSource(kind: RuntimeEventKind): RuntimeEventSource {
  if (kind.startsWith('tool.')) return 'openclaw.tooling';
  if (kind.startsWith('model.response.')) return 'openai.responses';
  if (kind === 'warning' || kind === 'error') return 'system';
  return 'openclaw.runtime';
}

function inferSessionStatus(kind: RuntimeEventKind) {
  switch (kind) {
    case 'session.started':
      return 'started' as const;
    case 'session.updated':
      return 'running' as const;
    case 'session.completed':
      return 'completed' as const;
    case 'session.failed':
      return 'failed' as const;
    default:
      return 'running' as const;
  }
}

function inferActorStatus(kind: RuntimeEventKind) {
  switch (kind) {
    case 'actor.spawned':
      return 'spawned' as const;
    case 'actor.updated':
      return 'updated' as const;
    case 'actor.removed':
      return 'removed' as const;
    default:
      return 'updated' as const;
  }
}

function inferTaskStatus(kind: RuntimeEventKind) {
  switch (kind) {
    case 'task.started':
      return 'started' as const;
    case 'task.progressed':
      return 'in_progress' as const;
    case 'task.completed':
      return 'completed' as const;
    case 'task.failed':
      return 'failed' as const;
    default:
      return 'in_progress' as const;
  }
}

function inferToolStatus(kind: RuntimeEventKind) {
  switch (kind) {
    case 'tool.started':
      return 'started' as const;
    case 'tool.progressed':
      return 'in_progress' as const;
    case 'tool.completed':
      return 'completed' as const;
    case 'tool.failed':
      return 'failed' as const;
    default:
      return 'in_progress' as const;
  }
}

function inferModelResponseStatus(kind: RuntimeEventKind) {
  switch (kind) {
    case 'model.response.created':
      return 'created' as const;
    case 'model.response.delta':
      return 'streaming' as const;
    case 'model.response.completed':
      return 'completed' as const;
    default:
      return 'streaming' as const;
  }
}

function readSessionStatus(value: unknown) {
  return value === 'started' || value === 'running' || value === 'completed' || value === 'failed' ? value : undefined;
}

function readActorStatus(value: unknown) {
  return value === 'spawned' || value === 'updated' || value === 'removed' ? value : undefined;
}

function readTaskStatus(value: unknown) {
  return value === 'started' || value === 'in_progress' || value === 'completed' || value === 'failed' ? value : undefined;
}

function readToolStatus(value: unknown) {
  return value === 'started' || value === 'in_progress' || value === 'completed' || value === 'failed' ? value : undefined;
}

function readModelResponseStatus(value: unknown) {
  return value === 'created' || value === 'streaming' || value === 'completed' ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readNestedRecord(source: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  if (!source) return null;
  return readRecord(source[key]);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function requireString(value: string | undefined, label: string): string {
  if (value) return value;
  throw new Error(`Missing ${label}`);
}

function fail(label: string): never {
  throw new Error(`Missing ${label}`);
}
