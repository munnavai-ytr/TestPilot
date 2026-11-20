import { getStoredSettings } from '@/lib/storage';
import { getStudioSettings } from './store';

const EXCLUDED_SUBSTRINGS = [
  'lite',
  'image',
  'tts',
  'live',
  'audio',
  'embedding',
  'imagen',
  'robotics',
  'computer-use',
  'native',
  'exp',
  '8b',
  'learnlm',
];

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export class StudioGeminiError extends Error {
  status?: number;
  isAuthError?: boolean;
  isQuotaError?: boolean;
  isNetworkError?: boolean;
  isAborted?: boolean;

  constructor(
    message: string,
    opts: {
      status?: number;
      isAuthError?: boolean;
      isQuotaError?: boolean;
      isNetworkError?: boolean;
      isAborted?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'StudioGeminiError';
    this.status = opts.status;
    this.isAuthError = opts.isAuthError;
    this.isQuotaError = opts.isQuotaError;
    this.isNetworkError = opts.isNetworkError;
    this.isAborted = opts.isAborted;
  }
}

function parseVersion(id: string): { major: number; minor: number } {
  const match = id.match(/gemini-(\d+)(?:\.(\d+))?/i);
  if (!match) return { major: 0, minor: 0 };
  return {
    major: parseInt(match[1], 10) || 0,
    minor: match[2] ? parseInt(match[2], 10) || 0 : 0,
  };
}

export function filterAndSortStudioFlashModels(rawModels: unknown[]): string[] {
  const ids: string[] = [];

  for (const item of rawModels) {
    if (!item || typeof item !== 'object') continue;
    const m = item as { name?: unknown; supportedGenerationMethods?: unknown };
    if (typeof m.name !== 'string' || !m.name.startsWith('models/')) continue;
    if (
      !Array.isArray(m.supportedGenerationMethods) ||
      !m.supportedGenerationMethods.includes('generateContent')
    ) {
      continue;
    }

    const id = m.name.slice('models/'.length).trim();
    const lower = id.toLowerCase();
    if (!lower.startsWith('gemini-') || !lower.includes('flash')) continue;
    if (EXCLUDED_SUBSTRINGS.some((sub) => lower.includes(sub))) continue;

    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  ids.sort((a, b) => {
    const verA = parseVersion(a);
    const verB = parseVersion(b);
    if (verA.major !== verB.major) return verB.major - verA.major;
    if (verA.minor !== verB.minor) return verB.minor - verA.minor;

    const prevA = a.toLowerCase().includes('preview');
    const prevB = b.toLowerCase().includes('preview');
    if (prevA !== prevB) return prevA ? 1 : -1;

    return a.localeCompare(b);
  });

  return ids;
}

// In-memory cache of resolved working model (cleared if key fingerprint changes)
let cachedModelId: string | null = null;
let cachedModelList: string[] = [];
let cachedKeyTag: string | null = null;
let lastGeminiCallAt = 0;

function computeSimpleTag(key: string): string {
  // Non-reversible short length+char tag so raw key is never kept in cache variables
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return `${key.length}:${hash}`;
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new StudioGeminiError('Stopped.', { isAborted: true }));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new StudioGeminiError('Stopped.', { isAborted: true }));
    };
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function parseRetryDelayMs(errBodyText: string): number {
  try {
    const parsed = JSON.parse(errBodyText);
    const details = parsed?.error?.details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        if (detail && typeof detail.retryDelay === 'string') {
          const match = detail.retryDelay.match(/([\d.]+)s/);
          if (match) {
            const sec = parseFloat(match[1]);
            if (Number.isFinite(sec) && sec > 0) {
              return Math.min(60000, Math.ceil(sec * 1000));
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return 8000;
}

function stripCodeFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '');
    text = text.replace(/\s*```$/i, '');
  }
  return text.trim();
}

function tryParseJson<T>(raw: string): T | null {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt extracting outermost JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface StudioGeminiHooks {
  onRequestUsed?: () => void;
  onQuotaWait?: (delayMs: number, attempt: number) => void;
}

async function resolveCandidateModels(key: string, signal?: AbortSignal): Promise<string[]> {
  const stored = getStoredSettings();
  const preferred = (stored.model || 'auto').trim();
  const keyTag = computeSimpleTag(key);

  if (cachedKeyTag !== keyTag) {
    cachedModelId = null;
    cachedModelList = [];
    cachedKeyTag = keyTag;
  }

  if (preferred && preferred !== 'auto') {
    return [preferred];
  }

  if (cachedModelId) {
    const rest = cachedModelList.filter((m) => m !== cachedModelId);
    return [cachedModelId, ...rest];
  }

  let res: Response;
  try {
    res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      {
        method: 'GET',
        headers: {
          'x-goog-api-key': key,
        },
        signal,
      }
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new StudioGeminiError('Stopped.', { isAborted: true });
    }
    throw new StudioGeminiError(
      'Could not reach the Gemini API. Check your internet connection.',
      { isNetworkError: true }
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (
      res.status === 401 ||
      res.status === 403 ||
      (res.status === 400 && /api key not valid/i.test(text))
    ) {
      throw new StudioGeminiError(
        'Your Gemini API key was rejected. Check it in Settings.',
        { status: res.status, isAuthError: true }
      );
    }
    if (res.status === 429) {
      throw new StudioGeminiError(
        'Gemini API rate limit reached while listing models. Try again shortly.',
        { status: 429, isQuotaError: true }
      );
    }
    throw new StudioGeminiError(
      `Failed to fetch available Gemini models (HTTP ${res.status}).`,
      { status: res.status }
    );
  }

  const json = await res.json().catch(() => ({}));
  const models = filterAndSortStudioFlashModels(Array.isArray(json?.models) ? json.models : []);
  if (models.length === 0) {
    throw new StudioGeminiError(
      'No compatible Gemini Flash models were found for your key.',
      { isAuthError: false }
    );
  }

  cachedModelList = models;
  return models;
}

export async function generateJson<T = unknown>(
  params: {
    system: string;
    userParts: GeminiPart[];
    schema: Record<string, unknown>;
    temperature?: number;
    signal?: AbortSignal;
  },
  hooks: StudioGeminiHooks = {}
): Promise<T> {
  const settings = getStoredSettings();
  const key = (settings.geminiApiKey || '').trim();
  if (!key) {
    throw new StudioGeminiError(
      'Your Gemini API key is missing. Add it in Settings.',
      { isAuthError: true }
    );
  }

  const studioSettings = getStudioSettings();
  const minDelayMs = Math.max(0, studioSettings.minDelayMs ?? 1200);

  const candidates = await resolveCandidateModels(key, params.signal);

  let lastError: Error | null = null;

  for (const modelId of candidates) {
    let parseRetries = 0;

    while (parseRetries <= 1) {
      const userPartsToSend: GeminiPart[] =
        parseRetries === 0
          ? params.userParts
          : [
              ...params.userParts,
              {
                text: 'IMPORTANT: Your previous response could not be parsed as JSON. Return ONLY valid JSON matching the requested schema, with no markdown fences or extra text.',
              },
            ];

      let quotaAttempt = 0;
      let rawResponseText: string | null = null;
      let shouldTryNextModel = false;

      while (quotaAttempt <= 4) {
        if (params.signal?.aborted) {
          throw new StudioGeminiError('Stopped.', { isAborted: true });
        }

        const elapsedSinceLast = Date.now() - lastGeminiCallAt;
        if (minDelayMs > 0 && lastGeminiCallAt > 0 && elapsedSinceLast < minDelayMs) {
          await sleepWithAbort(minDelayMs - elapsedSinceLast, params.signal);
        }

        lastGeminiCallAt = Date.now();
        hooks.onRequestUsed?.();

        let res: Response;
        try {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
              modelId
            )}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': key,
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: params.system }],
                },
                contents: [
                  {
                    role: 'user',
                    parts: userPartsToSend,
                  },
                ],
                generationConfig: {
                  responseMimeType: 'application/json',
                  responseSchema: params.schema,
                  temperature: params.temperature ?? 0.3,
                  maxOutputTokens: 4096,
                },
              }),
              signal: params.signal,
            }
          );
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw new StudioGeminiError('Stopped.', { isAborted: true });
          }
          throw new StudioGeminiError(
            'Could not reach Gemini API. Check your internet connection.',
            { isNetworkError: true }
          );
        }

        if (res.status === 429) {
          const errText = await res.text().catch(() => '');
          if (quotaAttempt >= 4) {
            throw new StudioGeminiError(
              'Gemini quota limit reached after 4 retries. Wait a moment and resume.',
              { status: 429, isQuotaError: true }
            );
          }
          const delayMs = parseRetryDelayMs(errText);
          quotaAttempt += 1;
          hooks.onQuotaWait?.(delayMs, quotaAttempt);
          await sleepWithAbort(delayMs, params.signal);
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          if (
            res.status === 401 ||
            res.status === 403 ||
            /api key not valid/i.test(errText)
          ) {
            throw new StudioGeminiError(
              'Your Gemini API key was rejected. Check it in Settings.',
              { status: res.status, isAuthError: true }
            );
          }

          if (res.status === 404 || res.status === 400) {
            // If preferred is auto and there are more candidate models, try next model
            if (candidates.length > 1) {
              shouldTryNextModel = true;
              lastError = new StudioGeminiError(
                `Model ${modelId} returned HTTP ${res.status}.`,
                { status: res.status }
              );
              break;
            }
          }

          throw new StudioGeminiError(
            `Gemini request failed (HTTP ${res.status}).`,
            { status: res.status }
          );
        }

        const data = await res.json().catch(() => ({}));
        const candidateText =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : ''))
            .join('') || '';

        rawResponseText = candidateText;
        cachedModelId = modelId;
        break;
      }

      if (shouldTryNextModel) {
        break;
      }

      if (rawResponseText !== null) {
        const parsed = tryParseJson<T>(rawResponseText);
        if (parsed !== null) {
          return parsed;
        }
      }

      parseRetries += 1;
    }
  }

  throw (
    lastError ||
    new StudioGeminiError('Gemini returned an invalid response. Please try again.')
  );
}

export function dataUrlToInlinePart(dataUrl: string): GeminiPart | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
}
