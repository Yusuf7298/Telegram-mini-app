// Simple feature flag module with optional Redis override for runtime toggles.
// Flags default to environment variables `FF_<NAME>` or a JSON object in `FEATURE_FLAGS` env.

type FlagValue = boolean | string | number | null;

let redisClient: any = null;
let redisConnected = false;

function parseDefaults(): Record<string, FlagValue> {
  try {
    const raw = process.env.FEATURE_FLAGS;
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const DEFAULT_FLAGS = parseDefaults();

async function initRedisIfConfigured() {
  if (redisConnected) return;
  const url = process.env.REDIS_URL?.trim();
  if (!url) return;
  try {
    // Lazy require so repo doesn't fail if redis package not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('redis');
    redisClient = Redis.createClient({ url });
    redisClient.on('error', () => {});
    await redisClient.connect();
    redisConnected = true;
  } catch (err) {
    // If Redis is not available, fall back to env/defaults
    redisClient = null;
    redisConnected = false;
  }
}

function envFlagName(flag: string) {
  return `FF_${flag.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

export async function isFeatureEnabled(flag: string): Promise<boolean> {
  await initRedisIfConfigured();
  // Check Redis override first
  if (redisClient) {
    try {
      const val = await redisClient.get(`flag:${flag}`);
      if (val !== null && val !== undefined) {
        return val === '1' || val === 'true';
      }
    } catch {
      // ignore redis errors
    }
  }

  // Check explicit env var `FF_<NAME>`
  const envName = envFlagName(flag);
  const envVal = process.env[envName];
  if (envVal !== undefined) {
    return envVal === '1' || envVal.toLowerCase() === 'true';
  }

  // Fallback to JSON defaults
  const def = DEFAULT_FLAGS[flag];
  if (def === undefined || def === null) return false;
  if (typeof def === 'boolean') return def;
  if (typeof def === 'string') return def === '1' || def.toLowerCase() === 'true';
  if (typeof def === 'number') return def !== 0;
  return false;
}

export async function setFeatureFlag(flag: string, enabled: boolean, ttlSeconds?: number) {
  await initRedisIfConfigured();
  if (!redisClient) {
    // Fallback: set in-memory default (not persistent across restarts)
    DEFAULT_FLAGS[flag] = enabled;
    return true;
  }
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.setEx(`flag:${flag}`, ttlSeconds, enabled ? '1' : '0');
    } else {
      await redisClient.set(`flag:${flag}`, enabled ? '1' : '0');
    }
    return true;
  } catch {
    return false;
  }
}

export async function clearFeatureFlag(flag: string) {
  await initRedisIfConfigured();
  if (!redisClient) {
    delete DEFAULT_FLAGS[flag];
    return true;
  }
  try {
    await redisClient.del(`flag:${flag}`);
    return true;
  } catch {
    return false;
  }
}

export async function disconnectFeatureFlags() {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.quit();
  } catch {
    try {
      await redisClient.disconnect();
    } catch {
      // ignore cleanup errors
    }
  } finally {
    redisClient = null;
    redisConnected = false;
  }
}

export default {
  isFeatureEnabled,
  setFeatureFlag,
  clearFeatureFlag,
  disconnectFeatureFlags,
};
