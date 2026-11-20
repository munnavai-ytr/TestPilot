import {
  AuditAllResult,
  AuditA11yResult,
  AuditLayoutResult,
  AuditPerfResult,
  AuditSeoResult,
  BridgeConnectionStatus,
  BridgeEvidence,
  BridgeSnapshot,
} from './types';

const SID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export function generateSessionSid(length = 32): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += SID_ALPHABET[bytes[i] % SID_ALPHABET.length];
    }
    return out;
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SID_ALPHABET[Math.floor(Math.random() * SID_ALPHABET.length)];
  }
  return out;
}

export function buildBridgeIframeSrc(appUrl: string, sid: string): string {
  const parsed = new URL(appUrl);
  parsed.hash = `__tp=${sid}`;
  return parsed.toString();
}

export interface BridgeHelloInfo {
  version?: string;
  url: string;
  title?: string;
}

export interface BridgeClickResult {
  ok: boolean;
  target?: string;
  urlBefore?: string;
  reason?: 'covered' | 'disabled' | string;
  blockedBy?: string;
}

export interface BridgeTypeResult {
  ok: boolean;
  target?: string;
  submitted?: boolean;
  valueLength?: number;
  reason?: 'not_editable' | 'not_a_text_field' | string;
}

export interface BridgeSelectResult {
  ok: boolean;
  selected?: string;
  reason?: 'option_not_found' | string;
  options?: string[];
}

export interface BridgeWaitSettledResult {
  settled: boolean;
  waitedMs: number;
  pendingRequests: number;
}

export interface BridgeScreenshotResult {
  dataUrl: string;
  w: number;
  h: number;
}

export class BridgeCallError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.name = 'BridgeCallError';
    this.code = code;
  }
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  cmd: string;
}

interface NavWaiter {
  resolve: (info: BridgeHelloInfo) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface StudioBridgeCallbacks {
  onStatusChange?: (status: BridgeConnectionStatus) => void;
  onHello?: (info: BridgeHelloInfo) => void;
  onNavigated?: (info: BridgeHelloInfo) => void;
  onConnectionLost?: () => void;
}

export class StudioBridge {
  readonly appUrl: string;
  readonly appOrigin: string;
  readonly sid: string;

  private iframe: HTMLIFrameElement | null = null;
  private callbacks: StudioBridgeCallbacks;
  private pending = new Map<string, PendingCall>();
  private navWaiters = new Set<NavWaiter>();
  private commandCounter = 0;
  private status: BridgeConnectionStatus = 'idle';
  private helloTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pingIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private consecutivePingFailures = 0;
  private destroyed = false;
  private hasReceivedHello = false;
  private currentUrl = '';
  private currentTitle = '';
  private boundOnMessage: (event: MessageEvent) => void;

