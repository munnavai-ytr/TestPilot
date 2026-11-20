import { StudioBridge } from './bridge';
import {
  DEFAULT_AUDIT_DEVICE_PRESETS,
  createStudioId,
  saveShot,
} from './store';
import {
  AuditA11yResult,
  AuditLayoutResult,
  AuditPerfResult,
  AuditSeoResult,
  DeviceAuditEntry,
  LinkCheckEntry,
  StudioAuditResults,
  StudioFinding,
  StudioSeverity,
} from './types';

export function extractUrlPathname(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    return u.pathname || '/';
  } catch {
    if (pageUrl.startsWith('/')) return pageUrl.split('?')[0].split('#')[0] || '/';
    return pageUrl.trim().toLowerCase() || '/';
  }
}

export function createFindingFingerprint(title: string, pageUrl: string): string {
  return `${title.trim().toLowerCase()}::${extractUrlPathname(pageUrl).toLowerCase()}`;
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function countSeverities(
  issues: Array<{ severity?: StudioSeverity }>
): Record<StudioSeverity, number> {
  const counts: Record<StudioSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const item of issues) {
    const sev = item.severity || 'medium';
    if (sev in counts) counts[sev] += 1;
  }
  return counts;
}

export interface RunAuditCallbacks {
  signal?: AbortSignal;
  onResizeStage?: (width: number, height: number) => void;
  onStatusText?: (text: string) => void;
  screenshotAvailable: boolean;
  onScreenshotUnavailable?: () => void;
}

