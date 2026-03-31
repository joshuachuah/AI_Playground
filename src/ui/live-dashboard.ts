import { bootLiveClientApp } from '../app/boot.js';
import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { VisualEvent } from '../contracts/visual-events.js';
import type {
  RuntimeVisualActorProjection,
  RuntimeVisualSessionProjection,
  RuntimeVisualState,
} from '../state/runtime-visual-store.js';
import { createRuntimeVisualActorKey } from '../state/runtime-visual-store.js';
import { createBrowserOpenClawDevTransport, describeOpenClawDevConnection } from '../dev/openclaw-dev-transport.js';
import { readOpenClawDevConnectionConfig, type OpenClawDevConnectionConfig } from '../dev/openclaw-dev-config.js';

const TIMELINE_LIMIT = 12;

type ActorSortKey = 'updated' | 'name' | 'activity';
type TimelineFilterKind = 'all' | 'tasks' | 'tools' | 'messages' | 'artifacts' | 'system';

declare global {
  interface Window {
    __AI_PLAYGROUND_OPENCLAW__?: OpenClawDevConnectionConfig;
  }
}

interface LiveDashboardUiState {
  selectedSessionId?: string;
  selectedActorKey?: string;
  selectedRuntimeEventId?: string;
  actorFilterText: string;
  actorSort: ActorSortKey;
  timelineFilter: TimelineFilterKind;
}

interface LiveDashboardSelection {
  sessions: RuntimeVisualSessionProjection[];
  selectedSession?: RuntimeVisualSessionProjection;
  actors: RuntimeVisualActorProjection[];
  selectedActor?: RuntimeVisualActorProjection;
  timelineEvents: RuntimeEvent[];
  selectedRuntimeEvent?: RuntimeEvent;
  selectedVisualEvent?: VisualEvent;
  currentStateSummary: CurrentStateSummary;
}

interface CurrentStateSummary {
  visibleActors: number;
  activeTasks: number;
  activeTools: number;
  actorsWithErrors: number;
  dominantActivity: string;
}

export async function mountLiveDashboard(
  root: HTMLElement,
  config: OpenClawDevConnectionConfig = readBrowserOpenClawDevConnectionConfig(),
): Promise<() => Promise<void>> {
  root.innerHTML = renderShell();

  const uiState: LiveDashboardUiState = {
    actorFilterText: '',
    actorSort: 'updated',
    timelineFilter: 'all',
  };

  setText(root, '[data-slot="connection-source"]', describeOpenClawDevConnection(config));

  let latestState: Readonly<RuntimeVisualState> | undefined;

  bindDashboardControls(root, uiState, () => {
    if (latestState) {
      renderState(root, latestState, uiState);
    }
  });

  const transport = createBrowserOpenClawDevTransport(config);
  const app = bootLiveClientApp({ transport });
  const unsubscribe = app.store.subscribe((state) => {
    latestState = state;
    renderState(root, state, uiState);
  });

  await app.start();

  return async () => {
    unsubscribe();
    await app.stop();
  };
}

export async function mountLocalLiveDashboard(root: HTMLElement): Promise<() => Promise<void>> {
  return mountLiveDashboard(root);
}

