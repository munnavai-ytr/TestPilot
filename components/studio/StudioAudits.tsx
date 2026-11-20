'use client';

import React, { useState } from 'react';
import {
  MonitorSmartphone,
  Accessibility,
  Gauge,
  Search,
  Link2,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react';
import { StudioAuditResults } from '@/lib/studio/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ScreenshotModal } from '@/components/ScreenshotModal';

interface StudioAuditsProps {
  audits: StudioAuditResults;
  shots: Record<string, string>;
}

export function StudioAudits({ audits, shots }: StudioAuditsProps) {
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [modalShot, setModalShot] = useState<{ src: string; title: string } | null>(null);

  const hasAny =
    (audits.devices && audits.devices.length > 0) ||
    !!audits.a11y ||
    !!audits.perf ||
    !!audits.seo ||
    !!audits.links;

  if (!hasAny) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
        <Gauge className="w-7 h-7 mx-auto text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
        <p className="font-medium text-zinc-700 dark:text-zinc-300">No audits run yet</p>
        <p className="text-[11px] max-w-xs mx-auto">
          Devices, Accessibility, Performance, SEO, and Links checks run free with 0 Gemini calls once approved in the test plan.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3.5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Devices Responsive Grid */}
      {audits.devices && audits.devices.length > 0 && (
        <Card className="p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-[#3B5BDB]" strokeWidth={1.5} />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Devices Layout Matrix ({audits.devices.length} viewports)
            </h3>
          </div>

          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <th className="py-2 px-2.5 font-medium">Device</th>
                  <th className="py-2 px-2 font-medium text-center">Crit</th>
                  <th className="py-2 px-2 font-medium text-center">High</th>
                  <th className="py-2 px-2 font-medium text-center">Med</th>
                  <th className="py-2 px-2 font-medium text-center">Low</th>
                  <th className="py-2 px-2 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {audits.devices.map((dev) => {
                  const isOpen = expandedDeviceId === dev.deviceId;
                  const shotUrl = dev.shotId ? shots[dev.shotId] : undefined;
                  return (
                    <React.Fragment key={dev.deviceId}>
                      <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
                        <td className="py-2 px-2.5 font-mono text-zinc-800 dark:text-zinc-200">
                          {dev.deviceLabel}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {dev.counts.critical > 0 ? (
                            <span className="text-[#DC2626] font-semibold">{dev.counts.critical}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {dev.counts.high > 0 ? (
                            <span className="text-[#EA580C] font-semibold">{dev.counts.high}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {dev.counts.medium > 0 ? (
                            <span className="text-[#CA8A04] font-semibold">{dev.counts.medium}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {dev.counts.low > 0 ? (
                            <span className="text-[#2563EB] font-semibold">{dev.counts.low}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDeviceId(isOpen ? null : dev.deviceId)
                            }
                            aria-label={`Toggle details for ${dev.deviceLabel}`}
                            className="inline-flex items-center gap-1 text-[#3B5BDB] hover:underline"
                          >
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                            )}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={6} className="p-3 bg-zinc-50/70 dark:bg-zinc-950/60 space-y-2">
                            <div className="text-[11px] font-mono text-zinc-500">
                              Viewport {dev.width}x{dev.height} · Document width {dev.result.docWidth}px
                            </div>
                            {dev.result.issues.length === 0 ? (
                              <p className="text-[#16A34A] text-[11px] font-medium">
                                No layout issues detected on this device.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {dev.result.issues.map((iss, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge severity={iss.severity} />
                                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        {iss.rule}
                                      </span>
                                    </div>
                                    <p className="text-zinc-600 dark:text-zinc-400">{iss.detail}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {shotUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setModalShot({
                                    src: shotUrl,
                                    title: dev.deviceLabel,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 text-[11px] text-[#3B5BDB] hover:underline"
                              >
                                <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span>View device screenshot</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Accessibility Audit */}
      {audits.a11y && (
        <Card className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Accessibility className="w-4 h-4 text-[#3B5BDB]" strokeWidth={1.5} />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Accessibility Audit
              </h3>
            </div>
            <Badge variant="neutral" className="font-mono">
              {audits.a11y.issues.length} rule(s)
            </Badge>
          </div>

          {audits.a11y.issues.length === 0 ? (
            <p className="text-[11px] text-[#16A34A] font-medium">
              Zero automated accessibility violations detected on this page.
            </p>
          ) : (
            <div className="space-y-2">
              {audits.a11y.issues.map((iss, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge severity={iss.severity} />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {iss.rule}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {iss.count} element{iss.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">{iss.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Performance Audit */}
      {audits.perf && (
        <Card className="p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#3B5BDB]" strokeWidth={1.5} />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Performance Metrics
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
              <span className="text-zinc-500 block">TTFB</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {Math.round(audits.perf.ttfbMs || 0)} ms
              </span>
            </div>
            <div className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
              <span className="text-zinc-500 block">FCP</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {Math.round(audits.perf.fcpMs || 0)} ms
              </span>
            </div>
            <div className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
              <span className="text-zinc-500 block">LCP</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {Math.round(audits.perf.lcpMs || 0)} ms
              </span>
            </div>
            <div className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
              <span className="text-zinc-500 block">CLS</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {(audits.perf.cls || 0).toFixed(3)}
              </span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-3">
            <span>Load: {Math.round(audits.perf.loadMs || 0)}ms</span>
            <span>Requests: {audits.perf.requests || 0}</span>
            <span>Transfer: {Math.round(audits.perf.transferKB || 0)} KB</span>
            <span>Long tasks: {audits.perf.longTasks || 0}</span>
          </div>
        </Card>
      )}

      {/* SEO Audit */}
      {audits.seo && (
        <Card className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#3B5BDB]" strokeWidth={1.5} />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">SEO Check</h3>
            </div>
            <Badge variant="neutral" className="font-mono">
              {audits.seo.issues.length} issue(s)
            </Badge>
          </div>

          <div className="text-[11px] space-y-1 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
            <div>
              <span className="text-zinc-500">Title:</span>{' '}
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {audits.seo.title || '(missing)'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Description:</span>{' '}
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {audits.seo.description || '(missing)'}
              </span>
            </div>
          </div>

          {audits.seo.issues.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-zinc-600 dark:text-zinc-400">
              {audits.seo.issues.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Links Audit */}
      {audits.links && (
        <Card className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#3B5BDB]" strokeWidth={1.5} />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Internal Links Check
              </h3>
            </div>
            <Badge
              status={audits.links.brokenCount > 0 ? 'failed' : 'passed'}
              className="font-mono"
            >
              {audits.links.checkedCount} checked · {audits.links.brokenCount} failed
            </Badge>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {audits.links.entries.map((entry, idx) => (
              <div
                key={idx}
                className="p-2 flex items-center justify-between gap-2 text-[11px] bg-white dark:bg-zinc-950/50"
              >
                <div className="min-w-0">
                  <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                    {entry.path}
                  </div>
                  {entry.reason && (
                    <div className="text-[#DC2626] dark:text-red-400">{entry.reason}</div>
                  )}
                </div>
                <Badge
                  status={entry.status === 'ok' ? 'passed' : entry.status === 'broken' ? 'failed' : 'warning'}
                >
                  {entry.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ScreenshotModal
        isOpen={!!modalShot}
        onClose={() => setModalShot(null)}
        screenshotUrl={modalShot?.src || null}
        title={modalShot?.title}
      />
    </div>
  );
}
