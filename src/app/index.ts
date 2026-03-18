export interface LiveMvpClientShell {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Placeholder entry point for the future web client.
 *
 * PR 1 intentionally avoids framework boilerplate and focuses on the shared
 * contracts between runtime ingestion, translation, and visualization.
 */
export const appFoundation = {
  name: 'AI_Playground',
  target: 'live-openclaw-runtime-visualization',
  notes: [
    'subscribe to normalized runtime events',
    'translate runtime events to visual events',
    'render scene + timeline + inspector from visual state',
  ],
} as const;
