/**
 * Type-safe environment variable access.
 * Required vars throw at startup if missing.
 * Optional vars return undefined.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[env] Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] ?? undefined;
}

let _cachedPrivateKey: string | undefined;

// ── Security ──────────────────────────────────────────────────────────────────
export const env = {
  // Auth
  get ADMIN_PASSWORD() { return requireEnv('ADMIN_PASSWORD'); },
  get JWT_SECRET() { return requireEnv('JWT_SECRET'); },
  get CRON_SECRET() { return requireEnv('CRON_SECRET'); },

  // Vercel KV
  get KV_REST_API_URL() { return requireEnv('KV_REST_API_URL'); },
  get KV_REST_API_TOKEN() { return requireEnv('KV_REST_API_TOKEN'); },

  // Encryption
  get ENCRYPTION_KEY() { return requireEnv('ENCRYPTION_KEY'); },

  // Google Service Account
  get GOOGLE_CLIENT_EMAIL() { return requireEnv('GOOGLE_CLIENT_EMAIL'); },
  get GOOGLE_PRIVATE_KEY() {
    if (!_cachedPrivateKey) {
      _cachedPrivateKey = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
    }
    return _cachedPrivateKey;
  },

  // Google Maps
  get GOOGLE_MAPS_API_KEY() { return requireEnv('GOOGLE_MAPS_API_KEY'); },

  // AI
  get GEMINI_API_KEY() { return requireEnv('GEMINI_API_KEY'); },

  // Telegram
  get TELEGRAM_BOT_TOKEN() { return requireEnv('TELEGRAM_BOT_TOKEN'); },

  // Dynamic per-project env lookups (not required at startup)
  getOptional: optionalEnv,
  getRequired: requireEnv,
} as const;
