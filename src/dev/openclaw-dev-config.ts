export type OpenClawDevSourceMode = 'fixture' | 'sse' | 'ws';

export interface OpenClawDevConnectionConfig {
  mode: OpenClawDevSourceMode;
  sseUrl?: string;
  wsUrl?: string;
}

export interface ReadOpenClawDevConnectionConfigResult {
  config: OpenClawDevConnectionConfig;
  warnings: string[];
}

const DEFAULT_FIXTURE_CONFIG: OpenClawDevConnectionConfig = {
  mode: 'fixture',
};

export function readOpenClawDevConnectionConfigFromEnv(
  env: Record<string, string | undefined>,
): ReadOpenClawDevConnectionConfigResult {
  const mode = normalizeMode(env.OPENCLAW_TRANSPORT ?? env.AI_PLAYGROUND_OPENCLAW_TRANSPORT);
  const sseUrl = readNonEmptyString(env.OPENCLAW_SSE_URL ?? env.AI_PLAYGROUND_OPENCLAW_SSE_URL);
  const wsUrl = readNonEmptyString(env.OPENCLAW_WS_URL ?? env.AI_PLAYGROUND_OPENCLAW_WS_URL);

  if (!mode) {
    return {
      config: DEFAULT_FIXTURE_CONFIG,
      warnings: [],
    };
  }

  return finalizeConfig({ mode, sseUrl, wsUrl });
}

export function readOpenClawDevConnectionConfig(
  value: unknown,
): ReadOpenClawDevConnectionConfigResult {
  if (!value || typeof value !== 'object') {
    return {
      config: DEFAULT_FIXTURE_CONFIG,
      warnings: [],
    };
  }

  const record = value as Record<string, unknown>;
  const mode = normalizeMode(record.mode);
  const sseUrl = readNonEmptyString(record.sseUrl);
  const wsUrl = readNonEmptyString(record.wsUrl);

  if (!mode) {
    return {
      config: DEFAULT_FIXTURE_CONFIG,
      warnings: [],
    };
  }

  return finalizeConfig({ mode, sseUrl, wsUrl });
}

function finalizeConfig(config: OpenClawDevConnectionConfig): ReadOpenClawDevConnectionConfigResult {
  switch (config.mode) {
    case 'fixture':
      return {
        config: compactConfig(config),
        warnings: [],
      };

    case 'sse':
      if (config.sseUrl) {
        return {
          config: compactConfig(config),
          warnings: [],
        };
      }

      return {
        config: DEFAULT_FIXTURE_CONFIG,
        warnings: ['OPENCLAW_TRANSPORT=sse was set without OPENCLAW_SSE_URL, falling back to fixture mode.'],
      };

    case 'ws':
      if (config.wsUrl) {
        return {
          config,
          warnings: [],
        };
      }

      return {
        config: DEFAULT_FIXTURE_CONFIG,
        warnings: ['OPENCLAW_TRANSPORT=ws was set without OPENCLAW_WS_URL, falling back to fixture mode.'],
      };
  }
}

function compactConfig(config: OpenClawDevConnectionConfig): OpenClawDevConnectionConfig {
  return {
    mode: config.mode,
    ...(config.sseUrl ? { sseUrl: config.sseUrl } : {}),
    ...(config.wsUrl ? { wsUrl: config.wsUrl } : {}),
  };
}

function normalizeMode(value: unknown): OpenClawDevSourceMode | undefined {
  if (typeof value !== 'string') return undefined;

  switch (value.trim().toLowerCase()) {
    case 'fixture':
      return 'fixture';
    case 'sse':
      return 'sse';
    case 'ws':
    case 'websocket':
      return 'ws';
    default:
      return undefined;
  }
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
