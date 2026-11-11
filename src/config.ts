import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Required token for bearer authentication
  runnerToken: process.env.RUNNER_TOKEN || 'testpilot-secret-token',

  // Supabase configuration for data and screenshot storage
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Default Gemini model (configurable via env)
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // CORS allowed origin
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',

  // Port configuration (defaults to 7860 for Hugging Face Spaces or process.env.PORT)
  port: parseInt(process.env.PORT || '7860', 10),

  // Step limits per test mode
  stepLimits: {
    smoke: 10,
    user_flow: 20,
    full_qa: 25,
  },

  // Hard execution time limit per run (8 minutes in milliseconds)
  hardTimeLimitMs: 8 * 60 * 1000,
};

/**
 * Redacts any sensitive values (tokens, API keys, passwords) from strings and errors.
 */
export function redactSecrets(text: string, additionalSecrets: (string | undefined)[] = []): string {
  if (!text) return text;
  let sanitized = text;

  const secretsToFilter = [
    config.runnerToken,
    config.supabaseServiceRoleKey,
    ...additionalSecrets,
  ].filter((s): s is string => !!s && s.length >= 4);

  for (const secret of secretsToFilter) {
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escaped, 'gi'), '[REDACTED]');
  }

  // Also redact typical API key and bearer token patterns
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]');
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED_TOKEN]');

  return sanitized;
}
