import { openClawFixtureEvents, OpenClawRuntimeNormalizer, OpenClawRuntimeTranslator } from '../index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const normalizer = new OpenClawRuntimeNormalizer();
const translator = new OpenClawRuntimeTranslator();

const normalized = openClawFixtureEvents.map((fixture) => normalizer.normalize(fixture));
const visualized = normalized.flatMap((event) => translator.translate(event));

assert(normalized[0]?.kind === 'session.started', 'expected run.started fixture to normalize to session.started');
assert(normalized[1]?.kind === 'tool.started', 'expected tool.invoked fixture to normalize to tool.started');
assert(
  (normalized[1]?.payload as { tool?: { name?: string } } | undefined)?.tool?.name === 'web_search',
  'expected web_search tool name to survive normalization',
);
assert(normalized[2]?.kind === 'task.progressed', 'expected task.updated fixture to normalize to task.progressed');
assert(normalized[3]?.kind === 'model.response.delta', 'expected streaming response fixture to normalize to model.response.delta');
assert(normalized[3]?.openai?.usage?.totalTokens === 640, 'expected OpenAI usage metadata to normalize');
assert(normalized[4]?.kind === 'tool.completed', 'expected tool completion fixture to normalize to tool.completed');
assert(normalized[5]?.kind === 'model.response.completed', 'expected response.completed fixture to normalize to model.response.completed');
assert(normalized[6]?.kind === 'tool.failed', 'expected tool.failed fixture to normalize to tool.failed');

assert(visualized.some((event) => event.type === 'actor.tool.started' && event.ui?.label === 'web_search'), 'expected translator to emit research tool visual event');
assert(visualized.some((event) => event.type === 'session.summary.updated' && event.ui?.label === 'gpt-5.4'), 'expected translator to expose OpenAI model metadata in visual events');
assert(visualized.some((event) => event.type === 'actor.tool.completed' && event.ui?.label === 'write'), 'expected translator to emit tool completion visual event');
assert(
  visualized.some(
    (event) =>
      event.type === 'actor.error' &&
      event.ui?.label === 'web_fetch' &&
      event.ui?.detail === 'Rate limited by upstream API' &&
      event.ui?.severity === 'error',
  ),
  'expected translator to emit tool failure as actor.error visual event',
);

const failedResponseEvent = normalizer.normalize({
  type: 'response.failed',
  session_id: 'session-live-001',
  timestamp: '2026-03-18T14:00:15.000Z',
  response: { id: 'resp_failed_1' },
  message: 'Upstream model request failed',
});
assert(failedResponseEvent.kind === 'error', 'expected response.failed fixture to normalize to error');

const collisionTimestamp = '2026-03-18T14:01:00.000Z';
const firstFallbackId = normalizer.normalize({
  session_id: 'session-live-001',
  timestamp: collisionTimestamp,
  type: 'task.updated',
  task: { id: 'task-a', title: 'A' },
}).id;
const secondFallbackId = normalizer.normalize({
  session_id: 'session-live-001',
  timestamp: collisionTimestamp,
  type: 'task.updated',
  task: { id: 'task-b', title: 'B' },
}).id;
assert(firstFallbackId !== secondFallbackId, 'expected synthesized fallback IDs to avoid collisions');

console.log(`Validated ${normalized.length} normalized events and ${visualized.length} visual events.`);
