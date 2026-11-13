import { RUNNER_BASE_URL } from '@/lib/config';
import { getOwnerKey } from '@/lib/storage';
import { ApiError, RunDetails, RunnerSettings, TestMode } from '@/types/runner';

export function mapRunnerErrorMessage(
  code?: string,
  rawMessage?: string,
  status?: number
): string {
  switch (code) {
    case 'invalid_owner_key':
      return 'Browser key missing. Reload the page and try again.';
    case 'invalid_gemini_key':
      return 'Your Gemini API key was rejected. Check it in Settings.';
    case 'gemini_quota_exceeded':
      return 'Your Gemini free quota is used up. Wait a while or use another key.';
    case 'rate_limited':
      return 'Too many runs. Try again later.';
    case 'invalid_url':
      return 'This URL cannot be tested. Use a public https address. Localhost and private addresses are not supported.';
    case 'runner_busy':
      return rawMessage && rawMessage.trim()
        ? rawMessage.trim()
        : 'The test machine is busy with another run. Try again soon.';
    case 'runner_unavailable':
      return 'The test machine could not be started. Try again later.';
    case 'model_unavailable':
      return rawMessage && rawMessage.trim()
        ? rawMessage.trim()
        : 'The AI model is currently unavailable. Try again later.';
    case 'timeout':
      return 'The test did not finish in time. Please run it again.';
    case 'not_found':
      return 'This run is no longer available';
    default:
      if (status === 404) return 'This run is no longer available';
      if (rawMessage && rawMessage.trim()) return rawMessage.trim();
      return 'An error occurred while communicating with the test service.';
  }
}

async function handleResponseError(res: Response): Promise<never> {
  const status = res.status;
  let responseText = '';
  try {
    responseText = await res.text();
  } catch {
    // ignore
  }

  let errorCode = '';
  let rawMessage = '';

  try {
    const parsed = JSON.parse(responseText);
    if (parsed) {
      if (parsed.error && typeof parsed.error === 'object') {
        errorCode = parsed.error.code || '';
        rawMessage = parsed.error.message || '';
      } else if (typeof parsed.error === 'string') {
        rawMessage = parsed.error;
      }
      if (!errorCode && parsed.code) {
        errorCode = parsed.code;
      }
      if (!rawMessage && parsed.message) {
        rawMessage = parsed.message;
      }
    }
  } catch {
    rawMessage = responseText;
  }

  const mappedMessage = mapRunnerErrorMessage(errorCode, rawMessage, status);

  const error: ApiError = {
    message: mappedMessage,
    code: errorCode || undefined,
    status,
    isAuthError: errorCode === 'invalid_gemini_key' || errorCode === 'invalid_owner_key',
    isRateLimit: errorCode === 'rate_limited' || errorCode === 'gemini_quota_exceeded' || status === 429,
    isNotFound: errorCode === 'not_found' || status === 404,
  };

  throw error;
}

export interface CreateRunPayload {
  url: string;
  command: string;
  mode: TestMode;
  credentials?: { email?: string; password?: string } | null;
}

/**
 * Creates a new test run.
 * POST {RUNNER_BASE_URL}/runs
 * Headers: Content-Type: application/json, X-Gemini-Key: {key}, X-Owner-Key: {ownerKey}
 * Timeout: 60s
 */
export async function createRun(
  settings: RunnerSettings,
  payload: CreateRunPayload
): Promise<{ runId: string }> {
  const geminiKey = (settings.geminiApiKey || '').trim();
  if (!geminiKey) {
    throw {
      message: 'Gemini API key is required. Add your key in Settings.',
      code: 'invalid_gemini_key',
      isAuthError: true,
    } as ApiError;
  }

  const ownerKey = getOwnerKey();
  const targetEndpoint = `${RUNNER_BASE_URL}/runs`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Gemini-Key': geminiKey,
        'X-Owner-Key': ownerKey,
      },
      body: JSON.stringify({
        url: payload.url,
        command: payload.command,
        mode: payload.mode,
        model: (settings.model || '').trim() || 'auto',
        credentials:
          payload.credentials && (payload.credentials.email || payload.credentials.password)
            ? {
                email: payload.credentials.email || '',
                password: payload.credentials.password || '',
              }
            : null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      await handleResponseError(res);
    }

    const data = await res.json();
    if (!data || typeof data.runId !== 'string') {
      throw {
        message: 'Malformed response from test service: Expected { "runId": string }',
        status: res.status,
      } as ApiError;
    }

    return { runId: data.runId };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if ((err as ApiError).message) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw {
        message: 'Request timed out: The test machine took longer than 60 seconds to start.',
        code: 'timeout',
        isNetworkError: true,
      } as ApiError;
    }

    throw {
      message: 'Failed to connect to the test service. Please check your network connection.',
      isNetworkError: true,
    } as ApiError;
  }
}

/**
 * Fetches status and report details of a run.
 * GET {RUNNER_BASE_URL}/runs/{runId}
 * Headers: X-Owner-Key: {ownerKey}
 */
export async function fetchRunDetails(
  settings: RunnerSettings,
  runId: string
): Promise<RunDetails> {
  const ownerKey = getOwnerKey();
  const targetEndpoint = `${RUNNER_BASE_URL}/runs/${encodeURIComponent(runId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(targetEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Owner-Key': ownerKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      await handleResponseError(res);
    }

    const data = await res.json();
    return (data || {}) as RunDetails;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if ((err as ApiError).message) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw {
        message: 'Polling request timed out: Service took too long to return status.',
        isNetworkError: true,
      } as ApiError;
    }

    throw {
      message: 'Network issue while checking test status.',
      isNetworkError: true,
    } as ApiError;
  }
}

/**
 * Requests stopping a test run.
 * POST {RUNNER_BASE_URL}/runs/{runId}/stop
 * Headers: X-Owner-Key: {ownerKey}
 */
export async function stopRun(
  settings: RunnerSettings,
  runId: string
): Promise<void> {
  const ownerKey = getOwnerKey();
  const targetEndpoint = `${RUNNER_BASE_URL}/runs/${encodeURIComponent(runId)}/stop`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Owner-Key': ownerKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      await handleResponseError(res);
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as ApiError).message) {
      throw err;
    }
    throw {
      message: 'Failed to send stop command to the test service.',
      isNetworkError: true,
    } as ApiError;
  }
}
