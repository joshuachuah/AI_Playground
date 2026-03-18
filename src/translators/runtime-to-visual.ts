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
