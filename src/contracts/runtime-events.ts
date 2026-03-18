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
  kind: RuntimeEventKind;
  actor?: RuntimeActorRef;
  openai?: OpenAIMetadata;
}

export interface SessionLifecyclePayload {
  status: 'started' | 'running' | 'completed' | 'failed';
  title?: string;
  goal?: string;
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

export type RuntimeEventPayload =
  | SessionLifecyclePayload
  | TaskLifecyclePayload
  | ToolLifecyclePayload
  | MessagePayload
  | ArtifactPayload
  | ModelResponsePayload
  | ErrorPayload
  | Record<string, unknown>;

export interface RuntimeEvent<TPayload extends RuntimeEventPayload = RuntimeEventPayload>
  extends RuntimeEventBase {
  payload: TPayload;
}