function renderState(root: HTMLElement, state: Readonly<RuntimeVisualState>, uiState: LiveDashboardUiState): void {
  const selection = selectDashboardState(state, uiState);
  syncDashboardControls(root, selection, uiState);

  setText(root, '[data-slot="connection-status"]', state.connectionStatus);
  setText(root, '[data-slot="runtime-count"]', String(state.runtimeEvents.length));
  setText(root, '[data-slot="visual-count"]', String(state.visualEvents.length));
  setText(root, '[data-slot="session-count"]', String(selection.sessions.length));
  setText(root, '[data-slot="actor-count"]', String(selection.currentStateSummary.visibleActors));
  setText(root, '[data-slot="active-task-count"]', String(selection.currentStateSummary.activeTasks));
  setText(root, '[data-slot="active-tool-count"]', String(selection.currentStateSummary.activeTools));
  setText(root, '[data-slot="issue-count"]', String(selection.currentStateSummary.actorsWithErrors));
  setText(root, '[data-slot="warning-count"]', String(countWarnings(state.runtimeEvents)));
  setText(root, '[data-slot="error-count"]', String(countErrors(state.runtimeEvents)));
  setText(root, '[data-slot="last-error"]', state.lastError ?? 'none');
  setText(root, '[data-slot="dominant-activity"]', selection.currentStateSummary.dominantActivity);
  setText(root, '[data-slot="actor-focus-state"]', describeActorFocus(selection.selectedActor));
  setText(root, '[data-slot="event-focus-state"]', describeEventFocus(selection.selectedRuntimeEvent));

  setHtml(root, '[data-slot="session-rail"]', renderSessionRail(selection.sessions, selection.selectedSession?.id));
  setHtml(root, '[data-slot="session-summary"]', renderSessionSummary(selection.selectedSession));
  setHtml(root, '[data-slot="selected-actor"]', renderSelectedActor(selection.selectedActor));
  setHtml(root, '[data-slot="actor-cards"]', renderActorCards(selection.actors, selection.selectedActor?.id));
  setHtml(
    root,
    '[data-slot="state-summary"]',
    renderCurrentStateSummary(selection.currentStateSummary, selection.selectedSession),
  );
  setHtml(
    root,
    '[data-slot="timeline"]',
    renderTimeline(selection.timelineEvents, selection.selectedRuntimeEvent?.id),
  );
  setHtml(
    root,
    '[data-slot="inspector-summary"]',
    renderInspectorSummary(selection.selectedRuntimeEvent, selection.selectedVisualEvent),
  );

  setText(root, '[data-slot="focused-runtime-kind"]', selection.selectedRuntimeEvent?.kind ?? 'none');
  setText(root, '[data-slot="focused-runtime-source"]', selection.selectedRuntimeEvent?.source ?? 'none');
  setText(root, '[data-slot="focused-runtime-actor"]', selection.selectedRuntimeEvent?.actor?.name ?? 'none');
  setText(root, '[data-slot="focused-visual-type"]', selection.selectedVisualEvent?.type ?? 'none');
  setText(root, '[data-slot="focused-visual-summary"]', selection.selectedVisualEvent?.summary ?? 'none');
  setText(
    root,
    '[data-slot="focused-session"]',
    selection.selectedSession?.id ?? selection.selectedRuntimeEvent?.sessionId ?? 'none',
  );
  setHtml(root, '[data-slot="focused-payload"]', renderJson(selection.selectedRuntimeEvent?.payload ?? null));
  setHtml(
    root,
    '[data-slot="focused-visual"]',
    renderJson(
      selection.selectedVisualEvent
        ? {
            type: selection.selectedVisualEvent.type,
            summary: selection.selectedVisualEvent.summary,
            scene: selection.selectedVisualEvent.scene,
            ui: selection.selectedVisualEvent.ui,
            sourceRuntimeEventIds: selection.selectedVisualEvent.sourceRuntimeEventIds,
          }
        : null,
    ),
  );

  const statusBadge = root.querySelector<HTMLElement>('[data-slot="connection-badge"]');
  if (statusBadge) {
    statusBadge.dataset.status = state.connectionStatus;
  }

  setDisabled(root, '[data-action="clear-actor-focus"]', !selection.selectedActor);
  setDisabled(root, '[data-action="clear-event-focus"]', !selection.selectedRuntimeEvent);
}

