import type { ModelResponsePayload, RuntimeEvent, TaskLifecyclePayload, ToolLifecyclePayload } from '../contracts/runtime-events.js';
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

function mapToolActivity(zone: SceneZone, toolName: string): 'coding' | 'researching' | 'reading' {
  if (zone === 'coding') return 'coding';
  if (zone === 'research') return 'researching';
  if (zone === 'files' && FILE_MODIFYING_TOOLS.has(toolName)) return 'coding';
  return 'reading';
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
      case 'task.progressed': {
        const payload = event.payload as TaskLifecyclePayload;
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.activity.changed',
            summary: `${event.actor?.name ?? 'Actor'} is working on ${payload.title}`,
            scene: {
              target: { zone: 'planning' },
              activity: 'planning',
            },
            ui: {
              detail: payload.summary,
              badges: payload.progress !== undefined ? [`progress:${Math.round(payload.progress * 100)}%`] : undefined,
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

      case 'tool.started':
      case 'tool.progressed': {
        const payload = event.payload as ToolLifecyclePayload;
        const toolName = payload.tool.name;
        const zone = this.zoneByToolName[toolName] ?? 'coordination';

        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.tool.started',
            summary: `${event.actor?.name ?? 'Actor'} started ${toolName}`,
            scene: {
              target: { zone },
              activity: mapToolActivity(zone, toolName),
            },
            ui: {
              label: toolName,
              detail: payload.inputSummary ?? `Tool execution started from ${event.source}`,
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

      case 'tool.completed': {
        const payload = event.payload as ToolLifecyclePayload;
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.tool.completed',
            summary: `${event.actor?.name ?? 'Actor'} completed ${payload.tool.name}`,
            scene: {
              target: { zone: 'idle' },
              activity: 'success',
            },
            ui: {
              label: payload.tool.name,
              detail: payload.outputSummary,
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

      case 'tool.failed': {
        const payload = event.payload as ToolLifecyclePayload;
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'actor.error',
            summary: `${event.actor?.name ?? 'Actor'} failed ${payload.tool.name}`,
            scene: {
              activity: 'error',
            },
            ui: {
              label: payload.tool.name,
              detail: payload.outputSummary ?? payload.inputSummary,
              severity: 'error',
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

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

      case 'model.response.created':
      case 'model.response.delta':
      case 'model.response.completed': {
        const payload = event.payload as ModelResponsePayload;
        return [
          {
            id: `${event.id}:visual`,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            actorId: event.actor?.id,
            type: 'session.summary.updated',
            summary: `${event.actor?.name ?? 'Actor'} model response ${payload.status}`,
            ui: {
              label: event.openai?.model,
              detail: payload.summary,
              badges: event.openai?.usage?.totalTokens !== undefined ? [`tokens:${event.openai.usage.totalTokens}`] : undefined,
            },
            sourceRuntimeEventIds: [event.id],
          },
        ];
      }

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
}
