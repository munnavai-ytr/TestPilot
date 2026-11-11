import { ApiError, RunDetails, RunnerSettings, TestMode } from '@/types/runner';

function cleanBaseUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function getHeaders(token: string, geminiKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }
  if (geminiKey && geminiKey.trim().length > 0) {
    headers['X-Gemini-Key'] = geminiKey.trim();
  }
  return headers;
}

export function mapRunnerErrorMessage(
  code?: string,
  rawMessage?: string,
  status?: number
): string {
  switch (code) {
    case 'invalid_token':
      return 'Runner token is invalid. Check Settings.';
    case 'invalid_gemini_key':
      return 'Your Gemini API key was rejected. Check it in Settings.';
    case 'gemini_quota_exceeded':
      return 'Your Gemini free quota is used up. Wait a while or use another key.';
    case 'rate_limited':
      return 'Too many runs. Wait a minute and try again.';
    case 'invalid_url':
      return 'This URL cannot be tested. Use a public https address.';
    case 'runner_busy':
      return 'The Runner is busy with another test. Try again soon.';
    default:
      if (rawMessage && rawMessage.trim()) return rawMessage.trim();
      if (status === 401) return 'Runner token is invalid. Check Settings.';
      if (status === 429) return 'Too many runs. Wait a minute and try again.';
      if (status === 404) return 'This run is no longer available';
      return 'An error occurred while communicating with the Runner API.';
  }
}

async function handleResponseError(res: Response, baseUrl: string): Promise<never> {
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
    isAuthError: errorCode === 'invalid_token' || errorCode === 'invalid_gemini_key' || status === 401,
    isRateLimit: errorCode === 'rate_limited' || errorCode === 'gemini_quota_exceeded' || status === 429,
    isNotFound: status === 404,
  };

  throw error;
}

export interface CreateRunPayload {
  url: string;
  command: string;
  mode: TestMode;
  credentials?: { email?: string; password?: string } | null;
}

export async function createRun(
  settings: RunnerSettings,
  payload: CreateRunPayload
): Promise<{ runId: string }> {
  const baseUrl = cleanBaseUrl(settings.runnerUrl);
  if (!baseUrl) {
    throw {
      message: 'Runner API URL is not configured. Please add your Runner URL in Settings.',
      isNetworkError: false,
    } as ApiError;
  }

  const targetEndpoint = `${baseUrl}/api/runs`;

  // 60-second timeout for POST /api/runs (accommodates cold start of free runners)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers: getHeaders(settings.accessToken, settings.geminiApiKey),
      body: JSON.stringify({
        url: payload.url,
        command: payload.command,
        mode: payload.mode,
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
      await handleResponseError(res, baseUrl);
    }

    const data = await res.json();
    if (!data || typeof data.runId !== 'string') {
      throw {
        message: 'Malformed response from Runner API: Expected { "runId": string }',
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
        message: 'Request timed out: Runner took longer than 60 seconds to respond.',
        isNetworkError: true,
      } as ApiError;
    }

    throw {
      message: `Failed to connect to Runner at ${baseUrl}. Please check that the URL is accessible, CORS allows this origin, and the runner service is active.`,
      isNetworkError: true,
    } as ApiError;
  }
}

export async function fetchRunDetails(
  settings: RunnerSettings,
  runId: string
): Promise<RunDetails> {
  const baseUrl = cleanBaseUrl(settings.runnerUrl);
  if (!baseUrl) {
    throw {
      message: 'Runner API URL is not configured.',
    } as ApiError;
  }

  const targetEndpoint = `${baseUrl}/api/runs/${encodeURIComponent(runId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(targetEndpoint, {
      method: 'GET',
      headers: getHeaders(settings.accessToken, settings.geminiApiKey),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      await handleResponseError(res, baseUrl);
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
        message: 'Polling request timed out: Runner took too long to return status.',
        isNetworkError: true,
      } as ApiError;
    }

    throw {
      message: `Failed to poll run ${runId} from ${baseUrl}. Network or CORS issue.`,
      isNetworkError: true,
    } as ApiError;
  }
}

export async function stopRun(
  settings: RunnerSettings,
  runId: string
): Promise<void> {
  const baseUrl = cleanBaseUrl(settings.runnerUrl);
  if (!baseUrl) return;

  const targetEndpoint = `${baseUrl}/api/runs/${encodeURIComponent(runId)}/stop`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers: getHeaders(settings.accessToken, settings.geminiApiKey),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      await handleResponseError(res, baseUrl);
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as ApiError).message) {
      throw err;
    }
    throw {
      message: `Failed to send stop command to Runner at ${baseUrl}.`,
      isNetworkError: true,
    } as ApiError;
  }
}

export async function testRunnerConnection(
  settings: RunnerSettings
): Promise<{ ok: boolean; message: string }> {
  const baseUrl = cleanBaseUrl(settings.runnerUrl);
  if (!baseUrl) {
    return { ok: false, message: 'Please enter a Runner API URL first.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${baseUrl}/api/runs`, {
      method: 'OPTIONS',
      headers: getHeaders(settings.accessToken, settings.geminiApiKey),
      signal: controller.signal,
    }).catch(async () => {
      return await fetch(`${baseUrl}`, {
        method: 'GET',
        headers: getHeaders(settings.accessToken, settings.geminiApiKey),
        signal: controller.signal,
      });
    });

    clearTimeout(timeoutId);

    if (res && (res.ok || res.status === 405 || res.status === 401 || res.status === 204)) {
      if (res.status === 401 && !settings.accessToken) {
        return {
          ok: false,
          message: 'Runner reached, but requires an Access Token (401 Unauthorized).',
        };
      }
      return { ok: true, message: `Connected successfully to Runner at ${baseUrl}.` };
    }

    return {
      ok: false,
      message: `Runner responded with HTTP ${res?.status || 'unknown'}. Please verify URL and credentials.`,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      ok: false,
      message: `Connection failed: ${err.message || 'Network error or CORS restriction'}. Make sure the Runner server is running and accessible.`,
    };
  }
}