function renderShell(): string {
  return `
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">AI_Playground · local live dashboard</p>
          <h1>Truthful runtime observability</h1>
          <p class="subtle">Current state first, event evidence second.</p>
          <p class="subtle" data-slot="connection-source">fixture sample stream</p>
        </div>
        <div class="status-card">
          <span class="badge" data-slot="connection-badge" data-status="idle"></span>
          <div>
            <div class="label">Connection</div>
            <div class="value" data-slot="connection-status">idle</div>
          </div>
        </div>
      </header>

      <section class="grid stats-grid">
        <article class="panel stat-panel"><div class="label">Runtime events</div><div class="value" data-slot="runtime-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Visual events</div><div class="value" data-slot="visual-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Sessions</div><div class="value" data-slot="session-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Visible actors</div><div class="value" data-slot="actor-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Active tasks</div><div class="value" data-slot="active-task-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Active tools</div><div class="value" data-slot="active-tool-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Warnings</div><div class="value" data-slot="warning-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Errors</div><div class="value" data-slot="error-count">0</div></article>
      </section>

      <section class="grid controls-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Controls</h2>
            <span class="subtle">phase 2 complete</span>
          </div>
          <div class="control-grid">
            <label class="control-field">
              <span>Session</span>
              <select data-slot="session-select">
                <option value="">Latest active session</option>
              </select>
            </label>
            <label class="control-field">
              <span>Actor filter</span>
              <input data-slot="actor-filter" type="search" placeholder="Name, role, task, zone…" />
            </label>
            <label class="control-field">
              <span>Actor sort</span>
              <select data-slot="actor-sort">
                <option value="updated">Latest activity</option>
                <option value="name">Name</option>
                <option value="activity">Activity</option>
              </select>
            </label>
            <label class="control-field">
              <span>Timeline focus</span>
              <select data-slot="timeline-filter">
                <option value="all">All events</option>
                <option value="tasks">Task events</option>
                <option value="tools">Tool events</option>
                <option value="messages">Messages</option>
                <option value="artifacts">Artifacts</option>
                <option value="system">Warnings and errors</option>
              </select>
            </label>
          </div>
        </article>
      </section>

      <section class="grid session-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Sessions</h2>
            <span class="subtle">current runs</span>
          </div>
          <div class="session-rail" data-slot="session-rail"></div>
        </article>
      </section>

      <section class="grid hero-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Current state</h2>
            <span class="subtle" data-slot="dominant-activity">idle</span>
          </div>
          <div data-slot="state-summary"></div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <h2>Session snapshot</h2>
            <span class="subtle">derived state</span>
          </div>
          <div data-slot="session-summary"></div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <h2>Selected actor</h2>
            <div class="panel-actions">
              <span class="subtle" data-slot="actor-focus-state">session-wide view</span>
              <button type="button" class="action-button" data-action="clear-actor-focus">Clear focus</button>
            </div>
          </div>
          <div data-slot="selected-actor"></div>
        </article>
      </section>

      <section class="grid main-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Actors</h2>
            <span class="subtle">sorted live projections</span>
          </div>
          <div class="actor-grid" data-slot="actor-cards"></div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <h2>Timeline</h2>
            <span class="subtle">click an event to inspect</span>
          </div>
          <div class="timeline" data-slot="timeline"></div>
        </article>
      </section>

      <section class="grid inspector-grid-shell">
        <article class="panel">
          <div class="panel-header">
            <h2>Focused inspector</h2>
            <div class="panel-actions">
              <span class="subtle" data-slot="event-focus-state">timeline browsing</span>
              <button type="button" class="action-button" data-action="clear-event-focus">Clear focus</button>
            </div>
          </div>
          <p class="subtle" data-slot="focused-session">none</p>
          <div data-slot="inspector-summary"></div>
          <dl class="key-values">
            <div><dt>Runtime kind</dt><dd data-slot="focused-runtime-kind">none</dd></div>
            <div><dt>Runtime source</dt><dd data-slot="focused-runtime-source">none</dd></div>
            <div><dt>Actor</dt><dd data-slot="focused-runtime-actor">none</dd></div>
            <div><dt>Visual type</dt><dd data-slot="focused-visual-type">none</dd></div>
            <div><dt>Visual summary</dt><dd data-slot="focused-visual-summary">none</dd></div>
          </dl>
          <div class="inspector-grid">
            <div>
              <h3>Runtime payload</h3>
              <pre data-slot="focused-payload">null</pre>
            </div>
            <div>
              <h3>Visual projection</h3>
              <pre data-slot="focused-visual">null</pre>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <h2>Last error</h2>
          </div>
          <pre data-slot="last-error">none</pre>
        </article>
      </section>
    </div>
  `;
}