  constructor(appUrl: string, callbacks: StudioBridgeCallbacks = {}) {
    this.appUrl = appUrl;
    this.appOrigin = new URL(appUrl).origin;
    this.sid = generateSessionSid(32);
    this.callbacks = callbacks;
    this.currentUrl = appUrl;

    this.boundOnMessage = this.handleMessage.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.boundOnMessage);
    }
  }

  getIframeSrc(): string {
    return buildBridgeIframeSrc(this.appUrl, this.sid);
  }

  getCurrentUrl(): string {
    return this.currentUrl || this.appUrl;
  }

  getCurrentTitle(): string {
    return this.currentTitle;
  }

  getStatus(): BridgeConnectionStatus {
    return this.status;
  }

  private setStatus(next: BridgeConnectionStatus) {
    if (this.status === next) return;
    this.status = next;
    this.callbacks.onStatusChange?.(next);
  }

  attachIframe(iframe: HTMLIFrameElement | null) {
    this.iframe = iframe;
    if (iframe && !this.destroyed) {
      this.startConnectionAttempt();
    }
  }

  startConnectionAttempt() {
    if (this.destroyed) return;
    this.clearHelloTimer();
    this.stopHeartbeat();
    this.consecutivePingFailures = 0;
    this.hasReceivedHello = false;
    this.setStatus('connecting');

    // Diagnostics trigger if no "hello" arrives within 10 seconds
    this.helloTimeoutTimer = setTimeout(() => {
      if (!this.destroyed && !this.hasReceivedHello) {
        this.setStatus('failed');
      }
    }, 10000);
  }

  retryConnection() {
    if (this.destroyed || !this.iframe) return;
    this.rejectAllPending(new BridgeCallError('reconnecting', 'Reconnecting to app...'));
    this.startConnectionAttempt();
    this.iframe.src = this.getIframeSrc();
  }

  private clearHelloTimer() {
    if (this.helloTimeoutTimer) {
      clearTimeout(this.helloTimeoutTimer);
      this.helloTimeoutTimer = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.consecutivePingFailures = 0;
    this.pingIntervalTimer = setInterval(async () => {
      if (this.destroyed || !this.hasReceivedHello || this.status === 'connecting') return;
      try {
        await this.call<{ version?: string; url: string; title?: string }>('ping', {}, 4000);
        this.consecutivePingFailures = 0;
        if (this.status === 'disconnected' || this.status === 'reconnecting') {
          this.setStatus('connected');
        }
      } catch {
        this.consecutivePingFailures += 1;
        if (this.consecutivePingFailures >= 2) {
          this.setStatus('disconnected');
          this.callbacks.onConnectionLost?.();
        }
      }
    }, 6000);
  }

  private stopHeartbeat() {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
  }

  private handleMessage(event: MessageEvent) {
    if (this.destroyed || !this.iframe || !this.iframe.contentWindow) return;

    // Strict origin, source, protocol and sid verification
    if (event.source !== this.iframe.contentWindow) return;
    if (event.origin !== this.appOrigin) return;

    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.tp !== 1) return;
    if (data.sid !== this.sid) return;

    if (data.type === 'hello') {
      this.clearHelloTimer();
      this.hasReceivedHello = true;
      this.consecutivePingFailures = 0;
      const info: BridgeHelloInfo = {
        version: typeof data.version === 'string' ? data.version : undefined,
        url: typeof data.url === 'string' ? data.url : this.currentUrl,
        title: typeof data.title === 'string' ? data.title : undefined,
      };
      this.currentUrl = info.url;
      if (info.title) this.currentTitle = info.title;
      this.setStatus('connected');
      this.startHeartbeat();
      this.resolveNavWaiters(info);
      this.callbacks.onHello?.(info);
      return;
    }

    if (data.type === 'navigated') {
      const info: BridgeHelloInfo = {
        url: typeof data.url === 'string' ? data.url : this.currentUrl,
        title: typeof data.title === 'string' ? data.title : undefined,
      };
      this.currentUrl = info.url;
      if (info.title) this.currentTitle = info.title;
      this.resolveNavWaiters(info);
      this.callbacks.onNavigated?.(info);
      return;
    }

    if (data.type === 'reply' && typeof data.id === 'string') {
      const entry = this.pending.get(data.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(data.id);

      if (data.ok === true) {
        entry.resolve(data.result);
      } else {
        const errText =
          typeof data.error === 'string'
            ? data.error
            : data.error && typeof data.error === 'object' && typeof data.error.message === 'string'
            ? data.error.message
            : 'bridge_command_failed';
        const code =
          typeof data.error === 'string'
            ? data.error
            : data.error && typeof data.error === 'object' && typeof data.error.code === 'string'
            ? data.error.code
            : errText;
        entry.reject(new BridgeCallError(code, errText));
      }
    }
  }

  private resolveNavWaiters(info: BridgeHelloInfo) {
    for (const waiter of this.navWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(info);
    }
    this.navWaiters.clear();
  }

  waitForNavigationEvent(timeoutMs = 8000): Promise<BridgeHelloInfo | null> {
    if (this.destroyed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const waiter: NavWaiter = {
        resolve: (info) => resolve(info),
        timer: setTimeout(() => {
          this.navWaiters.delete(waiter);
          resolve(null);
        }, timeoutMs),
      };
      this.navWaiters.add(waiter);
    });
  }

  async call<T = unknown>(
    cmd: string,
    args: Record<string, unknown> = {},
    timeoutMs = 15000
  ): Promise<T> {
    if (this.destroyed) {
      throw new BridgeCallError('bridge_destroyed', 'Studio session has ended.');
    }
    if (!this.iframe || !this.iframe.contentWindow) {
      throw new BridgeCallError('no_iframe', 'App stage is not mounted.');
    }

    // Same-origin safety guard for navigate
    if (cmd === 'navigate') {
      const pathArg = typeof args.path === 'string' ? args.path.trim() : '';
      if (!pathArg) {
        throw new BridgeCallError('invalid_path', 'Navigation path is empty.');
      }
      try {
        const resolved = new URL(pathArg, this.appOrigin);
        if (resolved.origin !== this.appOrigin) {
          throw new BridgeCallError(
            'cross_origin_blocked',
            'Navigation outside the tested app origin is blocked.'
          );
        }
      } catch (err) {
        if (err instanceof BridgeCallError) throw err;
        throw new BridgeCallError('invalid_path', 'Invalid navigation path.');
      }
    }

    this.commandCounter += 1;
    const id = `cmd_${this.commandCounter}_${Date.now().toString(36)}`;

    const isNavCommand =
      cmd === 'navigate' || cmd === 'reload' || cmd === 'back' || cmd === 'forward';
    const navPromise = isNavCommand ? this.waitForNavigationEvent(8000) : null;

    const resultPromise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeCallError('timeout', `Command "${cmd}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
        cmd,
      });

      try {
        this.iframe?.contentWindow?.postMessage(
          {
            tp: 1,
            sid: this.sid,
            id,
            cmd,
            args,
          },
          this.appOrigin
        );
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(
          new BridgeCallError(
            'post_message_failed',
            err instanceof Error ? err.message : 'Failed to post message to app.'
          )
        );
      }
    });

    if (navPromise) {
      const result = await resultPromise;
      await navPromise;
      return result;
    }

    return resultPromise;
  }

  async ping() {
    return this.call<{ version?: string; url: string; title?: string }>('ping', {}, 5000);
  }

  async snapshot(maxElements = 80): Promise<BridgeSnapshot> {
    const snap = await this.call<BridgeSnapshot>('snapshot', { maxElements }, 15000);
    if (snap?.url) this.currentUrl = snap.url;
    if (snap?.title) this.currentTitle = snap.title;
    return snap;
  }

  async click(args: { index: number; force?: boolean; label?: string }): Promise<BridgeClickResult> {
    const urlBefore = this.currentUrl;
    const navWaitPromise = this.waitForNavigationEvent(1200);
    const res = await this.call<BridgeClickResult>('click', args, 15000);
    const navEvent = await navWaitPromise;
    if (!navEvent && res?.urlBefore && this.currentUrl !== res.urlBefore) {
      await this.waitForNavigationEvent(8000);
    }
    if (res?.urlBefore && !urlBefore) {
      this.currentUrl = res.urlBefore;
    }
    return res;
  }

  async type(args: {
    index: number;
    text: string;
    clear?: boolean;
    slow?: boolean;
    submit?: boolean;
    label?: string;
  }): Promise<BridgeTypeResult> {
    return this.call<BridgeTypeResult>('type', { clear: true, ...args }, 15000);
  }

  async select(args: { index: number; value: string }): Promise<BridgeSelectResult> {
    return this.call<BridgeSelectResult>('select', args, 15000);
  }

  async check(args: { index: number; checked: boolean }) {
    return this.call<{ ok: boolean }>('check', args, 15000);
  }

  async hover(args: { index: number }) {
    return this.call<{ ok: boolean }>('hover', args, 15000);
  }

  async press(args: { key: string; shift?: boolean }) {
    return this.call<{ ok: boolean }>('press', args, 15000);
  }

  async scroll(args: { dy?: number; to?: 'top' | 'bottom' }) {
    return this.call<{ ok: boolean }>('scroll', args, 15000);
  }

  async highlight(args: { index: number; label?: string }) {
    return this.call<{ ok: boolean }>('highlight', args, 8000);
  }

  async waitSettled(timeout = 4000, quiet = 400): Promise<BridgeWaitSettledResult> {
    try {
      return await this.call<BridgeWaitSettledResult>('waitSettled', { timeout, quiet }, timeout + 3000);
    } catch {
      return { settled: false, waitedMs: timeout, pendingRequests: 0 };
    }
  }

  async evidence(clear = true): Promise<BridgeEvidence> {
    return this.call<BridgeEvidence>('evidence', { clear }, 10000);
  }

  async audit<K extends 'layout' | 'a11y' | 'seo' | 'perf' | 'all'>(
    kind: K
  ): Promise<
    K extends 'layout'
      ? AuditLayoutResult
      : K extends 'a11y'
      ? AuditA11yResult
      : K extends 'seo'
      ? AuditSeoResult
      : K extends 'perf'
      ? AuditPerfResult
      : AuditAllResult
  > {
    return this.call('audit', { kind }, 20000);
  }

  async screenshot(scale = 0.5, quality = 0.6): Promise<BridgeScreenshotResult> {
    return this.call<BridgeScreenshotResult>('screenshot', { scale, quality }, 15000);
  }

  async resetAndReload(): Promise<void> {
    await this.call<{ ok: boolean }>('reset', {}, 10000);
    await this.reload();
  }

  async navigate(path: string): Promise<void> {
    await this.call('navigate', { path }, 15000);
  }

  async back(): Promise<void> {
    await this.call('back', {}, 15000);
  }

  async forward(): Promise<void> {
    await this.call('forward', {}, 15000);
  }

  async reload(): Promise<void> {
    await this.call('reload', {}, 15000);
  }

  async reconnect(): Promise<boolean> {
    if (this.destroyed) return false;
    this.setStatus('reconnecting');
    try {
      await this.ping();
      this.consecutivePingFailures = 0;
      this.setStatus('connected');
      return true;
    } catch {
      this.retryConnection();
      const info = await this.waitForNavigationEvent(10000);
      if (info) {
        this.setStatus('connected');
        return true;
      }
      this.setStatus('failed');
      return false;
    }
  }

  private rejectAllPending(err: Error) {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }

  destroy() {
    this.destroyed = true;
    this.clearHelloTimer();
    this.stopHeartbeat();
    this.rejectAllPending(new BridgeCallError('bridge_destroyed', 'Studio session closed.'));
    for (const waiter of this.navWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve({ url: this.currentUrl });
    }
    this.navWaiters.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.boundOnMessage);
    }
    this.iframe = null;
  }
}
