import type { RuntimeEventTransport } from '../live/transport.js';
import type { RuntimeVisualStore } from '../state/runtime-visual-store.js';

export interface LiveClientShell {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface LiveClientShellDependencies {
  transport: RuntimeEventTransport;
  store: RuntimeVisualStore;
}

export class DefaultLiveClientShell implements LiveClientShell {
  constructor(private readonly dependencies: LiveClientShellDependencies) {}

  async connect(): Promise<void> {
    this.dependencies.store.setConnectionStatus('connecting');

    await this.dependencies.transport.connect({
      onStatusChange: (status) => {
        this.dependencies.store.setConnectionStatus(status);
      },
      onRuntimeEvent: (event) => {
        this.dependencies.store.ingestRuntimeEvent(event);
      },
      onError: (error) => {
        this.dependencies.store.recordError(error);
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.dependencies.transport.disconnect();
    this.dependencies.store.setConnectionStatus('disconnected');
  }
}