export function renderSessionSummary(session: RuntimeVisualSessionProjection | undefined): string {
  if (!session) {
    return '<p class="empty">Waiting for session state…</p>';
  }

  return `
    <dl class="key-values">
      <div><dt>Session</dt><dd>${escapeHtml(session.id)}</dd></div>
      <div><dt>Status</dt><dd>${escapeHtml(session.status ?? 'unknown')}</dd></div>
      <div><dt>Title</dt><dd>${escapeHtml(session.title ?? 'none')}</dd></div>
      <div><dt>Actors</dt><dd>${escapeHtml(String(session.actorIds.length))}</dd></div>
      <div><dt>Goal</dt><dd>${escapeHtml(session.goal ?? 'none')}</dd></div>
      <div><dt>Latest summary</dt><dd>${escapeHtml(session.latestSummary ?? 'none')}</dd></div>
    </dl>
  `;
}

export function renderSelectedActor(actor: RuntimeVisualActorProjection | undefined): string {
  if (!actor) {
    return '<p class="empty">Session-wide state view. Select an actor to inspect an individual projection.</p>';
  }

  return `
    <dl class="key-values">
      <div><dt>Name</dt><dd>${escapeHtml(actor.name)}</dd></div>
      <div><dt>Role</dt><dd>${escapeHtml(actor.role ?? 'none')}</dd></div>
      <div><dt>Kind</dt><dd>${escapeHtml(actor.kind ?? 'none')}</dd></div>
      <div><dt>Task</dt><dd>${escapeHtml(actor.currentTaskTitle ?? 'none')}</dd></div>
      <div><dt>Tool</dt><dd>${escapeHtml(actor.currentToolName ?? 'none')}</dd></div>
      <div><dt>Zone</dt><dd>${escapeHtml(actor.currentZone ?? 'none')}</dd></div>
      <div><dt>Activity</dt><dd>${escapeHtml(actor.currentActivity ?? 'none')}</dd></div>
      <div><dt>Last summary</dt><dd>${escapeHtml(actor.lastSummary ?? 'none')}</dd></div>
      <div><dt>Last error</dt><dd>${escapeHtml(actor.lastError ?? 'none')}</dd></div>
      <div><dt>Updated</dt><dd>${escapeHtml(formatTimestamp(actor.updatedAt))}</dd></div>
    </dl>
  `;
}

export function renderActorCards(
  actors: readonly RuntimeVisualActorProjection[],
  selectedActorId?: string,
): string {
  if (actors.length === 0) {
    return '<p class="empty">No actors match the current selection.</p>';
  }

  return actors
    .map((actor) => {
      const meta = [actor.role, actor.currentZone, actor.currentActivity].filter(Boolean).join(' · ');
      const selected = selectedActorId === actor.id;
      return `
        <article class="actor-card${selected ? ' is-selected' : ''}" data-actor-key="${escapeHtml(
          createRuntimeVisualActorKey(actor.sessionId, actor.id),
        )}" role="button" tabindex="0" aria-pressed="${selected ? 'true' : 'false'}">
          <div class="actor-top">
            <div>
              <div class="actor-name">${escapeHtml(actor.name)}</div>
              <div class="actor-meta">${escapeHtml(meta || actor.sessionId)}</div>
            </div>
            <div class="actor-status">${escapeHtml(actor.currentToolName ?? actor.currentTaskTitle ?? 'idle')}</div>
          </div>
          <div class="actor-detail">${escapeHtml(actor.lastSummary ?? 'No summary yet')}</div>
        </article>
      `;
    })
    .join('');
}

export function renderTimeline(events: readonly RuntimeEvent[], selectedRuntimeEventId?: string): string {
  if (events.length === 0) {
    return '<p class="empty">No runtime events match the current selection.</p>';
  }

  return events
    .slice(-TIMELINE_LIMIT)
    .reverse()
    .map((event) => {
      const actorName = event.actor?.name ?? 'unknown';
      const summary = readEventSummary(event);
      const selected = event.id === selectedRuntimeEventId;
      return `
        <article class="timeline-item${selected ? ' is-selected' : ''}" data-event-id="${escapeHtml(
          event.id,
        )}" role="button" tabindex="0" aria-pressed="${selected ? 'true' : 'false'}">
          <div class="timeline-meta">
            <span class="timeline-kind">${escapeHtml(event.kind)}</span>
            <span>${escapeHtml(formatTimestamp(event.timestamp))}</span>
          </div>
          <div class="timeline-main">${escapeHtml(actorName)} · ${escapeHtml(summary)}</div>
          <div class="timeline-subtle">${escapeHtml(event.source)} · ${escapeHtml(event.id)}</div>
        </article>
      `;
    })
    .join('');
}

