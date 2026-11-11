import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, redactSecrets } from './config';
import { Bug, RunError, RunRecord, RunStatus, Step } from './types';

let supabaseClient: SupabaseClient | null = null;

// In-memory fallback cache when Supabase credentials are not provided or for fast access
const memoryRuns = new Map<string, RunRecord>();
const memoryScreenshots = new Map<string, Buffer>();

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('[Supabase] Failed to initialize client:', redactSecrets(String(err)));
    }
  }

  return supabaseClient;
}

/**
 * On startup: Marks any run still marked as "running" as "failed"
 * with error { code: "runner_restarted", message: "The Runner restarted during this test." }
 */
export async function reconcileRunningRunsOnStartup(): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    // Reconcile memory runs
    for (const [id, run] of memoryRuns.entries()) {
      if (run.status === 'running') {
        memoryRuns.set(id, {
          ...run,
          status: 'failed',
          error: {
            code: 'runner_restarted',
            message: 'The Runner restarted during this test.',
          },
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return;
  }

  try {
    const { error } = await sb
      .from('runs')
      .update({
        status: 'failed',
        error: {
          code: 'runner_restarted',
          message: 'The Runner restarted during this test.',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'running');

    if (error) {
      console.warn('[Supabase] Startup reconciliation notice:', redactSecrets(error.message));
    } else {
      console.log('[Supabase] Startup reconciliation complete.');
    }
  } catch (err) {
    console.warn('[Supabase] Could not reconcile interrupted runs:', redactSecrets(String(err)));
  }
}

/**
 * Inserts a new run record into Supabase (and memory cache).
 * NEVER stores the Gemini key or credentials.
 */
export async function createRunRow(run: RunRecord): Promise<void> {
  memoryRuns.set(run.id, { ...run });

  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error } = await sb.from('runs').insert({
      id: run.id,
      url: run.url,
      command: run.command,
      mode: run.mode,
      status: run.status,
      steps: run.steps,
      bugs: run.bugs,
      score: run.score,
      error: run.error,
      created_at: run.createdAt,
      updated_at: run.updatedAt,
    });

    if (error) {
      console.warn('[Supabase] createRunRow error:', redactSecrets(error.message));
    }
  } catch (err) {
    console.warn('[Supabase] createRunRow exception:', redactSecrets(String(err)));
  }
}

/**
 * Updates a run after every single step.
 */
export async function updateRunStepRow(
  runId: string,
  steps: Step[],
  status?: RunStatus,
  error?: RunError | null
): Promise<void> {
  const existing = memoryRuns.get(runId);
  const now = new Date().toISOString();

  if (existing) {
    existing.steps = steps;
    if (status) existing.status = status;
    if (error !== undefined) existing.error = error;
    existing.updatedAt = now;
    memoryRuns.set(runId, existing);
  }

  const sb = getSupabase();
  if (!sb) return;

  try {
    const updatePayload: Record<string, any> = {
      steps,
      updated_at: now,
    };
    if (status) updatePayload.status = status;
    if (error !== undefined) updatePayload.error = error;

    const { error: sbError } = await sb.from('runs').update(updatePayload).eq('id', runId);
    if (sbError) {
      console.warn('[Supabase] updateRunStepRow error:', redactSecrets(sbError.message));
    }
  } catch (err) {
    console.warn('[Supabase] updateRunStepRow exception:', redactSecrets(String(err)));
  }
}

/**
 * Finalizes a completed, failed, or stopped run.
 */
export async function finalizeRunRow(
  runId: string,
  data: {
    status: RunStatus;
    steps: Step[];
    bugs: Bug[];
    score: number;
    error?: RunError | null;
  }
): Promise<void> {
  const existing = memoryRuns.get(runId);
  const now = new Date().toISOString();

  if (existing) {
    existing.status = data.status;
    existing.steps = data.steps;
    existing.bugs = data.bugs;
    existing.score = data.score;
    if (data.error !== undefined) existing.error = data.error;
    existing.updatedAt = now;
    memoryRuns.set(runId, existing);
  }

  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error: sbError } = await sb
      .from('runs')
      .update({
        status: data.status,
        steps: data.steps,
        bugs: data.bugs,
        score: data.score,
        error: data.error || null,
        updated_at: now,
      })
      .eq('id', runId);

    if (sbError) {
      console.warn('[Supabase] finalizeRunRow error:', redactSecrets(sbError.message));
    }
  } catch (err) {
    console.warn('[Supabase] finalizeRunRow exception:', redactSecrets(String(err)));
  }
}

/**
 * Retrieves a run by ID from Supabase, or in-memory fallback.
 */
export async function getRunRow(runId: string): Promise<RunRecord | null> {
  const sb = getSupabase();
  if (!sb) {
    return memoryRuns.get(runId) || null;
  }

  try {
    const { data, error } = await sb.from('runs').select('*').eq('id', runId).maybeSingle();

    if (error || !data) {
      return memoryRuns.get(runId) || null;
    }

    const record: RunRecord = {
      id: data.id,
      url: data.url,
      command: data.command,
      mode: data.mode,
      status: data.status,
      steps: Array.isArray(data.steps) ? data.steps : [],
      bugs: Array.isArray(data.bugs) ? data.bugs : [],
      score: typeof data.score === 'number' ? data.score : 100,
      error: data.error || null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    memoryRuns.set(runId, record);
    return record;
  } catch {
    return memoryRuns.get(runId) || null;
  }
}

/**
 * Uploads a step screenshot JPEG buffer to Supabase Storage bucket 'screenshots' at {runId}/{stepIndex}.jpg
 * and returns its public HTTPS URL.
 */
export async function uploadScreenshot(
  runId: string,
  stepIndex: number,
  jpegBuffer: Buffer
): Promise<string> {
  const path = `${runId}/${stepIndex}.jpg`;

  // Always store in memory cache
  memoryScreenshots.set(path, jpegBuffer);

  const sb = getSupabase();
  if (!sb) {
    // Return base64 data URI fallback if Supabase storage is not yet connected
    return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
  }

  try {
    const { error } = await sb.storage.from('screenshots').upload(path, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (error) {
      console.warn(`[Supabase Storage] Upload error at ${path}:`, redactSecrets(error.message));
      return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
    }

    const { data } = sb.storage.from('screenshots').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn(`[Supabase Storage] Exception at ${path}:`, redactSecrets(String(err)));
    return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
  }
}
