import {
  DevicePreset,
  StudioFinding,
  StudioSession,
  StudioSettings,
  StudioVaultAccount,
} from './types';

export const VAULT_STORAGE_KEY = 'tp_studio_vault';
export const RECENT_URLS_STORAGE_KEY = 'tp_studio_recent';
export const STUDIO_SETTINGS_STORAGE_KEY = 'tp_studio_settings';
export const STAGING_ACK_STORAGE_KEY = 'tp_studio_staging_ack';

export const STUDIO_DB_NAME = 'tp_studio_db';
export const STUDIO_DB_VERSION = 1;

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'iphone_se', label: 'iPhone SE (375x667)', width: 375, height: 667 },
  { id: 'iphone_14', label: 'iPhone 14 (390x844)', width: 390, height: 844 },
  { id: 'pixel_7', label: 'Pixel 7 (412x915)', width: 412, height: 915 },
  { id: 'small_android', label: 'Small Android (360x640)', width: 360, height: 640 },
  { id: 'ipad', label: 'iPad (768x1024)', width: 768, height: 1024 },
  { id: 'laptop', label: 'Laptop (1366x768)', width: 1366, height: 768 },
  { id: 'desktop', label: 'Desktop (1920x1080)', width: 1920, height: 1080 },
  { id: 'custom', label: 'Custom', width: 390, height: 844 },
];

export const DEFAULT_AUDIT_DEVICE_PRESETS: DevicePreset[] = [
  { id: 'audit_320', label: 'Compact Phone (320x568)', width: 320, height: 568 },
  { id: 'iphone_se', label: 'iPhone SE (375x667)', width: 375, height: 667 },
  { id: 'iphone_14', label: 'iPhone 14 (390x844)', width: 390, height: 844 },
  { id: 'pixel_7', label: 'Pixel 7 (412x915)', width: 412, height: 915 },
  { id: 'ipad', label: 'iPad (768x1024)', width: 768, height: 1024 },
  { id: 'laptop', label: 'Laptop (1366x768)', width: 1366, height: 768 },
  { id: 'desktop', label: 'Desktop (1920x1080)', width: 1920, height: 1080 },
];

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  minDelayMs: 1200,
  maxStepsPerGoal: 25,
  personaSteps: 20,
  pauseOnError: false,
  allowDestructive: false,
  freshStartPerPersona: true,
  maxLinks: 15,
  selectedDevices: [
    'audit_320',
    'iphone_se',
    'iphone_14',
    'pixel_7',
    'ipad',
    'laptop',
    'desktop',
  ],
};

export function createStudioId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;

  if (
    host === 'localhost' ||
    host === 'ip6-localhost' ||
    host === 'ip6-loopback' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.arpa')
  ) {
    return true;
  }

  // IPv6 loopback / link-local / unique-local
  if (host.includes(':')) {
    if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return true;
    }
    return false;
  }

  // IPv4 check
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if ([a, b, c, d].some((n) => n < 0 || n > 255)) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  // Must contain a TLD dot for public domains
  if (!host.includes('.')) return true;

  return false;
}

export function validateStudioAppUrl(raw: string): {
  valid: boolean;
  normalized?: string;
  origin?: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter your app URL starting with https://' };
  }

  if (/^http:\/\//i.test(trimmed)) {
    return {
      valid: false,
      error: 'Only https:// URLs are allowed. http:// is not supported in Studio.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'Enter a valid full URL starting with https:// (for example https://staging.myapp.com).',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Only https:// URLs are allowed.',
    };
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    return {
      valid: false,
      error: 'Localhost and private network addresses cannot be tested in Studio. Use a public https:// staging URL.',
    };
  }

  return {
    valid: true,
    normalized: parsed.toString(),
    origin: parsed.origin,
  };
}

// ---------- localStorage: Vault (tp_studio_vault) ----------

export function getStudioVault(): StudioVaultAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : createStudioId('acct'),
        label: typeof item.label === 'string' ? item.label : 'Test Account',
        email: typeof item.email === 'string' ? item.email : '',
        password: typeof item.password === 'string' ? item.password : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function saveStudioVault(accounts: StudioVaultAccount[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(accounts));
    return true;
  } catch {
    return false;
  }
}