export function renderSessionRail(
  sessions: readonly RuntimeVisualSessionProjection[],
  selectedSessionId?: string,
): string {
  if (sessions.length === 0) {
    return '<p class="empty">Waiting for sessions…</p>';
  }

  return sessions
    .map((session) => {
      const selected = session.id === selectedSessionId;
      return `
        <article class="session-chip${selected ? ' is-selected' : ''}" data-session-id="${escapeHtml(
          session.id,
        )}" role="button" tabindex="0" aria-pressed="${selected ? 'true' : 'false'}">
          <div class="session-chip-title">${escapeHtml(session.title ?? session.id)}</div>
          <div class="session-chip-meta">${escapeHtml(session.status ?? 'unknown')} · ${escapeHtml(
            String(session.actorIds.length),
          )} actors</div>
        </article>
      `;
    })
    .join('');
}

export function renderCurrentStateSummary(
  summary: CurrentStateSummary,
  session: RuntimeVisualSessionProjection | undefined,
): string {
  return `
    <dl class="key-values">
      <div><dt>Session</dt><dd>${escapeHtml(session?.title ?? session?.id ?? 'none')}</dd></div>
      <div><dt>Visible actors</dt><dd>${escapeHtml(String(summary.visibleActors))}</dd></div>
      <div><dt>Active tasks</dt><dd>${escapeHtml(String(summary.activeTasks))}</dd></div>
      <div><dt>Active tools</dt><dd>${escapeHtml(String(summary.activeTools))}</dd></div>
      <div><dt>Issues</dt><dd>${escapeHtml(String(summary.actorsWithErrors))}</dd></div>
      <div><dt>Dominant activity</dt><dd>${escapeHtml(summary.dominantActivity)}</dd></div>
    </dl>
  `;
}

export function renderInspectorSummary(
  runtimeEvent: RuntimeEvent | undefined,
  visualEvent: VisualEvent | undefined,
): string {
  if (!runtimeEvent) {
    return '<p class="empty">Browsing the live timeline. Select an event to pin payload and visual evidence here.</p>';
  }

  return `
    <p class="subtle">
      ${escapeHtml(runtimeEvent.id)}
      ${visualEvent ? ` · linked visual ${escapeHtml(visualEvent.id)}` : ' · no linked visual event'}
    </p>
  `;
}

export function selectDashboardState(
  state: Readonly<RuntimeVisualState>,
  uiState: LiveDashboardUiState,
): LiveDashboardSelection {
  const sessions = listSessions(state);
  const selectedSession = readSelectedSession(sessions, uiState.selectedSessionId);
  const filteredActors = filterActors(
    readCurrentActors(state, selectedSession),
    normalizeFilterText(uiState.actorFilterText),
  );
  const actors = sortActors(filteredActors, uiState.actorSort);
  const selectedActor = readSelectedActor(actors, uiState.selectedActorKey);
  const timelineEvents = filterTimelineByCategory(
    filterTimelineEvents(state.runtimeEvents, selectedSession?.id, selectedActor?.id),
    uiState.timelineFilter,
  );
  const selectedRuntimeEvent = readSelectedRuntimeEvent(timelineEvents, uiState.selectedRuntimeEventId);
  const selectedVisualEvent = readLinkedVisualEvent(state.visualEvents, selectedRuntimeEvent);
  const currentStateSummary = summarizeCurrentState(actors);

  return {
    sessions,
    selectedSession,
    actors,
    selectedActor,
    timelineEvents,
    selectedRuntimeEvent,
    selectedVisualEvent,
    currentStateSummary,
  };
}

