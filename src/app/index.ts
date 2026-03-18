import { DefaultLiveClientShell } from './live-client-shell.js';
import type { RuntimeEventTransport } from '../live/transport.js';
import { OpenClawRuntimeTranslator } from '../translators/runtime-to-visual.js';
import { RuntimeVisualStore } from '../state/runtime-visual-store.js';

export * from './live-client-shell.js';

/**
 * Minimal entrypoint for wiring transport + translation + state.
 * Browser UI can consume `store.subscribe(...)` without binding to a framework yet.
 */
export function createLiveClientShell(transport: RuntimeEventTransport) {
  const translator = new OpenClawRuntimeTranslator();
  const store = new RuntimeVisualStore({ translator });
  const shell = new DefaultLiveClientShell({ transport, store });

  return {
    shell,
    store,
  };
}

export const appFoundation = {
  name: 'AI_Playground',
  target: 'live-openclaw-runtime-visualization',
  notes: [
    'subscribe to normalized runtime events',
    'translate runtime events to visual events',
    'render scene + timeline + inspector from visual state',
    'keep transport protocol-agnostic (SSE/WebSocket ready)',
  ],
} as const;