export async function runDevicesAudit(
  sessionId: string,
  bridge: StudioBridge,
  selectedDeviceIds: string[],
  originalWidth: number,
  originalHeight: number,
  callbacks: RunAuditCallbacks
): Promise<{ entries: DeviceAuditEntry[]; findings: StudioFinding[] }> {
  const presets = DEFAULT_AUDIT_DEVICE_PRESETS.filter((d) =>
    selectedDeviceIds.length > 0 ? selectedDeviceIds.includes(d.id) : true
  );
  const targets = presets.length > 0 ? presets : DEFAULT_AUDIT_DEVICE_PRESETS;

  const entries: DeviceAuditEntry[] = [];
  const findings: StudioFinding[] = [];
  const currentUrl = bridge.getCurrentUrl();
  let canScreenshot = callbacks.screenshotAvailable;

  try {
    for (const device of targets) {
      if (callbacks.signal?.aborted) break;

      callbacks.onStatusText?.(`Checking layout on ${device.label}...`);
      callbacks.onResizeStage?.(device.width, device.height);
      await sleepAbortable(700, callbacks.signal);

      let result: AuditLayoutResult;
      try {
        result = await bridge.audit('layout');
      } catch {
        result = {
          viewport: { w: device.width, h: device.height },
          docWidth: device.width,
          issues: [],
        };
      }

      let shotId: string | undefined;
      if (canScreenshot) {
        try {
          const shot = await bridge.screenshot(0.45, 0.55);
          if (shot?.dataUrl) {
            shotId = await saveShot(sessionId, shot.dataUrl);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('screenshot_unavailable')) {
            canScreenshot = false;
            callbacks.onScreenshotUnavailable?.();
          }
        }
      }

      const issues = Array.isArray(result.issues) ? result.issues : [];
      const counts = countSeverities(issues);

      entries.push({
        deviceId: device.id,
        deviceLabel: device.label,
        width: device.width,
        height: device.height,
        result: { ...result, issues },
        shotId,
        counts,
      });

      for (const issue of issues) {
        const title = `Layout issue (${device.width}x${device.height}): ${issue.rule}`;
        findings.push({
          id: createStudioId('find'),
          sessionId,
          fingerprint: createFindingFingerprint(title, currentUrl),
          severity: issue.severity || 'medium',
          title,
          page: currentUrl,
          source: 'audit_layout',
          whatHappened: issue.detail,
          whyItHappened: `Element layout broke or overflowed at ${device.width}x${device.height} (document width ${result.docWidth}px vs viewport ${result.viewport?.w || device.width}px).`,
          expectedVsActual: `Expected: all content fits cleanly within ${device.width}px width without clipping or overflow.\nActual: ${issue.detail}`,
          stepsToReproduce: [
            `Open ${currentUrl}`,
            `Set viewport width to ${device.width}x${device.height}`,
            `Inspect ${issue.examples?.slice(0, 3).join(', ') || 'affected layout elements'}`,
          ],
          evidence: issue.examples?.join('\n') || `${issue.rule}: ${issue.detail}`,
          shotId,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } finally {
    callbacks.onResizeStage?.(originalWidth, originalHeight);
  }

  return { entries, findings };
}

export async function runA11yAudit(
  sessionId: string,
  bridge: StudioBridge
): Promise<{ result: AuditA11yResult & { url: string }; findings: StudioFinding[] }> {
  const url = bridge.getCurrentUrl();
  const res = await bridge.audit('a11y');
  const issues = Array.isArray(res?.issues) ? res.issues : [];
  const findings: StudioFinding[] = [];

  for (const issue of issues) {
    const title = `Accessibility: ${issue.rule}`;
    findings.push({
      id: createStudioId('find'),
      sessionId,
      fingerprint: createFindingFingerprint(title, url),
      severity: issue.severity || 'medium',
      title,
      page: url,
      source: 'audit_a11y',
      whatHappened: `${issue.detail} (${issue.count} affected element${issue.count === 1 ? '' : 's'}).`,
      whyItHappened: `Accessibility rule "${issue.rule}" failed automatic DOM inspection.`,
      expectedVsActual: `Expected: elements comply with WCAG guidelines for ${issue.rule}.\nActual: ${issue.count} violation(s) found.`,
      stepsToReproduce: [`Open ${url}`, `Inspect elements matching ${issue.rule}`],
      evidence: (issue.examples || []).slice(0, 5).join('\n') || issue.detail,
      createdAt: new Date().toISOString(),
    });
  }

  return { result: { issues, url }, findings };
}

export async function runSeoAudit(
  sessionId: string,
  bridge: StudioBridge
): Promise<{ result: AuditSeoResult & { url: string }; findings: StudioFinding[] }> {
  const url = bridge.getCurrentUrl();
  const res = await bridge.audit('seo');
  const issues = Array.isArray(res?.issues) ? res.issues : [];
  const findings: StudioFinding[] = [];

  for (const issueText of issues) {
    const title = `SEO: ${issueText}`;
    findings.push({
      id: createStudioId('find'),
      sessionId,
      fingerprint: createFindingFingerprint(title, url),
      severity: 'low',
      title,
      page: url,
      source: 'audit_seo',
      whatHappened: issueText,
      whyItHappened: 'Page metadata or semantic heading structure is incomplete.',
      expectedVsActual: `Expected: valid title, meta description, and semantic structure.\nActual: ${issueText}`,
      stepsToReproduce: [`Open ${url}`, 'Inspect <head> metadata and headings'],
      evidence: `Title: "${res?.title || '(empty)'}" | Description: "${res?.description || '(empty)'}"`,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    result: {
      title: res?.title || '',
      description: res?.description || '',
      issues,
      url,
    },
    findings,
  };
}

export async function runPerfAudit(
  sessionId: string,
  bridge: StudioBridge
): Promise<{
  result: StudioAuditResults['perf'];
  findings: StudioFinding[];
}> {
  const url = bridge.getCurrentUrl();
  const perf = await bridge.audit('perf');
  const evidence = await bridge.evidence(false).catch(() => undefined);
  const findings: StudioFinding[] = [];

  if (perf.lcpMs > 4000) {
    const title = `Slow Largest Contentful Paint (${Math.round(perf.lcpMs)}ms)`;
    findings.push({
      id: createStudioId('find'),
      sessionId,
      fingerprint: createFindingFingerprint(title, url),
      severity: 'medium',
      title,
      page: url,
      source: 'audit_perf',
      whatHappened: `Largest Contentful Paint measured ${Math.round(perf.lcpMs)}ms (target <= 2500ms).`,
      whyItHappened: 'Hero assets, scripts, or server TTFB delayed primary content rendering.',
      expectedVsActual: `Expected: LCP under 2500ms.\nActual: ${Math.round(perf.lcpMs)}ms (TTFB ${Math.round(perf.ttfbMs)}ms).`,
      stepsToReproduce: [`Load ${url}`, 'Measure Web Vitals LCP timing'],
      evidence: `LCP: ${Math.round(perf.lcpMs)}ms, FCP: ${Math.round(perf.fcpMs)}ms, TTFB: ${Math.round(perf.ttfbMs)}ms, Transfer: ${Math.round(perf.transferKB)}KB`,
      createdAt: new Date().toISOString(),
    });
  }

  if (perf.cls > 0.25) {
    const title = `High Cumulative Layout Shift (${perf.cls.toFixed(2)})`;
    findings.push({
      id: createStudioId('find'),
      sessionId,
      fingerprint: createFindingFingerprint(title, url),
      severity: 'medium',
      title,
      page: url,
      source: 'audit_perf',
      whatHappened: `Page shifted unexpectedly during load (CLS ${perf.cls.toFixed(2)}, threshold 0.1).`,
      whyItHappened: 'Images, banners, or dynamic blocks rendered without reserved dimensions.',
      expectedVsActual: `Expected: CLS <= 0.1.\nActual: ${perf.cls.toFixed(2)}`,
      stepsToReproduce: [`Load ${url}`, 'Observe layout stability during load'],
      evidence: `CLS: ${perf.cls.toFixed(3)}`,
      createdAt: new Date().toISOString(),
    });
  }

  if (Array.isArray(perf.oversizedImages) && perf.oversizedImages.length > 0) {
    const title = `Oversized images detected (${perf.oversizedImages.length})`;
    findings.push({
      id: createStudioId('find'),
      sessionId,
      fingerprint: createFindingFingerprint(title, url),
      severity: 'low',
      title,
      page: url,
      source: 'audit_perf',
      whatHappened: `${perf.oversizedImages.length} image(s) are much larger than their rendered dimensions.`,
      whyItHappened: 'Uncompressed or oversized source images increase transfer size.',
      expectedVsActual: 'Expected: images sized close to display dimensions.\nActual: oversized image assets loaded.',
      stepsToReproduce: [`Load ${url}`, 'Inspect image natural vs display dimensions'],
      evidence: perf.oversizedImages.slice(0, 5).join('\n'),
      createdAt: new Date().toISOString(),
    });
  }

  return {
    result: {
      ...(perf as AuditPerfResult),
      evidence,
      url,
    },
    findings,
  };
}

export async function runLinksAudit(
  sessionId: string,
  bridge: StudioBridge,
  maxLinks: number,
  signal?: AbortSignal,
  onStatusText?: (text: string) => void
): Promise<{
  result: NonNullable<StudioAuditResults['links']>;
  findings: StudioFinding[];
}> {
  const startUrl = bridge.getCurrentUrl();
  const startOrigin = bridge.appOrigin;
  const startPath = extractUrlPathname(startUrl);

  const initialSnap = await bridge.snapshot(80);
  const candidatePaths: string[] = [];
  const seen = new Set<string>();

  for (const el of initialSnap.elements || []) {
    if (!el.href) continue;
    try {
      const resolved = new URL(el.href, startUrl);
      if (resolved.origin !== startOrigin) continue;
      if (resolved.protocol !== 'https:') continue;
      const pathWithSearch = `${resolved.pathname}${resolved.search}`;
      if (!seen.has(pathWithSearch)) {
        seen.add(pathWithSearch);
        candidatePaths.push(pathWithSearch);
      }
    } catch {
      // skip invalid href
    }
    if (candidatePaths.length >= maxLinks) break;
  }

  const entries: LinkCheckEntry[] = [];
  const findings: StudioFinding[] = [];

  // Drain prior evidence before starting link checks
  await bridge.evidence(true).catch(() => undefined);

  for (const path of candidatePaths) {
    if (signal?.aborted) break;
    onStatusText?.(`Checking link ${path}...`);

    try {
      await bridge.navigate(path);
      await bridge.waitSettled(3500, 350);
      const snap = await bridge.snapshot(30);
      const ev = await bridge.evidence(true);

      const titleLower = (snap.title || '').toLowerCase();
      const textSample = (snap.text || '').slice(0, 500).toLowerCase();
      const headingsText = (snap.headings || []).join(' ').toLowerCase();

      const looksLike404 =
        /\b404\b/.test(titleLower) ||
        /\b404\b/.test(headingsText) ||
        /page not found|cannot be found|404 not found/i.test(headingsText) ||
        /page not found|404 - not found/i.test(textSample);

      const consoleErrCount =
        (ev.consoleErrors?.length || 0) + (ev.pageErrors?.length || 0);
      const failedReqCount =
        (ev.failedRequests?.length || 0) + (ev.brokenResources?.length || 0);

      let status: 'ok' | 'broken' | 'error' = 'ok';
      let reason = '';

      if (looksLike404) {
        status = 'broken';
        reason = 'Page rendered a 404 / Not Found response.';
      } else if (consoleErrCount > 0 || failedReqCount > 0) {
        status = 'error';
        reason = `${consoleErrCount} runtime/console error(s), ${failedReqCount} failed request(s).`;
      }

      const fullUrl = new URL(path, startOrigin).toString();
      entries.push({
        path,
        url: fullUrl,
        status,
        title: snap.title,
        reason: reason || undefined,
        consoleErrors: consoleErrCount,
        failedRequests: failedReqCount,
      });

      if (status !== 'ok') {
        const title =
          status === 'broken' ? `Broken link (404): ${path}` : `Page errors on ${path}`;
        findings.push({
          id: createStudioId('find'),
          sessionId,
          fingerprint: createFindingFingerprint(title, fullUrl),
          severity: status === 'broken' ? 'high' : 'medium',
          title,
          page: fullUrl,
          source: 'audit_links',
          whatHappened: reason,
          whyItHappened:
            status === 'broken'
              ? 'An internal navigation link points to a missing route.'
              : 'Visiting this route triggered runtime exceptions or failed network calls.',
          expectedVsActual: `Expected: ${path} loads cleanly with HTTP 200 and zero console/network errors.\nActual: ${reason}`,
          stepsToReproduce: [`Navigate from ${startPath} to ${path}`, 'Check page state and console'],
          evidence: [
            ...(ev.consoleErrors || []),
            ...(ev.pageErrors || []),
            ...(ev.failedRequests || []),
            ...(ev.brokenResources || []),
          ]
            .slice(0, 6)
            .join('\n') || reason,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      const fullUrl = new URL(path, startOrigin).toString();
      const errMsg = err instanceof Error ? err.message : 'Failed to navigate to link';
      entries.push({
        path,
        url: fullUrl,
        status: 'error',
        reason: errMsg,
        consoleErrors: 0,
        failedRequests: 1,
      });
    }
  }

  // Return to starting page
  if (!signal?.aborted && candidatePaths.length > 0) {
    try {
      await bridge.navigate(startPath);
      await bridge.waitSettled(2500, 300);
    } catch {
      // ignore return navigation error
    }
  }

  return {
    result: {
      checkedCount: entries.length,
      brokenCount: entries.filter((e) => e.status !== 'ok').length,
      entries,
    },
    findings,
  };
}
