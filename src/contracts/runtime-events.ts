export type RuntimeEventSource =
  | 'openclaw.runtime'
  | 'openclaw.gateway'
  | 'openclaw.tooling'
  | 'openai.responses'
  | 'openai.chat.completions'
  | 'system'
  | (string & {});

export type RuntimeEventKind =
  | 'session.started'
  | 'session.updated'
  | 'session.completed'
  | 'session.failed'
  | 'actor.spawned'
  | 'actor.updated'
  | 'actor.removed'
  | 'task.started'
  | 'task.progressed'
  | 'task.completed'
  | 'task.failed'
  | 'tool.started'
  | 'tool.progressed'
  | 'tool.completed'
  | 'tool.failed'
  | 'message.sent'
  | 'message.received'
  | 'artifact.created'
  | 'artifact.updated'
  | 'model.response.created'
  | 'model.response.delta'
  | 'model.response.completed'
  | 'warning'
  | 'error';

export interface RuntimeActorRef {
  id: string;
  name: string;
  role?: string;
  kind?: 'agent' | 'user' | 'system' | 'tool' | (string & {});
}

export interface RuntimeToolRef {
  name: string;
  invocationId?: string;
  displayName?: string;
}

export interface RuntimeArtifactRef {
  id: string;
  type: string;
  name?: string;
  uri?: string;
}

export interface OpenAIMetadata {
  provider: 'openai';
  model?: string;
  responseId?: string;
  requestId?: string;
  conversationId?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

export interface RuntimeEventBase {
  id: string;
  timestamp: string;
  sessionId: string;
  source: RuntimeEventSource;
  actor?: RuntimeActorRef;
  openai?: OpenAIMetadata;
}

export interface SessionLifecyclePayload {
  status: 'started' | 'running' | 'completed' | 'failed';
  title?: string;
  goal?: string;
}

export interface ActorLifecyclePayload {
  status: 'spawned' | 'updated' | 'removed';
  summary?: string;
}

export interface TaskLifecyclePayload {
  taskId: string;
  title: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  parentTaskId?: string;
  progress?: number;
  summary?: string;
}

export interface ToolLifecyclePayload {
  tool: RuntimeToolRef;
  inputSummary?: string;
  outputSummary?: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
}

export interface MessagePayload {
  messageId: string;
  fromActorId?: string;
  toActorId?: string;
  summary: string;
}

export interface ArtifactPayload {
  artifact: RuntimeArtifactRef;
  summary?: string;
}

export interface ModelResponsePayload {
  responseId?: string;
  status: 'created' | 'streaming' | 'completed';
  summary?: string;
}

export interface ErrorPayload {
  code?: string;
  message: string;
  retryable?: boolean;
}

export interface RuntimeEventPayloadByKind {
  'session.started': SessionLifecyclePayload;
  'session.updated': SessionLifecyclePayload;
  'session.completed': SessionLifecyclePayload;
  'session.failed': SessionLifecyclePayload;
  'actor.spawned': ActorLifecyclePayload;
  'actor.updated': ActorLifecyclePayload;
  'actor.removed': ActorLifecyclePayload;
  'task.started': TaskLifecyclePayload;
  'task.progressed': TaskLifecyclePayload;
  'task.completed': TaskLifecyclePayload;
  'task.failed': TaskLifecyclePayload;
  'tool.started': ToolLifecyclePayload;
  'tool.progressed': ToolLifecyclePayload;
  'tool.completed': ToolLifecyclePayload;
  'tool.failed': ToolLifecyclePayload;
  'message.sent': MessagePayload;
  'message.received': MessagePayload;
  'artifact.created': ArtifactPayload;
  'artifact.updated': ArtifactPayload;
  'model.response.created': ModelResponsePayload;
  'model.response.delta': ModelResponsePayload;
  'model.response.completed': ModelResponsePayload;
  warning: ErrorPayload;
  error: ErrorPayload;
}

export type RuntimeEventPayload = RuntimeEventPayloadByKind[RuntimeEventKind];

export interface RuntimeEvent<TKind extends RuntimeEventKind = RuntimeEventKind> extends RuntimeEventBase {
  kind: TKind;
  payload: RuntimeEventPayloadByKind[TKind];
}

export interface RuntimeEnvelope<TEvent = unknown> {
  source: RuntimeEventSource;
  receivedAt: string;
  event: TEvent;
  metadata?: Record<string, unknown>;
}
