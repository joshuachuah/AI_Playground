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

declare global {
  interface Window {
    __AI_PLAYGROUND_OPENCLAW__?: OpenClawDevConnectionConfig;
  }
}

interface LiveDashboardUiState {
  selectedSessionId?: string;
  selectedActorKey?: string;
  actorFilterText: string;
}

interface LiveDashboardSelection {
  sessions: RuntimeVisualSessionProjection[];
  selectedSession?: RuntimeVisualSessionProjection;
  actors: RuntimeVisualActorProjection[];
  selectedActor?: RuntimeVisualActorProjection;
  timelineEvents: RuntimeEvent[];
}

export async function mountLiveDashboard(
  root: HTMLElement,
  config: OpenClawDevConnectionConfig = readBrowserOpenClawDevConnectionConfig(),
): Promise<() => Promise<void>> {
  root.innerHTML = renderShell();

  const uiState: LiveDashboardUiState = {
    actorFilterText: '',
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
  setText(root, '[data-slot="error-count"]', String(countErrors(state.runtimeEvents)));
  setText(root, '[data-slot="warning-count"]', String(countWarnings(state.runtimeEvents)));
  setText(root, '[data-slot="actor-count"]', String(selection.actors.length));
  setText(root, '[data-slot="session-count"]', String(selection.sessions.length));
  setText(root, '[data-slot="last-error"]', state.lastError ?? 'none');

  const latestRuntimeEvent = selection.timelineEvents.at(-1);
  const latestVisualEvent = readLatestVisualEventForSelection(state, selection.selectedSession?.id, selection.selectedActor?.id);

  setHtml(root, '[data-slot="timeline"]', renderTimeline(selection.timelineEvents));
  setHtml(root, '[data-slot="session-summary"]', renderSessionSummary(selection.selectedSession));
  setHtml(root, '[data-slot="actor-cards"]', renderActorCards(selection.actors, selection.selectedActor?.id));
  setHtml(root, '[data-slot="selected-actor"]', renderSelectedActor(selection.selectedActor));
  setText(root, '[data-slot="latest-runtime-kind"]', latestRuntimeEvent?.kind ?? 'none');
  setText(root, '[data-slot="latest-runtime-source"]', latestRuntimeEvent?.source ?? 'none');
  setText(root, '[data-slot="latest-runtime-actor"]', latestRuntimeEvent?.actor?.name ?? 'none');
  setText(root, '[data-slot="latest-visual-type"]', latestVisualEvent?.type ?? 'none');
  setText(root, '[data-slot="latest-visual-summary"]', latestVisualEvent?.summary ?? 'none');
  setText(root, '[data-slot="latest-session"]', selection.selectedSession?.id ?? latestRuntimeEvent?.sessionId ?? 'none');
  setHtml(root, '[data-slot="latest-payload"]', renderJson(latestRuntimeEvent?.payload ?? null));
  setHtml(
    root,
    '[data-slot="latest-visual"]',
    renderJson(
      latestVisualEvent
        ? {
            type: latestVisualEvent.type,
            summary: latestVisualEvent.summary,
            scene: latestVisualEvent.scene,
            ui: latestVisualEvent.ui,
          }
        : null,
    ),
  );

  const statusBadge = root.querySelector<HTMLElement>('[data-slot="connection-badge"]');
  if (statusBadge) {
    statusBadge.dataset.status = state.connectionStatus;
  }
}

function renderShell(): string {
  return `
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">AI_Playground · local live dashboard</p>
          <h1>Runtime observability v1 slice</h1>
          <p class="subtle">Minimal browser UI over the existing boot → transport → store path.</p>
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
        <article class="panel stat-panel"><div class="label">Warnings</div><div class="value" data-slot="warning-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Errors</div><div class="value" data-slot="error-count">0</div></article>
      </section>

      <section class="grid controls-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Dashboard controls</h2>
            <span class="subtle">phase 2</span>
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
          </div>
        </article>
      </section>

      <section class="grid main-grid">
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
            <span class="subtle">detail view</span>
          </div>
          <div data-slot="selected-actor"></div>
        </article>
      </section>

      <section class="grid main-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Actors</h2>
            <span class="subtle">click to inspect</span>
          </div>
          <div class="actor-grid" data-slot="actor-cards"></div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <h2>Event timeline</h2>
            <span class="subtle">latest ${TIMELINE_LIMIT}</span>
          </div>
          <div class="timeline" data-slot="timeline"></div>
        </article>
      </section>

      <section class="grid main-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Latest event inspector</h2>
            <span class="subtle" data-slot="latest-session">none</span>
          </div>
          <dl class="key-values">
            <div><dt>Runtime kind</dt><dd data-slot="latest-runtime-kind">none</dd></div>
            <div><dt>Runtime source</dt><dd data-slot="latest-runtime-source">none</dd></div>
            <div><dt>Actor</dt><dd data-slot="latest-runtime-actor">none</dd></div>
            <div><dt>Visual type</dt><dd data-slot="latest-visual-type">none</dd></div>
            <div><dt>Visual summary</dt><dd data-slot="latest-visual-summary">none</dd></div>
          </dl>
          <div class="inspector-grid">
            <div>
              <h3>Runtime payload</h3>
              <pre data-slot="latest-payload">null</pre>
            </div>
            <div>
              <h3>Visual projection</h3>
              <pre data-slot="latest-visual">null</pre>
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
    return '<p class="empty">Select an actor to inspect current state…</p>';
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

export function renderTimeline(events: readonly RuntimeEvent[]): string {
  if (events.length === 0) {
    return '<p class="empty">No runtime events match the current selection.</p>';
  }

  return events
    .slice(-TIMELINE_LIMIT)
    .reverse()
    .map((event) => {
      const actorName = event.actor?.name ?? 'unknown';
      const summary = readEventSummary(event);
      return `
        <article class="timeline-item">
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

export function selectDashboardState(
  state: Readonly<RuntimeVisualState>,
  uiState: LiveDashboardUiState,
): LiveDashboardSelection {
  const sessions = listSessions(state);
  const selectedSession = readSelectedSession(sessions, uiState.selectedSessionId);
  const actors = filterActors(
    readCurrentActors(state, selectedSession),
    normalizeFilterText(uiState.actorFilterText),
  );
  const selectedActor = readSelectedActor(actors, uiState.selectedActorKey);
  const timelineEvents = filterTimelineEvents(state.runtimeEvents, selectedSession?.id, selectedActor?.id);

  return {
    sessions,
    selectedSession,
    actors,
    selectedActor,
    timelineEvents,
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

function readLatestVisualEventForSelection(
  state: Readonly<RuntimeVisualState>,
  sessionId?: string,
  actorId?: string,
): VisualEvent | undefined {
  return [...state.visualEvents]
    .reverse()
    .find((event) => (!sessionId || event.sessionId === sessionId) && (!actorId || event.actorId === actorId));
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

  sessionSelect?.addEventListener('change', () => {
    uiState.selectedSessionId = readOptionalString(sessionSelect.value);
    uiState.selectedActorKey = undefined;
    rerender();
  });

  actorFilter?.addEventListener('input', () => {
    uiState.actorFilterText = actorFilter.value;
    uiState.selectedActorKey = undefined;
    rerender();
  });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actorCard = target.closest<HTMLElement>('[data-actor-key]');
    if (!actorCard) return;

    uiState.selectedActorKey = readOptionalString(actorCard.dataset.actorKey);
    rerender();
  });

  root.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (event.key !== 'Enter' && event.key !== ' ') return;
    const actorCard = target.closest<HTMLElement>('[data-actor-key]');
    if (!actorCard) return;

    event.preventDefault();
    uiState.selectedActorKey = readOptionalString(actorCard.dataset.actorKey);
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
}

function normalizeFilterText(value: string): string {
  return value.trim().toLowerCase();
}

function readOptionalString(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function setText(root: HTMLElement, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function setHtml(root: HTMLElement, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.innerHTML = value;
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
