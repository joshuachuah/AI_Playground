import { bootLiveClientApp } from '../app/boot.js';
import { LocalRuntimeEventSourceTransport, createIntervalRuntimeEventSource } from '../live/local-runtime-event-source.js';
import type { RuntimeEvent } from '../contracts/runtime-events.js';
import type { VisualEvent } from '../contracts/visual-events.js';
import type {
  RuntimeVisualActorProjection,
  RuntimeVisualSessionProjection,
  RuntimeVisualState,
} from '../state/runtime-visual-store.js';
import { sampleRuntimeEvents } from '../dev/sample-runtime-events.js';

const TIMELINE_LIMIT = 12;

export async function mountLocalLiveDashboard(root: HTMLElement): Promise<() => Promise<void>> {
  root.innerHTML = renderShell();

  const transport = new LocalRuntimeEventSourceTransport({
    source: createIntervalRuntimeEventSource(sampleRuntimeEvents, { intervalMs: 500 }),
  });

  const app = bootLiveClientApp({ transport });
  const unsubscribe = app.store.subscribe((state) => {
    renderState(root, state);
  });

  await app.start();

  return async () => {
    unsubscribe();
    await app.stop();
  };
}

function renderState(root: HTMLElement, state: Readonly<RuntimeVisualState>): void {
  const currentSession = readCurrentSession(state);
  const currentActors = readCurrentActors(state, currentSession);

  setText(root, '[data-slot="connection-status"]', state.connectionStatus);
  setText(root, '[data-slot="runtime-count"]', String(state.runtimeEvents.length));
  setText(root, '[data-slot="visual-count"]', String(state.visualEvents.length));
  setText(root, '[data-slot="error-count"]', String(countErrors(state.runtimeEvents)));
  setText(root, '[data-slot="warning-count"]', String(countWarnings(state.runtimeEvents)));
  setText(root, '[data-slot="actor-count"]', String(currentActors.length));
  setText(root, '[data-slot="last-error"]', state.lastError ?? 'none');

  const latestRuntimeEvent = state.runtimeEvents.at(-1);
  const latestVisualEvent = state.visualEvents.at(-1);

  setHtml(root, '[data-slot="timeline"]', renderTimeline(state.runtimeEvents));
  setHtml(root, '[data-slot="session-summary"]', renderSessionSummary(currentSession));
  setHtml(root, '[data-slot="actor-cards"]', renderActorCards(currentActors));
  setText(root, '[data-slot="latest-runtime-kind"]', latestRuntimeEvent?.kind ?? 'none');
  setText(root, '[data-slot="latest-runtime-source"]', latestRuntimeEvent?.source ?? 'none');
  setText(root, '[data-slot="latest-runtime-actor"]', latestRuntimeEvent?.actor?.name ?? 'none');
  setText(root, '[data-slot="latest-visual-type"]', latestVisualEvent?.type ?? 'none');
  setText(root, '[data-slot="latest-visual-summary"]', latestVisualEvent?.summary ?? 'none');
  setText(root, '[data-slot="latest-session"]', latestRuntimeEvent?.sessionId ?? 'none');
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
        <article class="panel stat-panel"><div class="label">Active actors</div><div class="value" data-slot="actor-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Warnings</div><div class="value" data-slot="warning-count">0</div></article>
        <article class="panel stat-panel"><div class="label">Errors</div><div class="value" data-slot="error-count">0</div></article>
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
            <h2>Active actors</h2>
            <span class="subtle">current projections</span>
          </div>
          <div class="actor-grid" data-slot="actor-cards"></div>
        </article>
      </section>

      <section class="grid main-grid">
        <article class="panel">
          <div class="panel-header">
            <h2>Event timeline</h2>
            <span class="subtle">latest ${TIMELINE_LIMIT}</span>
          </div>
          <div class="timeline" data-slot="timeline"></div>
        </article>

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
      </section>

      <section class="grid footer-grid">
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

export function renderActorCards(actors: readonly RuntimeVisualActorProjection[]): string {
  if (actors.length === 0) {
    return '<p class="empty">Waiting for actor state…</p>';
  }

  return actors
    .map((actor) => {
      const meta = [actor.role, actor.currentZone, actor.currentActivity].filter(Boolean).join(' · ');
      return `
        <article class="actor-card">
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

function renderTimeline(events: readonly RuntimeEvent[]): string {
  if (events.length === 0) {
    return '<p class="empty">Waiting for runtime events…</p>';
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

function readCurrentSession(state: Readonly<RuntimeVisualState>): RuntimeVisualSessionProjection | undefined {
  const latestRuntimeEvent = state.runtimeEvents.at(-1);
  if (latestRuntimeEvent) {
    return state.sessionsById[latestRuntimeEvent.sessionId];
  }

  return Object.values(state.sessionsById)
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
    .at(0);
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
    void mountLocalLiveDashboard(root);
  }
}
