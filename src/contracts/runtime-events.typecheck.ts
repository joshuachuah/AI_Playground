import type { RuntimeEvent } from './runtime-events.js';

const validToolStart: RuntimeEvent<'tool.started'> = {
  id: 'evt-tool-start',
  timestamp: '2026-03-18T14:00:00.000Z',
  sessionId: 'session-live-001',
  source: 'openclaw.tooling',
  kind: 'tool.started',
  payload: {
    tool: { name: 'write' },
    status: 'started',
  },
};

void validToolStart;

const invalidToolStart: RuntimeEvent<'tool.started'> = {
  id: 'evt-tool-start-invalid',
  timestamp: '2026-03-18T14:00:00.000Z',
  sessionId: 'session-live-001',
  source: 'openclaw.tooling',
  kind: 'tool.started',
  // @ts-expect-error tool payload requires a tool reference.
  payload: {
    status: 'started',
  },
};

void invalidToolStart;

const invalidSessionUpdate: RuntimeEvent<'session.updated'> = {
  id: 'evt-session-update-invalid',
  timestamp: '2026-03-18T14:00:00.000Z',
  sessionId: 'session-live-001',
  source: 'openclaw.runtime',
  kind: 'session.updated',
  payload: {
    status: 'running',
    // @ts-expect-error unsupported payload keys should fail typecheck.
    unsupported: true,
  },
};

void invalidSessionUpdate;
