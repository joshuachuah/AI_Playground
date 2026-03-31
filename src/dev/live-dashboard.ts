import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOpenClawDevConnectionConfigFromEnv } from './openclaw-dev-config.js';
import { describeOpenClawDevConnection } from './openclaw-dev-transport.js';

const DEFAULT_PORT = 4173;
const BUILD_ROOT = new URL('../../.build/', import.meta.url);

export async function runLocalLiveDashboardServer(port = DEFAULT_PORT): Promise<void> {
  const { config, warnings } = readOpenClawDevConnectionConfigFromEnv(process.env);
  const html = renderHtml();

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `localhost:${port}`}`);

    if (requestUrl.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }

    if (requestUrl.pathname.startsWith('/assets/')) {
      const assetPath = join(BUILD_ROOT.pathname, requestUrl.pathname.replace('/assets/', ''));

      try {
        const asset = await readFile(assetPath);
        response.writeHead(200, { 'content-type': contentTypeFor(assetPath) });
        response.end(asset);
      } catch {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Asset not found');
      }

      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });

  console.log(`[live-dashboard] listening on http://localhost:${port}`);
  console.log(`[live-dashboard] source: ${describeOpenClawDevConnection(config)}`);
  for (const warning of warnings) {
    console.warn(`[live-dashboard] ${warning}`);
  }
  console.log('[live-dashboard] press Ctrl+C to stop');
}

function renderHtml(): string {
  const { config } = readOpenClawDevConnectionConfigFromEnv(process.env);
  const serializedConfig = JSON.stringify(config).replaceAll('</script>', '<\\/script>');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI_Playground local live dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #071019;
        --bg-2: #0c1826;
        --panel: rgba(10, 20, 32, 0.84);
        --panel-2: rgba(14, 28, 43, 0.92);
        --panel-3: rgba(18, 36, 56, 0.96);
        --border: rgba(118, 168, 210, 0.18);
        --text: #eef6ff;
        --muted: #8ea7bf;
        --accent: #7be0d6;
        --accent-2: #f4b76b;
        --ok: #48d78a;
        --warn: #f7c25c;
        --err: #ff7f7f;
        --shadow: 0 30px 90px rgba(0, 0, 0, 0.34);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        color: var(--text);
        background:
          radial-gradient(circle at 20% 0%, rgba(123, 224, 214, 0.16), transparent 32%),
          radial-gradient(circle at 100% 20%, rgba(244, 183, 107, 0.16), transparent 28%),
          linear-gradient(180deg, var(--bg-2), var(--bg));
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: 0.16;
        background-image:
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
        background-size: 32px 32px;
        mask-image: radial-gradient(circle at center, black 45%, transparent 100%);
      }
      .app-shell {
        max-width: 1420px;
        margin: 0 auto;
        padding: 28px;
      }
      .grid { display: grid; gap: 16px; margin-bottom: 16px; }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.5fr);
        gap: 16px;
        margin-bottom: 16px;
      }
      .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .controls-grid, .session-grid { grid-template-columns: 1fr; }
      .hero-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .main-grid { grid-template-columns: minmax(360px, 0.8fr) minmax(0, 1.2fr); }
      .inspector-grid-shell { grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); }
      .panel, .status-card {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
          var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
      }
      .panel-header, .status-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .eyebrow {
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 11px;
        margin: 0 0 10px;
      }
      h1, h2, h3, p { margin-top: 0; }
      h1 {
        margin-bottom: 10px;
        font-size: clamp(34px, 5vw, 52px);
        line-height: 0.94;
        max-width: 10ch;
      }
      h2 { margin-bottom: 0; font-size: 18px; }
      h3 {
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .subtle, .label, .timeline-subtle, dt, .control-field span, .session-chip-meta { color: var(--muted); }
      .label { font-size: 12px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
      .value { font-size: 30px; font-weight: 700; }
      .badge {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        display: inline-block;
        background: #5f6d8f;
        box-shadow: 0 0 0 7px rgba(255,255,255,0.04);
      }
      .badge[data-status="connected"] { background: var(--ok); }
      .badge[data-status="connecting"] { background: var(--warn); }
      .badge[data-status="error"] { background: var(--err); }
      .badge[data-status="disconnected"] { background: var(--muted); }
      .stat-panel {
        position: relative;
        overflow: hidden;
      }
      .stat-panel::after {
        content: "";
        position: absolute;
        inset: auto -30px -30px auto;
        width: 120px;
        height: 120px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(123, 224, 214, 0.18), transparent 70%);
      }
      .control-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .control-field {
        display: grid;
        gap: 8px;
      }
      input, select {
        width: 100%;
        border: 1px solid rgba(255,255,255,0.09);
        background: var(--panel-2);
        color: var(--text);
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
      }
      .session-rail {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .session-chip,
      .actor-card,
      .timeline-item {
        padding: 14px;
        border-radius: 14px;
        background: var(--panel-2);
        border: 1px solid rgba(255,255,255,0.05);
        cursor: pointer;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }
      .session-chip:hover,
      .actor-card:hover,
      .timeline-item:hover {
        transform: translateY(-1px);
        border-color: rgba(123, 224, 214, 0.35);
      }
      .session-chip.is-selected,
      .actor-card.is-selected,
      .timeline-item.is-selected {
        border-color: rgba(123, 224, 214, 0.6);
        background: var(--panel-3);
        box-shadow: inset 0 0 0 1px rgba(123, 224, 214, 0.18);
      }
      .session-chip-title {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .key-values {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 0;
      }
      .key-values div {
        padding: 12px;
        background: var(--panel-2);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
      }
      dt { font-size: 12px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
      dd { margin: 0; font-weight: 700; }
      .actor-grid, .timeline { display: grid; gap: 12px; }
      .timeline { max-height: 720px; overflow: auto; }
      .timeline-meta {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
        margin-bottom: 6px;
      }
      .timeline-kind {
        color: var(--accent);
        font-weight: 700;
      }
      .timeline-main { font-weight: 700; margin-bottom: 4px; }
      .actor-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .actor-name { font-size: 16px; font-weight: 700; }
      .actor-meta, .actor-detail { color: var(--muted); }
      .actor-meta, .actor-status { font-size: 12px; }
      .actor-status {
        color: var(--accent-2);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .inspector-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      pre {
        margin: 0;
        padding: 14px;
        border-radius: 12px;
        background: #071321;
        border: 1px solid rgba(255,255,255,0.05);
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        min-height: 140px;
      }
      .empty { color: var(--muted); }
      @media (max-width: 1100px) {
        .hero,
        .stats-grid,
        .hero-grid,
        .main-grid,
        .inspector-grid-shell,
        .inspector-grid,
        .control-grid,
        .key-values {
          grid-template-columns: 1fr;
        }
        .status-card { justify-content: flex-start; }
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__AI_PLAYGROUND_OPENCLAW__ = ${serializedConfig};
    </script>
    <script type="module" src="/assets/ui/live-dashboard.js"></script>
  </body>
</html>`;
}

function contentTypeFor(path: string): string {
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLocalLiveDashboardServer().catch((error: unknown) => {
    console.error('[live-dashboard] failed', error);
    process.exitCode = 1;
  });
}
