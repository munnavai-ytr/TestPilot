/**
 * Global application configuration for TestPilot client.
 * Uses NEXT_PUBLIC_RUNNER_URL if configured, otherwise defaults to the hosted endpoint.
 */
const rawUrl =
  process.env.NEXT_PUBLIC_RUNNER_URL ||
  'https://trkbrobktbebpnfxshaw.supabase.co/functions/v1/api';

export const RUNNER_BASE_URL = rawUrl.trim().replace(/\/+$/, '');