export function listSessions(state: Readonly<RuntimeVisualState>): RuntimeVisualSessionProjection[] {
  return Object.values(state.sessionsById).sort((left, right) =>
    (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''),
  );
}

function readSelectedSession(
  sessions: readonly RuntimeVisualSessionProjection[],
  selectedSessionId?: string,
): RuntimeVisualSessionProjection | undefined {
  if (selectedSessionId) {
    const explicit = sessions.find((session) => session.id === selectedSessionId);
    if (explicit) {
      return explicit;
    }
  }

  return sessions.at(0);
}

function readSelectedActor(
  actors: readonly RuntimeVisualActorProjection[],
  selectedActorKey?: string,
): RuntimeVisualActorProjection | undefined {
  if (!selectedActorKey) {
    return undefined;
  }

  return actors.find((actor) => createRuntimeVisualActorKey(actor.sessionId, actor.id) === selectedActorKey);
}

function readSelectedRuntimeEvent(
  events: readonly RuntimeEvent[],
  selectedRuntimeEventId?: string,
): RuntimeEvent | undefined {
  if (!selectedRuntimeEventId) {
    return undefined;
  }

  return events.find((event) => event.id === selectedRuntimeEventId);
}

export function readCurrentActors(
  state: Readonly<RuntimeVisualState>,
  session: RuntimeVisualSessionProjection | undefined,
): RuntimeVisualActorProjection[] {
  const actors = Object.values(state.actorsById);

  return actors
    .filter((actor) => !session || actor.sessionId === session.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function filterActors(
  actors: readonly RuntimeVisualActorProjection[],
  filterText: string,
): RuntimeVisualActorProjection[] {
  if (filterText.length === 0) {
    return [...actors];
  }

  return actors.filter((actor) => {
    const haystack = [
      actor.name,
      actor.role,
      actor.kind,
      actor.currentTaskTitle,
      actor.currentToolName,
      actor.currentZone,
      actor.currentActivity,
      actor.lastSummary,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(filterText);
  });
}

export function sortActors(
  actors: readonly RuntimeVisualActorProjection[],
  sortKey: ActorSortKey,
): RuntimeVisualActorProjection[] {
  const next = [...actors];

  switch (sortKey) {
    case 'name':
      return next.sort((left, right) => left.name.localeCompare(right.name));
    case 'activity':
      return next.sort((left, right) =>
        `${left.currentActivity ?? 'zzz'}${left.name}`.localeCompare(`${right.currentActivity ?? 'zzz'}${right.name}`),
      );
    case 'updated':
      return next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}

export function filterTimelineEvents(
  events: readonly RuntimeEvent[],
  sessionId?: string,
  actorId?: string,
): RuntimeEvent[] {
  return events.filter((event) => {
    if (sessionId && event.sessionId !== sessionId) {
      return false;
    }

    if (actorId && event.actor?.id !== actorId) {
      return false;
    }

    return true;
  });
}

export function filterTimelineByCategory(
  events: readonly RuntimeEvent[],
  timelineFilter: TimelineFilterKind,
): RuntimeEvent[] {
  if (timelineFilter === 'all') {
    return [...events];
  }

  return events.filter((event) => matchesTimelineCategory(event, timelineFilter));
}

function matchesTimelineCategory(event: RuntimeEvent, timelineFilter: TimelineFilterKind): boolean {
  switch (timelineFilter) {
    case 'tasks':
      return event.kind.startsWith('task.');
    case 'tools':
      return event.kind.startsWith('tool.');
    case 'messages':
      return event.kind.startsWith('message.');
    case 'artifacts':
      return event.kind.startsWith('artifact.');
    case 'system':
      return event.kind === 'warning' || event.kind === 'error' || event.kind.endsWith('.failed');
    case 'all':
      return true;
  }
}

function readLinkedVisualEvent(
  visualEvents: readonly VisualEvent[],
  runtimeEvent: RuntimeEvent | undefined,
): VisualEvent | undefined {
  if (!runtimeEvent) {
    return undefined;
  }

  return [...visualEvents]
    .reverse()
    .find((event) => event.sourceRuntimeEventIds.includes(runtimeEvent.id));
}

function summarizeCurrentState(actors: readonly RuntimeVisualActorProjection[]): CurrentStateSummary {
  const activityCounts = new Map<string, number>();

  for (const actor of actors) {
    if (actor.currentActivity) {
      activityCounts.set(actor.currentActivity, (activityCounts.get(actor.currentActivity) ?? 0) + 1);
    }
  }

  const dominantActivity =
    [...activityCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]?.replaceAll('_', ' ') ?? 'idle';

  return {
    visibleActors: actors.length,
    activeTasks: actors.filter((actor) => actor.currentTaskTitle).length,
    activeTools: actors.filter((actor) => actor.currentToolName).length,
    actorsWithErrors: actors.filter((actor) => actor.lastError).length,
    dominantActivity,
  };
}

function readEventSummary(event: RuntimeEvent): string {
  const payload = event.payload as unknown as Record<string, unknown>;
  const summary = payload.summary;
  const message = payload.message;
  const title = payload.title;
  const status = payload.status;

  if (typeof summary === 'string' && summary.length > 0) return summary;
  if (typeof message === 'string' && message.length > 0) return message;
  if (typeof title === 'string' && title.length > 0) return title;
  if (typeof status === 'string' && status.length > 0) return status;
  return event.kind;
}

function renderJson(value: unknown): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function countWarnings(events: readonly RuntimeEvent[]): number {
  return events.filter((event) => event.kind === 'warning').length;
}

function countErrors(events: readonly RuntimeEvent[]): number {
  return events.filter((event) => event.kind === 'error' || event.kind.endsWith('.failed')).length;
}

function bindDashboardControls(root: HTMLElement, uiState: LiveDashboardUiState, rerender: () => void): void {
  const sessionSelect = root.querySelector<HTMLSelectElement>('[data-slot="session-select"]');
  const actorFilter = root.querySelector<HTMLInputElement>('[data-slot="actor-filter"]');
  const actorSort = root.querySelector<HTMLSelectElement>('[data-slot="actor-sort"]');
  const timelineFilter = root.querySelector<HTMLSelectElement>('[data-slot="timeline-filter"]');

  sessionSelect?.addEventListener('change', () => {
    uiState.selectedSessionId = readOptionalString(sessionSelect.value);
    uiState.selectedActorKey = undefined;
    uiState.selectedRuntimeEventId = undefined;
    rerender();
  });

  actorFilter?.addEventListener('input', () => {
    uiState.actorFilterText = actorFilter.value;
    uiState.selectedActorKey = undefined;
    uiState.selectedRuntimeEventId = undefined;
    rerender();
  });

  actorSort?.addEventListener('change', () => {
    uiState.actorSort = readActorSort(actorSort.value);
    rerender();
  });

  timelineFilter?.addEventListener('change', () => {
    uiState.timelineFilter = readTimelineFilter(timelineFilter.value);
    uiState.selectedRuntimeEventId = undefined;
    rerender();
  });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionButton = target.closest<HTMLButtonElement>('[data-action]');
    if (actionButton) {
      switch (actionButton.dataset.action) {
        case 'clear-actor-focus':
          uiState.selectedActorKey = undefined;
          uiState.selectedRuntimeEventId = undefined;
          rerender();
          return;
        case 'clear-event-focus':
          uiState.selectedRuntimeEventId = undefined;
          rerender();
          return;
      }
    }

    const sessionCard = target.closest<HTMLElement>('[data-session-id]');
    if (sessionCard) {
      uiState.selectedSessionId = readOptionalString(sessionCard.dataset.sessionId);
      uiState.selectedActorKey = undefined;
      uiState.selectedRuntimeEventId = undefined;
      rerender();
      return;
    }

    const actorCard = target.closest<HTMLElement>('[data-actor-key]');
    if (actorCard) {
      uiState.selectedActorKey = readOptionalString(actorCard.dataset.actorKey);
      uiState.selectedRuntimeEventId = undefined;
      rerender();
      return;
    }

    const timelineItem = target.closest<HTMLElement>('[data-event-id]');
    if (timelineItem) {
      uiState.selectedRuntimeEventId = readOptionalString(timelineItem.dataset.eventId);
      rerender();
    }
  });

  root.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const interactive = target.closest<HTMLElement>('[data-session-id], [data-actor-key], [data-event-id]');
    if (!interactive) return;

    event.preventDefault();

    if (interactive.dataset.sessionId) {
      uiState.selectedSessionId = readOptionalString(interactive.dataset.sessionId);
      uiState.selectedActorKey = undefined;
      uiState.selectedRuntimeEventId = undefined;
    } else if (interactive.dataset.actorKey) {
      uiState.selectedActorKey = readOptionalString(interactive.dataset.actorKey);
      uiState.selectedRuntimeEventId = undefined;
    } else if (interactive.dataset.eventId) {
      uiState.selectedRuntimeEventId = readOptionalString(interactive.dataset.eventId);
    }

    rerender();
  });
}

