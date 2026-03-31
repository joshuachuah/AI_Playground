import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { SceneZone, VisualEvent } from '../contracts/visual-events.js';

export interface TranslationContext {
  zoneByToolName?: Record<string, SceneZone>;
}

export interface RuntimeToVisualTranslator {
  translate(event: RuntimeEvent): VisualEvent[];
}

const DEFAULT_ZONE_BY_TOOL_NAME: Record<string, SceneZone> = {
  web_search: 'research',
  web_fetch: 'research',
  read: 'files',
  write: 'files',
  edit: 'files',
  exec: 'coding',
};

const FILE_MODIFYING_TOOLS = new Set(['write', 'edit']);

function mapToolActivity(zone: SceneZone, toolName?: string) {
  if (zone === 'coding') return 'coding' as const;
  if (zone === 'research') return 'researching' as const;
  if (zone === 'files' && toolName && FILE_MODIFYING_TOOLS.has(toolName)) return 'coding' as const;
  return 'reading' as const;
}

export class OpenClawRuntimeTranslator implements RuntimeToVisualTranslator {
  private readonly zoneByToolName: Record<string, SceneZone>;

  constructor(context: TranslationContext = {}) {
    this.zoneByToolName = {
      ...DEFAULT_ZONE_BY_TOOL_NAME,
      ...context.zoneByToolName,
    };
  }

