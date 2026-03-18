export type SceneZone =
  | 'spawn'
  | 'planning'
  | 'research'
  | 'coding'
  | 'files'
  | 'review'
  | 'coordination'
  | 'idle';

export type ActorActivityState =
  | 'idle'
  | 'walking'
  | 'planning'
  | 'researching'
  | 'coding'
  | 'reading'
  | 'waiting'
  | 'handoff'
  | 'success'
  | 'error';

export type VisualEventType =
  | 'actor.spawned'
  | 'actor.moved'
  | 'actor.activity.changed'
  | 'actor.tool.started'
  | 'actor.tool.completed'
  | 'actor.handoff'
  | 'artifact.created'
  | 'session.summary.updated'
  | 'actor.error';

export interface VisualSceneTarget {
  zone: SceneZone;
  waypointId?: string;
}

export interface VisualUiMetadata {
  label?: string;
  detail?: string;
  severity?: 'info' | 'warning' | 'error';
  badges?: string[];
}

export interface VisualEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  actorId?: string;
  type: VisualEventType;
  summary: string;
  scene?: {
    target?: VisualSceneTarget;
    activity?: ActorActivityState;
  };
  ui?: VisualUiMetadata;
  sourceRuntimeEventIds: string[];
}
