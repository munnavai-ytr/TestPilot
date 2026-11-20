'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  ListChecks,
} from 'lucide-react';
import { StudioStep } from '@/lib/studio/types';
import { ScreenshotModal } from '@/components/ScreenshotModal';

interface StudioStepsProps {
  steps: StudioStep[];
  shots: Record<string, string>;
}

export function StudioSteps({ steps, shots }: StudioStepsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalShot, setModalShot] = useState<{ src: string; title: string } | null>(null);

  if (steps.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
        <ListChecks className="w-7 h-7 mx-auto text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
        <p className="font-medium text-zinc-700 dark:text-zinc-300">No steps executed yet</p>
        <p className="text-[11px] max-w-xs mx-auto">
          Approve a test plan in Chat to watch the AI agent drive your app step by step.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 overflow-y-auto h-full text-xs">
      {steps.map((step, idx) => {
        const isExpanded = expandedId === step.id;
        const shotDataUrl = step.shotId ? shots[step.shotId] : undefined;
        const hasErrors =
          step.evidenceDelta.consoleErrors.length > 0 ||
          step.evidenceDelta.pageErrors.length > 0 ||
          step.evidenceDelta.failedRequests.length > 0;

        return (
          <div
            key={step.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : step.id)}
              aria-expanded={isExpanded}
              className="w-full p-2.5 flex items-start gap-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
            >
              <span className="mt-0.5 shrink-0">
                {step.resultStatus === 'passed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.75} />
                ) : step.resultStatus === 'warning' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#CA8A04]" strokeWidth={1.75} />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[#DC2626]" strokeWidth={1.75} />
                )}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    #{idx + 1} · {step.caption || step.actionSummary}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {step.personaName && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-300">
                        {step.personaName}
                      </span>
                    )}
                    {shotDataUrl && (
                      <ImageIcon className="w-3 h-3 text-zinc-400" strokeWidth={1.5} />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {step.actionSummary} · {step.url}
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
                {step.say && (
                  <p dir="auto" className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {step.say}
                  </p>
                )}

                <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Result:</span>{' '}
                  {step.resultDetail}
                </div>

                {hasErrors && (
                  <div className="p-2 rounded border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/30 font-mono text-[10.5px] text-red-800 dark:text-red-300 space-y-1">
                    {step.evidenceDelta.pageErrors.map((e, i) => (
                      <div key={`pe_${i}`}>Page error: {e}</div>
                    ))}
                    {step.evidenceDelta.consoleErrors.map((e, i) => (
                      <div key={`ce_${i}`}>Console: {e}</div>
                    ))}
                    {step.evidenceDelta.failedRequests.map((e, i) => (
                      <div key={`fr_${i}`}>Network: {e}</div>
                    ))}
                  </div>
                )}

                {shotDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setModalShot({
                        src: shotDataUrl,
                        title: `Step ${idx + 1}: ${step.caption || step.actionSummary}`,
                      })
                    }
                    className="block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 max-w-xs hover:opacity-90 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shotDataUrl}
                      alt={`Step ${idx + 1} screenshot`}
                      className="w-full h-auto object-contain"
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <ScreenshotModal
        isOpen={!!modalShot}
        onClose={() => setModalShot(null)}
        screenshotUrl={modalShot?.src || null}
        title={modalShot?.title}
      />
    </div>
  );
}
