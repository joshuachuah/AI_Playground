import type { RuntimeEnvelope } from '../contracts/runtime-events.js';

export const openClawFixtureEvents: RuntimeEnvelope<Record<string, unknown>>[] = [
  {
    source: 'openclaw.runtime',
    receivedAt: '2026-03-18T14:00:00.000Z',
    event: {
      id: 'evt-session-start',
      type: 'run.started',
      session_id: 'session-live-001',
      timestamp: '2026-03-18T14:00:00.000Z',
      actor: {
        id: 'agent-main',
        name: 'Yuqi',
        role: 'assistant',
        kind: 'agent',
      },
      title: 'Plan runtime ingestion PR',
      goal: 'Normalize OpenClaw runtime payloads into repo contracts',
    },
  },
  {
    source: 'openclaw.tooling',
    receivedAt: '2026-03-18T14:00:05.000Z',
    event: {
      event_id: 'evt-tool-start',
      event: 'tool.invoked',
      runId: 'session-live-001',
      created_at: '2026-03-18T14:00:05.000Z',
      agent: {
        id: 'agent-main',
        name: 'Yuqi',
        role: 'assistant',
        kind: 'agent',
      },
      tool_call: {
        tool_name_hint: 'unused',
        name: 'web_search',
        invocation_id: 'call-001',
      },
      input: 'OpenClaw runtime event shapes',
      status: 'started',
    },
  },
  {
    source: 'openclaw.runtime',
    receivedAt: '2026-03-18T14:00:07.000Z',
    event: {
      id: 'evt-task-progress',
      kind: 'task.updated',
      sessionId: 'session-live-001',
      timestamp: '2026-03-18T14:00:07.000Z',
      actor: {
        id: 'agent-main',
        name: 'Yuqi',
      },
      task: {
        id: 'task-normalize',
        title: 'Implement runtime normalization',
        progress: 0.5,
      },
      status: 'in_progress',
      summary: 'Building the normalizer and fixtures',
    },
  },
  {
    source: 'openai.responses',
    receivedAt: '2026-03-18T14:00:09.000Z',
    event: {
      id: 'evt-response-delta',
      type: 'response.delta',
      session_id: 'session-live-001',
      timestamp: '2026-03-18T14:00:09.000Z',
      actor: {
        id: 'agent-main',
        name: 'Yuqi',
      },
      response_id: 'resp_123',
      phase: 'streaming',
      model: 'gpt-5.4',
      response: {
        id: 'resp_123',
        usage: {
          input_tokens: 512,
          output_tokens: 128,
          total_tokens: 640,
        },
      },
      summary: 'Streaming implementation details',
    },
  },
  {
    source: 'openclaw.tooling',
    receivedAt: '2026-03-18T14:00:12.000Z',
    event: {
      id: 'evt-tool-complete',
      type: 'tool.completed',
      session_id: 'session-live-001',
      timestamp: '2026-03-18T14:00:12.000Z',
      actor: {
        id: 'agent-main',
        name: 'Yuqi',
      },
      tool: {
        name: 'write',
        invocationId: 'call-002',
      },
      inputSummary: 'Persist normalization module',
      outputSummary: 'Created src/ingestion/openclaw-normalization.ts',
      status: 'completed',
    },
  },
  {
    source: 'openai.responses',
    receivedAt: '2026-03-18T14:00:14.000Z',
    event: {
      type: 'response.completed',
      session_id: 'session-live-001',
      timestamp: '2026-03-18T14:00:14.000Z',
      actor: {
        id: 'agent-main',
        name: 'Yuqi',
      },
      response: {
        id: 'resp_123',
        model: 'gpt-5.4',
      },
      summary: 'Runtime normalization is complete',
    },
  },
  {
    source: 'openclaw.tooling',
    receivedAt: '2026-03-18T14:00:16.000Z',
    event: {
      type: 'tool.failed',
      session_id: 'session-live-001',
      timestamp: '2026-03-18T14:00:16.000Z',
      actor: {
        id: 'agent-main',
        name: 'Yuqi',
      },
      tool: {
        name: 'web_fetch',
        invocationId: 'call-003',
      },
      inputSummary: 'Fetch PR review details',
      outputSummary: 'Rate limited by upstream API',
      status: 'failed',
    },
  },
];
