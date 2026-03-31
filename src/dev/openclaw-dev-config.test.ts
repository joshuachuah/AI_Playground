import assert from 'node:assert/strict';
import test from 'node:test';

import { readOpenClawDevConnectionConfig, readOpenClawDevConnectionConfigFromEnv } from './openclaw-dev-config.js';

test('defaults to fixture mode when no OpenClaw env config is provided', () => {
  const result = readOpenClawDevConnectionConfigFromEnv({});

  assert.deepEqual(result.config, { mode: 'fixture' });
  assert.deepEqual(result.warnings, []);
});

test('reads SSE mode from env when a URL is present', () => {
  const result = readOpenClawDevConnectionConfigFromEnv({
    OPENCLAW_TRANSPORT: 'sse',
    OPENCLAW_SSE_URL: 'http://localhost:4318/runtime',
  });

  assert.deepEqual(result.config, {
    mode: 'sse',
    sseUrl: 'http://localhost:4318/runtime',
  });
  assert.deepEqual(result.warnings, []);
});

test('falls back to fixture mode when ws mode is missing a URL', () => {
  const result = readOpenClawDevConnectionConfig({
    mode: 'ws',
  });

  assert.deepEqual(result.config, { mode: 'fixture' });
  assert.match(result.warnings[0] ?? '', /OPENCLAW_TRANSPORT=ws/);
});

test('warns when an unsupported transport mode is configured', () => {
  const result = readOpenClawDevConnectionConfigFromEnv({
    OPENCLAW_TRANSPORT: 'ssee',
  });

  assert.deepEqual(result.config, { mode: 'fixture' });
  assert.match(result.warnings[0] ?? '', /Unsupported OPENCLAW_TRANSPORT=ssee/);
});