function syncDashboardControls(
  root: HTMLElement,
  selection: LiveDashboardSelection,
  uiState: LiveDashboardUiState,
): void {
  const sessionSelect = root.querySelector<HTMLSelectElement>('[data-slot="session-select"]');
  const actorFilter = root.querySelector<HTMLInputElement>('[data-slot="actor-filter"]');
  const actorSort = root.querySelector<HTMLSelectElement>('[data-slot="actor-sort"]');
  const timelineFilter = root.querySelector<HTMLSelectElement>('[data-slot="timeline-filter"]');

  if (sessionSelect) {
    const options = [
      '<option value="">Latest active session</option>',
      ...selection.sessions.map((session) => {
        const label = [session.title ?? session.id, session.status ?? 'unknown']
          .filter(Boolean)
          .join(' · ');
        const selected = session.id === selection.selectedSession?.id ? ' selected' : '';
        return `<option value="${escapeHtml(session.id)}"${selected}>${escapeHtml(label)}</option>`;
      }),
    ];

    sessionSelect.innerHTML = options.join('');
  }

  if (actorFilter && actorFilter.value !== uiState.actorFilterText) {
    actorFilter.value = uiState.actorFilterText;
  }

  if (actorSort && actorSort.value !== uiState.actorSort) {
    actorSort.value = uiState.actorSort;
  }

  if (timelineFilter && timelineFilter.value !== uiState.timelineFilter) {
    timelineFilter.value = uiState.timelineFilter;
  }
}

