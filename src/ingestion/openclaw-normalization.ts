import type {
  OpenAIMetadata,
  RuntimeActorRef,
  RuntimeEnvelope,
  RuntimeEvent,
  RuntimeEventKind,
  RuntimeEventPayload,
  RuntimeEventSource,
} from '../contracts/runtime-events.js';
import type { RuntimeNormalizer, RuntimeNormalizerInput } from './types.js';

const FALLBACK_SOURCE: RuntimeEventSource = 'openclaw.runtime';

export class OpenClawRuntimeNormalizer implements RuntimeNormalizer {
  private fallbackEventCounter = 0;
  private readonly fallbackEntropy = Math.random().toString(36).slice(2, 10);

  normalize(input: RuntimeNormalizerInput): RuntimeEvent {
    if (isRuntimeEvent(input)) {
      return input;
    }

    const envelope = isEnvelope(input)
      ? input
      : {
          source: this.readSource(input),
          receivedAt: this.readTimestamp(input),
          event: input,
        } satisfies RuntimeEnvelope<Record<string, unknown>>;

    const raw = envelope.event;
    const status = readString(raw.status)?.toLowerCase();
    const phase = readString(raw.phase)?.toLowerCase();
    const level = readString(raw.level)?.toLowerCase();
    const kind = this.resolveKind(raw, status, phase, level);
    const sessionId = this.readSessionId(raw);
    const timestamp = this.readTimestamp(raw, envelope.receivedAt);

    return {
      id: this.readEventId(raw, sessionId, kind, timestamp),
      timestamp,
      sessionId,
      source: this.readSource(raw, envelope.source),
      kind,
      actor: this.readActor(raw),
      payload: this.readPayload(raw, kind, status),
      openai: this.readOpenAiMetadata(raw),
    };
  }

  private resolveKind(
    raw: Record<string, unknown>,
    status?: string,
    phase?: string,
    level?: string,
  ): RuntimeEventKind {
    const explicitType = readString(raw.type) ?? readString(raw.event) ?? readString(raw.kind);
    const normalizedType = explicitType?.toLowerCase();

    switch (normalizedType) {
      case 'session.started':
      case 'run.started':
        return 'session.started';
      case 'session.updated':
      case 'run.updated':
        return 'session.updated';
      case 'session.completed':
      case 'run.completed':
        return 'session.completed';
      case 'session.failed':
      case 'run.failed':
        return 'session.failed';
      case 'actor.spawned':
      case 'agent.spawned':
        return 'actor.spawned';
      case 'actor.updated':
      case 'agent.updated':
        return 'actor.updated';
      case 'actor.removed':
      case 'agent.removed':
        return 'actor.removed';
      case 'task.started':
        return 'task.started';
      case 'task.progressed':
      case 'task.updated':
        return 'task.progressed';
      case 'task.completed':
        return 'task.completed';
      case 'task.failed':
        return 'task.failed';
      case 'tool.started':
      case 'tool.invoked':
        return 'tool.started';
      case 'tool.progressed':
      case 'tool.updated':
        return 'tool.progressed';
      case 'tool.completed':
        return 'tool.completed';
      case 'tool.failed':
        return 'tool.failed';
      case 'message.sent':
        return 'message.sent';
      case 'message.received':
        return 'message.received';
      case 'artifact.created':
        return 'artifact.created';
      case 'artifact.updated':
        return 'artifact.updated';
      case 'model.response.created':
      case 'response.created':
        return 'model.response.created';
      case 'model.response.delta':
      case 'response.delta':
        return 'model.response.delta';
      case 'model.response.completed':
      case 'response.completed':
        return 'model.response.completed';
      case 'response.failed':
        return 'error';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        break;
    }

    if (readObject(raw.tool) || readObject(raw.toolCall) || readObject(raw.tool_call)) {
      if (status === 'completed' || phase === 'completed') return 'tool.completed';
      if (status === 'failed' || phase === 'failed') return 'tool.failed';
      if (status === 'running' || status === 'in_progress' || phase === 'streaming') return 'tool.progressed';
      return 'tool.started';
    }

    if (readObject(raw.task)) {
      if (status === 'completed') return 'task.completed';
      if (status === 'failed') return 'task.failed';
      if (status === 'running' || status === 'in_progress') return 'task.progressed';
      return 'task.started';
    }

    if (readObject(raw.message)) {
      return 'message.sent';
    }

    if (readObject(raw.response) || raw.response_id || raw.responseId) {
      if (phase === 'delta' || phase === 'streaming') return 'model.response.delta';
      if (status === 'completed') return 'model.response.completed';
      if (status === 'failed') return 'error';
      return 'model.response.created';
    }

    if (level === 'error' || status === 'failed') return 'error';
    if (level === 'warn' || level === 'warning') return 'warning';

    return 'session.updated';
  }