  translate(event: RuntimeEvent): VisualEvent[] {
    switch (event.kind) {
      case 'session.started':
      case 'session.updated':
      case 'session.completed':
      case 'session.failed':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'session.summary.updated',
            summary: readSessionSummary(event),
            ui: {
              detail: readSessionDetail(event),
              severity: event.kind === 'session.failed' ? 'error' : 'info',
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'actor.spawned':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.spawned',
            summary: `${event.actor?.name ?? 'Actor'} joined the session`,
            scene: {
              target: { zone: 'spawn' },
              activity: 'idle',
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'task.started':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.activity.changed',
            summary: `${event.actor?.name ?? 'Actor'} started ${readTaskTitle(event)}`,
            scene: {
              target: { zone: inferTaskZone(readTaskTitle(event)) },
              activity: inferTaskActivity(readTaskTitle(event)),
            },
            ui: {
              detail: readTaskSummary(event),
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'task.progressed':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.activity.changed',
            summary: `${event.actor?.name ?? 'Actor'} is working on ${readTaskTitle(event)}`,
            scene: {
              target: { zone: inferTaskZone(readTaskTitle(event)) },
              activity: inferTaskActivity(readTaskTitle(event)),
            },
            ui: {
              detail: readTaskProgressDetail(event),
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'tool.started': {
        const toolName = this.readToolName(event);
        const zone = toolName ? this.zoneByToolName[toolName] ?? 'coordination' : 'coordination';

        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.tool.started',
            summary: `${event.actor?.name ?? 'Actor'} started ${toolName ?? 'a tool'}`,
            scene: {
              target: { zone },
              activity: mapToolActivity(zone, toolName),
            },
            ui: {
              label: toolName,
              detail: `Tool execution started from ${event.source}`,
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

      case 'tool.completed': {
        const toolName = this.readToolName(event);
        const zone = toolName ? this.zoneByToolName[toolName] ?? 'coordination' : 'coordination';

        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.tool.completed',
            summary: `${event.actor?.name ?? 'Actor'} completed ${toolName ?? 'a tool'}`,
            scene: {
              target: { zone },
              activity: 'idle',
            },
            ui: {
              label: toolName,
              detail: readToolOutputSummary(event),
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

      case 'tool.failed': {
        const toolName = this.readToolName(event);

        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.error',
            summary: `${event.actor?.name ?? 'Actor'} failed ${toolName ?? 'a tool'}`,
            scene: {
              activity: 'error',
            },
            ui: {
              label: toolName,
              severity: 'error',
              detail: readToolOutputSummary(event),
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

      case 'message.sent':
      case 'message.received':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.handoff',
            summary: readMessageSummary(event),
            scene: {
              target: { zone: 'coordination' },
              activity: 'handoff',
            },
            ui: {
              detail: readMessageDetail(event),
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'artifact.created':
      case 'artifact.updated':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'artifact.created',
            summary: readArtifactSummary(event),
            scene: {
              target: { zone: 'files' },
              activity: 'reading',
            },
            ui: {
              label: readArtifactName(event),
              detail: readArtifactDetail(event),
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'task.completed':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.activity.changed',
            summary: `${event.actor?.name ?? 'Actor'} completed a task`,
            scene: {
              target: { zone: 'idle' },
              activity: 'success',
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'warning':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'session.summary.updated',
            summary: readWarningSummary(event),
            ui: {
              severity: 'warning',
              detail: readWarningDetail(event),
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      case 'task.failed':
      case 'error':
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.error',
            summary: `${event.actor?.name ?? 'Actor'} hit an error`,
            scene: {
              activity: 'error',
            },
            ui: {
              severity: 'error',
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];

      default:
        return [];
    }
  }

  private readToolName(event: RuntimeEvent): string | undefined {
    const maybeTool = event.payload as { tool?: { name?: string } };
    return maybeTool.tool?.name;
  }
}

function readSessionSummary(event: RuntimeEvent): string {
  const payload = event.payload as { title?: string; status?: string };
  const title = payload.title ?? 'Session';
  const status = payload.status ?? readStatusFromKind(event.kind);
  return `${title} ${status}`;
}

function readSessionDetail(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { goal?: string };
  return payload.goal;
}

function readTaskTitle(event: RuntimeEvent): string {
  const payload = event.payload as { title?: string; taskId?: string };
  return payload.title ?? payload.taskId ?? 'a task';
}

function readTaskSummary(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { summary?: string };
  return payload.summary;
}

function readTaskProgressDetail(event: RuntimeEvent): string {
  const payload = event.payload as { summary?: string; progress?: number };
  if (typeof payload.progress === 'number') {
    return payload.summary ? `${payload.summary} (${payload.progress}%)` : `${payload.progress}% complete`;
  }

  return payload.summary ?? 'Task is in progress';
}

function inferTaskZone(title: string): SceneZone {
  const normalized = title.toLowerCase();
  if (normalized.includes('plan')) return 'planning';
  if (normalized.includes('research') || normalized.includes('search')) return 'research';
  if (normalized.includes('review') || normalized.includes('inspect')) return 'review';
  if (normalized.includes('file') || normalized.includes('artifact')) return 'files';
  if (normalized.includes('code') || normalized.includes('build') || normalized.includes('implement')) return 'coding';
  return 'coordination';
}

function inferTaskActivity(title: string) {
  const zone = inferTaskZone(title);
  if (zone === 'planning') return 'planning' as const;
  if (zone === 'research') return 'researching' as const;
  if (zone === 'coding') return 'coding' as const;
  if (zone === 'review') return 'reading' as const;
  if (zone === 'files') return 'reading' as const;
  return 'waiting' as const;
}

function readToolOutputSummary(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { outputSummary?: string; inputSummary?: string };
  return payload.outputSummary ?? payload.inputSummary;
}

function readMessageSummary(event: RuntimeEvent): string {
  const payload = event.payload as { summary?: string; toActorId?: string; fromActorId?: string };
  if (payload.summary) return payload.summary;
  if (event.kind === 'message.sent') return `${event.actor?.name ?? 'Actor'} sent a handoff`;
  return `${event.actor?.name ?? 'Actor'} received a handoff`;
}

function readMessageDetail(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { fromActorId?: string; toActorId?: string; messageId?: string };
  if (payload.fromActorId || payload.toActorId) {
    return `${payload.fromActorId ?? 'unknown'} -> ${payload.toActorId ?? 'unknown'}`;
  }

  return payload.messageId;
}

function readArtifactSummary(event: RuntimeEvent): string {
  const payload = event.payload as { summary?: string; artifact?: { name?: string; type?: string; id?: string } };
  if (payload.summary) return payload.summary;
  const artifactName = payload.artifact?.name ?? payload.artifact?.type ?? payload.artifact?.id ?? 'artifact';
  return `${event.actor?.name ?? 'Actor'} created ${artifactName}`;
}

function readArtifactName(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { artifact?: { name?: string; type?: string } };
  return payload.artifact?.name ?? payload.artifact?.type;
}

function readArtifactDetail(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { artifact?: { uri?: string; id?: string; type?: string } };
  return payload.artifact?.uri ?? payload.artifact?.id ?? payload.artifact?.type;
}

function readWarningSummary(event: RuntimeEvent): string {
  const payload = event.payload as { message?: string; code?: string };
  return payload.message ?? payload.code ?? 'Warning';
}

function readWarningDetail(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { code?: string };
  return payload.code;
}

function readStatusFromKind(kind: RuntimeEvent['kind']): string {
  if (kind.endsWith('.started')) return 'started';
  if (kind.endsWith('.completed')) return 'completed';
  if (kind.endsWith('.failed')) return 'failed';
  if (kind.endsWith('.updated')) return 'updated';
  return kind;
}