function normalizeFilterText(value: string): string {
  return value.trim().toLowerCase();
}

function readOptionalString(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function readActorSort(value: string): ActorSortKey {
  switch (value) {
    case 'name':
      return 'name';
    case 'activity':
      return 'activity';
    case 'updated':
    default:
      return 'updated';
  }
}

function readTimelineFilter(value: string): TimelineFilterKind {
  switch (value) {
    case 'tasks':
    case 'tools':
    case 'messages':
    case 'artifacts':
    case 'system':
      return value;
    case 'all':
    default:
      return 'all';
  }
}

function setText(root: HTMLElement, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function setHtml(root: HTMLElement, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.innerHTML = value;
}

function setDisabled(root: HTMLElement, selector: string, disabled: boolean): void {
  const element = root.querySelector<HTMLButtonElement>(selector);
  if (element) {
    element.disabled = disabled;
  }
}

function describeActorFocus(actor: RuntimeVisualActorProjection | undefined): string {
  return actor ? `focused on ${actor.name}` : 'session-wide view';
}

function describeEventFocus(event: RuntimeEvent | undefined): string {
  return event ? `pinned ${event.kind}` : 'timeline browsing';
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

if (typeof document !== 'undefined') {
  const root = document.querySelector<HTMLElement>('#app');

  if (root) {
    void mountLiveDashboard(root);
  }
}

function readBrowserOpenClawDevConnectionConfig(): OpenClawDevConnectionConfig {
  const { config, warnings } = readOpenClawDevConnectionConfig(window.__AI_PLAYGROUND_OPENCLAW__);

  for (const warning of warnings) {
    console.warn(`[live-dashboard] ${warning}`);
  }

  return config;
}