  private readEventId(raw: Record<string, unknown>, sessionId: string, kind: RuntimeEventKind, timestamp: string): string {
    const explicitId = readString(raw.id) ?? readString(raw.eventId) ?? readString(raw.event_id);
    if (explicitId) return explicitId;

    this.fallbackEventCounter += 1;
    return `${sessionId}:${kind}:${timestamp}:${this.fallbackEntropy}:${this.fallbackEventCounter.toString(36)}`;
  }

  private readSessionId(raw: Record<string, unknown>): string {
    return (
      readString(raw.sessionId) ??
      readString(raw.session_id) ??
      readString(raw.runId) ??
      readString(raw.run_id) ??
      readString(raw.workflowId) ??
      'unknown-session'
    );
  }

  private readSource(raw: Record<string, unknown>, fallback?: RuntimeEventSource): RuntimeEventSource {
    return (
      readString(raw.source) ??
      readString(raw.emitter) ??
      readString(raw.origin) ??
      fallback ??
      FALLBACK_SOURCE
    );
  }

  private readTimestamp(raw: Record<string, unknown>, fallback?: string): string {
    return (
      readString(raw.timestamp) ??
      readString(raw.createdAt) ??
      readString(raw.created_at) ??
      readString(raw.occurredAt) ??
      readString(raw.occurred_at) ??
      fallback ??
      new Date().toISOString()
    );
  }

  private readActor(raw: Record<string, unknown>): RuntimeActorRef | undefined {
    const actor = readObject(raw.actor) ?? readObject(raw.agent) ?? readObject(raw.worker);
    if (!actor) return undefined;

    const id = readString(actor.id) ?? readString(actor.actorId) ?? readString(actor.actor_id);
    if (!id) return undefined;

    return {
      id,
      name: readString(actor.name) ?? readString(actor.label) ?? id,
      role: readString(actor.role),
      kind: readString(actor.kind) as RuntimeActorRef['kind'] | undefined,
    };
  }

  private readPayload(
    raw: Record<string, unknown>,
    kind: RuntimeEventKind,
    status?: string,
  ): RuntimeEventPayload {
    switch (kind) {
      case 'session.started':
      case 'session.updated':
      case 'session.completed':
      case 'session.failed':
        return {
          status: mapSessionStatus(kind, status),
          title: readString(raw.title) ?? readString(raw.name),
          goal: readString(raw.goal) ?? readString(raw.summary),
        };

      case 'actor.spawned':
      case 'actor.updated':
      case 'actor.removed':
        return {
          status: kind === 'actor.spawned' ? 'spawned' : kind === 'actor.removed' ? 'removed' : 'updated',
          summary: readString(raw.summary),
        };

      case 'task.started':
      case 'task.progressed':
      case 'task.completed':
      case 'task.failed': {
        const task = readObject(raw.task) ?? raw;
        return {
          taskId: readString(task.id) ?? readString(task.taskId) ?? readString(task.task_id) ?? 'unknown-task',
          title: readString(task.title) ?? readString(task.name) ?? 'Untitled task',
          status: mapTaskStatus(kind, status),
          parentTaskId: readString(task.parentTaskId) ?? readString(task.parent_task_id),
          progress: readNumber(task.progress),
          summary: readString(task.summary) ?? readString(raw.summary),
        };
      }

      case 'tool.started':
      case 'tool.progressed':
      case 'tool.completed':
      case 'tool.failed': {
        const tool = readObject(raw.tool) ?? readObject(raw.toolCall) ?? readObject(raw.tool_call) ?? {};
        return {
          tool: {
            name: readString(tool.name) ?? readString(tool.toolName) ?? readString(tool.tool_name) ?? 'unknown-tool',
            invocationId:
              readString(tool.invocationId) ?? readString(tool.invocation_id) ?? readString(tool.callId) ?? undefined,
            displayName: readString(tool.displayName) ?? readString(tool.label) ?? undefined,
          },
          inputSummary: readString(raw.inputSummary) ?? readString(raw.input) ?? readString(tool.inputSummary),
          outputSummary: readString(raw.outputSummary) ?? readString(raw.output) ?? readString(tool.outputSummary),
          status: mapToolStatus(kind, status),
        };
      }

      case 'message.sent':
      case 'message.received': {
        const message = readObject(raw.message) ?? raw;
        return {
          messageId: readString(message.id) ?? readString(message.messageId) ?? readString(message.message_id) ?? 'unknown-message',
          fromActorId: readString(message.fromActorId) ?? readString(message.from_actor_id),
          toActorId: readString(message.toActorId) ?? readString(message.to_actor_id),
          summary: readString(message.summary) ?? readString(message.text) ?? 'Message exchange',
        };
      }

      case 'artifact.created':
      case 'artifact.updated': {
        const artifact = readObject(raw.artifact) ?? raw;
        return {
          artifact: {
            id: readString(artifact.id) ?? readString(artifact.artifactId) ?? 'unknown-artifact',
            type: readString(artifact.type) ?? 'unknown',
            name: readString(artifact.name),
            uri: readString(artifact.uri) ?? readString(artifact.path),
          },
          summary: readString(raw.summary),
        };
      }

      case 'model.response.created':
      case 'model.response.delta':
      case 'model.response.completed': {
        const response = readObject(raw.response) ?? raw;
        return {
          responseId: readString(response.id) ?? readString(response.responseId) ?? readString(raw.response_id),
          status: mapModelStatus(kind),
          summary: readString(raw.summary) ?? readString(response.summary) ?? readString(response.output_text),
        };
      }

      case 'warning':
      case 'error':
        return {
          code: readString(raw.code),
          message: readString(raw.message) ?? readString(raw.summary) ?? 'Runtime issue',
          retryable: readBoolean(raw.retryable),
        };
    }
  }