// ---------- localStorage: Recent URLs (tp_studio_recent) ----------

export function getRecentStudioUrls(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_URLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === 'string' && u.startsWith('https://')).slice(0, 10);
  } catch {
    return [];
  }
}

export function addRecentStudioUrl(url: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = getRecentStudioUrls();
    const filtered = existing.filter((u) => u !== url);
    const next = [url, ...filtered].slice(0, 10);
    window.localStorage.setItem(RECENT_URLS_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function removeRecentStudioUrl(url: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const next = getRecentStudioUrls().filter((u) => u !== url);
    window.localStorage.setItem(RECENT_URLS_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

// ---------- localStorage: Studio Settings (tp_studio_settings) ----------

export function getStudioSettings(): StudioSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_STUDIO_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STUDIO_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      minDelayMs:
        typeof parsed?.minDelayMs === 'number' && parsed.minDelayMs >= 0
          ? parsed.minDelayMs
          : DEFAULT_STUDIO_SETTINGS.minDelayMs,
      maxStepsPerGoal:
        typeof parsed?.maxStepsPerGoal === 'number' && parsed.maxStepsPerGoal >= 1
          ? parsed.maxStepsPerGoal
          : DEFAULT_STUDIO_SETTINGS.maxStepsPerGoal,
      personaSteps:
        typeof parsed?.personaSteps === 'number' && parsed.personaSteps >= 1
          ? parsed.personaSteps
          : DEFAULT_STUDIO_SETTINGS.personaSteps,
      pauseOnError:
        typeof parsed?.pauseOnError === 'boolean'
          ? parsed.pauseOnError
          : DEFAULT_STUDIO_SETTINGS.pauseOnError,
      allowDestructive:
        typeof parsed?.allowDestructive === 'boolean'
          ? parsed.allowDestructive
          : DEFAULT_STUDIO_SETTINGS.allowDestructive,
      freshStartPerPersona:
        typeof parsed?.freshStartPerPersona === 'boolean'
          ? parsed.freshStartPerPersona
          : DEFAULT_STUDIO_SETTINGS.freshStartPerPersona,
      maxLinks:
        typeof parsed?.maxLinks === 'number' && parsed.maxLinks >= 1
          ? parsed.maxLinks
          : DEFAULT_STUDIO_SETTINGS.maxLinks,
      selectedDevices: Array.isArray(parsed?.selectedDevices)
        ? parsed.selectedDevices.filter((d: unknown): d is string => typeof d === 'string')
        : [...DEFAULT_STUDIO_SETTINGS.selectedDevices],
    };
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS };
  }
}

export function saveStudioSettings(settings: StudioSettings): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

// ---------- localStorage: First-run staging acknowledgment ----------

export function hasSeenStagingWarningForOrigin(origin: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STAGING_ACK_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.includes(origin);
  } catch {
    return false;
  }
}

export function markStagingWarningSeenForOrigin(origin: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STAGING_ACK_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) {
      window.localStorage.setItem(STAGING_ACK_STORAGE_KEY, JSON.stringify([origin]));
      return;
    }
    if (!list.includes(origin)) {
      window.localStorage.setItem(STAGING_ACK_STORAGE_KEY, JSON.stringify([origin, ...list].slice(0, 50)));
    }
  } catch {
    // ignore
  }
}

// ---------- IndexedDB: tp_studio_db (sessions, findings, shots) ----------

function openStudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = window.indexedDB.open(STUDIO_DB_NAME, STUDIO_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sessions')) {
        const sStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sStore.createIndex('appOrigin', 'appOrigin', { unique: false });
        sStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('findings')) {
        const fStore = db.createObjectStore('findings', { keyPath: 'id' });
        fStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains('shots')) {
        const shStore = db.createObjectStore('shots', { keyPath: 'id' });
        shStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open Studio database.'));
  });
}

