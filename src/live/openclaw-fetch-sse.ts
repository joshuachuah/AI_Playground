import type { OpenClawAdapter } from '../adapters/openclaw.js';
import type { RuntimeEventEnvelope } from './transport.js';
import { emitNormalizedOpenClawEvents, parseOpenClawEventEnvelope } from './openclaw-transport.js';

export interface OpenClawFetchSseRuntimeEventSourceConfig {
  url: string;
  adapter: OpenClawAdapter;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface OpenClawFetchSseRuntimeEventSource {
  stream(signal: AbortSignal): AsyncIterable<RuntimeEventEnvelope>;
}

export function createOpenClawFetchSseRuntimeEventSource(
  config: OpenClawFetchSseRuntimeEventSourceConfig,
): OpenClawFetchSseRuntimeEventSource {
  const fetchImpl = config.fetch ?? fetch;

  return {
    async *stream(signal: AbortSignal): AsyncIterable<RuntimeEventEnvelope> {
      const response = await fetchImpl(config.url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...config.headers,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`OpenClaw SSE request failed with ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('OpenClaw SSE response did not include a body stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            buffer += decoder.decode();
            yield* normalizeSseChunks(buffer, config.adapter);
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = splitSseBuffer(buffer);
          buffer = parsed.remainder;
          yield* normalizeSseChunks(parsed.messages, config.adapter);
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

function* normalizeSseChunks(
  messages: string | readonly string[],
  adapter: OpenClawAdapter,
): Generator<RuntimeEventEnvelope> {
  const chunks = Array.isArray(messages) ? messages : [messages];

  for (const chunk of chunks) {
    if (chunk.trim().length === 0) continue;

    const data = readSseData(chunk);
    if (!data) continue;

    const events: RuntimeEventEnvelope[] = [];
    const envelope = parseOpenClawEventEnvelope(data);
    emitNormalizedOpenClawEvents(envelope.event, adapter, {
      onRuntimeEvent(event) {
        events.push({ event });
      },
    });

    for (const event of events) {
      yield event;
    }
  }
}

function splitSseBuffer(buffer: string): { messages: string[]; remainder: string } {
  const normalized = buffer.replaceAll('\r\n', '\n');
  const parts = normalized.split('\n\n');

  if (parts.length === 1) {
    return {
      messages: [],
      remainder: normalized,
    };
  }

  return {
    messages: parts.slice(0, -1),
    remainder: parts.at(-1) ?? '',
  };
}

function readSseData(chunk: string): string | null {
  const lines = chunk.split('\n');
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join('\n');
}
