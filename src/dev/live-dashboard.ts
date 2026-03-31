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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI_Playground local live dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1020;
        --panel: #131a2d;
        --panel-2: #18223b;
        --border: #263455;
        --text: #e7ecf5;
        --muted: #9fb0cf;
        --accent: #77d0ff;
        --ok: #35d07f;
        --warn: #ffcb57;
        --err: #ff7b7b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        background: radial-gradient(circle at top, #16213f 0%, var(--bg) 45%);
        color: var(--text);
      }
      .app-shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 24px;
      }
      .hero, .grid { display: grid; gap: 16px; }
      .hero {
        grid-template-columns: 1.7fr minmax(220px, 0.7fr);
        align-items: stretch;
        margin-bottom: 16px;
      }
      .stats-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); margin-bottom: 16px; }
      .main-grid { grid-template-columns: minmax(340px, 0.9fr) minmax(420px, 1.1fr); margin-bottom: 16px; }
      .footer-grid { grid-template-columns: 1fr; }
      .panel, .status-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 18px;
        backdrop-filter: blur(10px);
      }
      .panel-header, .status-card { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; margin: 0 0 10px; }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 10px; font-size: clamp(28px, 4vw, 42px); }
      h2 { margin-bottom: 0; font-size: 18px; }
      h3 { font-size: 14px; color: var(--muted); margin-bottom: 10px; }
      .subtle, .label, .timeline-subtle, dt { color: var(--muted); }
      .label { font-size: 13px; margin-bottom: 6px; }
      .value { font-size: 28px; font-weight: 700; }
      .badge {
        width: 14px; height: 14px; border-radius: 999px; display: inline-block; background: #5f6d8f;
        box-shadow: 0 0 0 6px rgba(255,255,255,0.04);
      }
      .badge[data-status="connected"] { background: var(--ok); }
      .badge[data-status="connecting"] { background: var(--warn); }
      .badge[data-status="error"] { background: var(--err); }
      .badge[data-status="disconnected"] { background: var(--muted); }
      .timeline { display: grid; gap: 10px; max-height: 640px; overflow: auto; }
      .timeline-item {
        padding: 12px;
        border-radius: 12px;
        background: var(--panel-2);
        border: 1px solid rgba(255,255,255,0.05);
      }
      .timeline-meta {
        display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--muted); margin-bottom: 6px;
      }
      .timeline-kind {
        color: var(--accent);
        font-weight: 600;
      }
      .timeline-main { font-weight: 600; margin-bottom: 4px; }
      .key-values { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0 0 18px; }
      .key-values div {
        padding: 12px;
        background: var(--panel-2);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
      }
      dt { font-size: 12px; margin-bottom: 6px; }
      dd { margin: 0; font-weight: 600; }
      .inspector-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .actor-grid { display: grid; gap: 12px; }
      .actor-card {
        padding: 14px;
        border-radius: 12px;
        background: var(--panel-2);
        border: 1px solid rgba(255,255,255,0.05);
      }
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
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      pre {
        margin: 0;
        padding: 14px;
        border-radius: 12px;
        background: #0a1224;
        border: 1px solid rgba(255,255,255,0.05);
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        min-height: 120px;
      }
      .empty { color: var(--muted); }
      @media (max-width: 980px) {
        .hero, .stats-grid, .main-grid, .inspector-grid, .key-values { grid-template-columns: 1fr; }
        .status-card { justify-content: flex-start; }
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__AI_PLAYGROUND_OPENCLAW__ = ${JSON.stringify(config)};
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
