import type { RuntimeEventStreamListener, RuntimeEventTransport } from '../live/transport.js';
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
  private readonly listener: RuntimeEventStreamListener;

  constructor(private readonly dependencies: LiveClientShellDependencies) {
    this.listener = {
      onStatusChange: (status) => {
        this.dependencies.store.setConnectionStatus(status);
      },
      onRuntimeEvent: (event) => {
        this.dependencies.store.ingestRuntimeEvent(event);
      },
      onError: (error) => {
        this.dependencies.store.recordError(error);
      },
    };
  }

  async connect(): Promise<void> {
    try {
      await this.dependencies.transport.connect(this.listener);
    } catch (error) {
      this.dependencies.store.recordError(error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.dependencies.transport.disconnect();
      this.dependencies.store.setConnectionStatus('disconnected');
    } catch (error) {
      this.dependencies.store.recordError(error);
      throw error;
    }
  }
}
