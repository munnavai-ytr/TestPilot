import { RunStatus, RunnerSettings, StoredRun } from '@/types/runner';

const SETTINGS_KEY = 'testpilot_runner_settings';
const HISTORY_KEY = 'testpilot_runs_history';
const THEME_KEY = 'testpilot_theme';

const OWNER_KEY_STORAGE_KEY = 'testpilot_owner_key';
let inMemoryOwnerKey = '';

const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateRandomKey(length = 48): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += ALPHANUMERIC_CHARS[bytes[i] % ALPHANUMERIC_CHARS.length];
    }
    return result;
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC_CHARS[Math.floor(Math.random() * ALPHANUMERIC_CHARS.length)];
  }
  return result;
}

export function getOwnerKey(): string {
  if (typeof window === 'undefined') {
    if (!inMemoryOwnerKey) {
      inMemoryOwnerKey = generateRandomKey(48);
    }
    return inMemoryOwnerKey;
  }

  try {
    const existing = window.localStorage.getItem(OWNER_KEY_STORAGE_KEY);
    if (existing && existing.trim().length >= 24) {
      return existing.trim();
    }
    const fresh = generateRandomKey(48);
    window.localStorage.setItem(OWNER_KEY_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    if (!inMemoryOwnerKey) {
      inMemoryOwnerKey = generateRandomKey(48);
    }
    return inMemoryOwnerKey;
  }
}

export function getStoredSettings(): RunnerSettings {
  if (typeof window === 'undefined') {
    return { geminiApiKey: '', model: 'auto' };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { geminiApiKey: '', model: 'auto' };
    const parsed = JSON.parse(raw);
    return {
      geminiApiKey: typeof parsed?.geminiApiKey === 'string' ? parsed.geminiApiKey.trim() : '',
      model:
        typeof parsed?.model === 'string' && parsed.model.trim().length > 0
          ? parsed.model.trim()
          : 'auto',
    };
  } catch {
    return { geminiApiKey: '', model: 'auto' };
  }
}

export function saveStoredSettings(settings: RunnerSettings): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        geminiApiKey: (settings.geminiApiKey || '').trim(),
        model: (settings.model || '').trim() || 'auto',
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function getStoredHistory(): StoredRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Normalize and ensure never storing screenshots or full steps
    return parsed.map((item: any) => ({
      runId: item.runId || '',
      url: item.url || '',
      command: item.command || '',
      mode: item.mode || 'smoke',
      createdAt: item.createdAt || new Date().toISOString(),
      lastKnownStatus: item.lastKnownStatus || item.status || 'running',
      score: typeof item.score === 'number' ? item.score : undefined,
      bugCount: typeof item.bugCount === 'number' ? item.bugCount : 0,
      credentials: item.credentials || null,
    }));
  } catch {
    return [];
  }
}

export function saveRunToHistory(run: StoredRun): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getStoredHistory();
    const existingIndex = history.findIndex((r) => r.runId === run.runId);

    // Prompt requirement: ONLY store runId, url, command, mode, createdAt, lastKnownStatus, score, bugCount
    // Never store screenshots or full steps in localStorage
    const minimalRun: StoredRun = {
      runId: run.runId,
      url: run.url,
      command: run.command,
      mode: run.mode,
      createdAt: run.createdAt,
      lastKnownStatus: run.lastKnownStatus || 'running',
      score: typeof run.score === 'number' ? run.score : undefined,
      bugCount: typeof run.bugCount === 'number' ? run.bugCount : 0,
    };

    let updated: StoredRun[];
    if (existingIndex >= 0) {
      updated = [...history];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...minimalRun,
      };
    } else {
      updated = [minimalRun, ...history];
    }
    // Limit to 50 most recent runs
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch {
    // ignore
  }
}

export function updateRunStatusInHistory(
  runId: string,
  lastKnownStatus: RunStatus,
  score?: number,
  bugCount?: number
): StoredRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const history = getStoredHistory();
    const existingIndex = history.findIndex((r) => r.runId === runId);
    if (existingIndex >= 0) {
      const updated = [...history];
      updated[existingIndex] = {
        ...updated[existingIndex],
        lastKnownStatus,
        ...(typeof score === 'number' ? { score } : {}),
        ...(typeof bugCount === 'number' ? { bugCount } : {}),
      };
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 50)));
      return updated;
    }
    return history;
  } catch {
    return [];
  }
}

export function deleteRunFromHistory(runId: string): StoredRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const history = getStoredHistory();
    const updated = history.filter((r) => r.runId !== runId);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearStoredHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function getStoredTheme(): 'light' | 'dark' | 'system' {
  if (typeof window === 'undefined') return 'system';
  try {
    const theme = window.localStorage.getItem(THEME_KEY);
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      return theme;
    }
    return 'system';
  } catch {
    return 'system';
  }
}

export function saveStoredTheme(theme: 'light' | 'dark' | 'system'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