export interface StoredShot {
  id: string;
  sessionId: string;
  dataUrl: string;
  createdAt: string;
}

export async function saveShot(sessionId: string, dataUrl: string): Promise<string | undefined> {
  try {
    const db = await openStudioDb();
    const id = createStudioId('shot');
    const record: StoredShot = {
      id,
      sessionId,
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('shots', 'readwrite');
      tx.objectStore('shots').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return id;
  } catch {
    return undefined;
  }
}

export async function getShot(shotId: string): Promise<string | null> {
  try {
    const db = await openStudioDb();
    const result = await new Promise<StoredShot | undefined>((resolve, reject) => {
      const tx = db.transaction('shots', 'readonly');
      const req = tx.objectStore('shots').get(shotId);
      req.onsuccess = () => resolve(req.result as StoredShot | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result?.dataUrl || null;
  } catch {
    return null;
  }
}

export async function getShotsForSession(sessionId: string): Promise<Record<string, string>> {
  try {
    const db = await openStudioDb();
    const rows = await new Promise<StoredShot[]>((resolve, reject) => {
      const tx = db.transaction('shots', 'readonly');
      const index = tx.objectStore('shots').index('sessionId');
      const req = index.getAll(sessionId);
      req.onsuccess = () => resolve((req.result || []) as StoredShot[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.id] = row.dataUrl;
    }
    return map;
  } catch {
    return {};
  }
}

export async function saveStudioSession(session: StudioSession): Promise<void> {
  try {
    const db = await openStudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({
        ...session,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore storage errors gracefully
  }
}

export async function saveStudioFindings(
  sessionId: string,
  findings: StudioFinding[]
): Promise<void> {
  try {
    const db = await openStudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('findings', 'readwrite');
      const store = tx.objectStore('findings');
      const index = store.index('sessionId');
      const req = index.getAllKeys(sessionId);
      req.onsuccess = () => {
        const existingKeys = req.result || [];
        for (const k of existingKeys) {
          store.delete(k);
        }
        for (const f of findings) {
          store.put(f);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function getStudioFindingsForSession(sessionId: string): Promise<StudioFinding[]> {
  try {
    const db = await openStudioDb();
    const rows = await new Promise<StudioFinding[]>((resolve, reject) => {
      const tx = db.transaction('findings', 'readonly');
      const index = tx.objectStore('findings').index('sessionId');
      const req = index.getAll(sessionId);
      req.onsuccess = () => resolve((req.result || []) as StudioFinding[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows;
  } catch {
    return [];
  }
}

export async function getStudioSessionById(sessionId: string): Promise<StudioSession | null> {
  try {
    const db = await openStudioDb();
    const result = await new Promise<StudioSession | undefined>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const req = tx.objectStore('sessions').get(sessionId);
      req.onsuccess = () => resolve(req.result as StudioSession | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result || null;
  } catch {
    return null;
  }
}

export async function listStudioSessions(): Promise<StudioSession[]> {
  try {
    const db = await openStudioDb();
    const rows = await new Promise<StudioSession[]>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const req = tx.objectStore('sessions').getAll();
      req.onsuccess = () => resolve((req.result || []) as StudioSession[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function deleteStudioSession(sessionId: string): Promise<void> {
  try {
    const db = await openStudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['sessions', 'findings', 'shots'], 'readwrite');
      tx.objectStore('sessions').delete(sessionId);

      const fStore = tx.objectStore('findings');
      const fReq = fStore.index('sessionId').getAllKeys(sessionId);
      fReq.onsuccess = () => {
        for (const k of fReq.result || []) {
          fStore.delete(k);
        }
      };

      const shStore = tx.objectStore('shots');
      const shReq = shStore.index('sessionId').getAllKeys(sessionId);
      shReq.onsuccess = () => {
        for (const k of shReq.result || []) {
          shStore.delete(k);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function clearAllStudioSessions(): Promise<void> {
  try {
    const db = await openStudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['sessions', 'findings', 'shots'], 'readwrite');
      tx.objectStore('sessions').clear();
      tx.objectStore('findings').clear();
      tx.objectStore('shots').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
