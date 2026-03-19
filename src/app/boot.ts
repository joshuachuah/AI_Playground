import { createLiveClientShell, type LiveClientShellBundle } from './index.js';
import type { RuntimeEventTransport } from '../live/transport.js';

export interface LiveClientApp extends LiveClientShellBundle {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface LiveClientAppConfig {
  transport: RuntimeEventTransport;
}

export function bootLiveClientApp(config: LiveClientAppConfig): LiveClientApp {
  const bundle = createLiveClientShell(config.transport);

  return {
    ...bundle,
    start: () => bundle.shell.connect(),
    stop: () => bundle.shell.disconnect(),
  };
}