  private readOpenAiMetadata(raw: Record<string, unknown>): OpenAIMetadata | undefined {
    const openai = readObject(raw.openai) ?? readObject(raw.model) ?? readObject(raw.response);
    if (!openai && !raw.response_id && !raw.model) {
      return undefined;
    }

    const usage = readObject(openai?.usage);

    return {
      provider: 'openai',
      model: readString(openai?.model) ?? readString(raw.model),
      responseId: readString(openai?.responseId) ?? readString(openai?.id) ?? readString(raw.response_id),
      requestId: readString(openai?.requestId) ?? readString(raw.request_id),
      conversationId: readString(openai?.conversationId) ?? readString(raw.conversation_id),
      usage: usage
        ? {
            inputTokens: readNumber(usage.inputTokens) ?? readNumber(usage.input_tokens),
            outputTokens: readNumber(usage.outputTokens) ?? readNumber(usage.output_tokens),
            totalTokens: readNumber(usage.totalTokens) ?? readNumber(usage.total_tokens),
          }
        : undefined,
      finishReason: readString(openai?.finishReason) ?? readString(openai?.finish_reason),
    };
  }
}

function mapSessionStatus(kind: RuntimeEventKind, status?: string): 'started' | 'running' | 'completed' | 'failed' {
  if (kind === 'session.started') return 'started';
  if (kind === 'session.completed') return 'completed';
  if (kind === 'session.failed') return 'failed';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'running';
}

function mapTaskStatus(kind: RuntimeEventKind, status?: string): 'started' | 'in_progress' | 'completed' | 'failed' {
  if (kind === 'task.started') return 'started';
  if (kind === 'task.completed') return 'completed';
  if (kind === 'task.failed') return 'failed';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'in_progress';
}

function mapToolStatus(kind: RuntimeEventKind, status?: string): 'started' | 'in_progress' | 'completed' | 'failed' {
  if (kind === 'tool.started') return 'started';
  if (kind === 'tool.completed') return 'completed';
  if (kind === 'tool.failed') return 'failed';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'in_progress';
}

function mapModelStatus(kind: RuntimeEventKind): 'created' | 'streaming' | 'completed' {
  if (kind === 'model.response.completed') return 'completed';
  if (kind === 'model.response.delta') return 'streaming';
  return 'created';
}

function isRuntimeEvent(input: RuntimeNormalizerInput): input is RuntimeEvent {
  return typeof input === 'object' && input !== null && 'kind' in input && 'payload' in input && 'sessionId' in input;
}

function isEnvelope(input: RuntimeNormalizerInput): input is RuntimeEnvelope<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && 'event' in input && 'receivedAt' in input && 'source' in input;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
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
