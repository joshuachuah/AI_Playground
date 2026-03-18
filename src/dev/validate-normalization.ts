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
assert(visualized.some((event) => event.type === 'actor.tool.started' && event.ui?.label === 'web_search'), 'expected translator to emit research tool visual event');
assert(visualized.some((event) => event.type === 'session.summary.updated' && event.ui?.label === 'gpt-5.4'), 'expected translator to expose OpenAI model metadata in visual events');
assert(visualized.some((event) => event.type === 'actor.tool.completed' && event.ui?.label === 'write'), 'expected translator to emit tool completion visual event');

console.log(`Validated ${normalized.length} normalized events and ${visualized.length} visual events.`);
