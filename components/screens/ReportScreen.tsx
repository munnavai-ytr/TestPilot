'use client';

import React, { useState } from 'react';
import {
  Copy,
  Download,
  RotateCcw,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bug as BugIcon,
  Layers,
  ArrowLeft,
  ExternalLink,
  Trash2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ApiError, Bug, BugSeverity, RunDetails, StoredRun } from '@/types/runner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ScoreRing } from '@/components/ScoreRing';
import { BugCard } from '@/components/BugCard';
import { ScreenshotModal } from '@/components/ScreenshotModal';
import { ErrorBanner } from '@/components/ErrorBanner';

interface ReportScreenProps {
  run: StoredRun;
  details: RunDetails | null;
  isLoadingDetails?: boolean;
  fetchError?: ApiError | null;
  onRetryFetch?: () => void;
  onDeleteRun?: (runId: string) => void;
  onRunAgain: (run: StoredRun) => void;
  onBack: () => void;
}

const SEVERITY_WEIGHT: Record<BugSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function ReportScreen({
  run,
  details,
  isLoadingDetails = false,
  fetchError,
  onRetryFetch,
  onDeleteRun,
  onRunAgain,
  onBack,
}: ReportScreenProps) {
  const [copied, setCopied] = useState(false);
  const [activeModalScreenshot, setActiveModalScreenshot] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const steps = details?.steps || run.details?.steps || [];
  const rawBugs = details?.bugs || run.details?.bugs || [];

  // Sort bugs by severity: Critical > High > Medium > Low
  const bugs: Bug[] = [...rawBugs].sort((a, b) => {
    const sevA = a.severity || 'low';
    const sevB = b.severity || 'low';
    return (SEVERITY_WEIGHT[sevB] || 0) - (SEVERITY_WEIGHT[sevA] || 0);
  });

  const passedCount = steps.filter((s) => s.status === 'passed').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;
  const warningCount = steps.filter((s) => s.status === 'warning').length;
  const totalSteps = steps.length || 0;

  // Derive score from details summary, stored run, or calculated fallback
  let score = details?.summary?.score ?? run.details?.summary?.score ?? run.score;
  if (score === undefined || score === null) {
    if (totalSteps > 0) {
      const deductionPerCritical = bugs.filter((b) => b.severity === 'critical').length * 25;
      const deductionPerHigh = bugs.filter((b) => b.severity === 'high').length * 15;
      const deductionPerMed = bugs.filter((b) => b.severity === 'medium').length * 8;
      const deductionPerLow = bugs.filter((b) => b.severity === 'low').length * 3;
      const failDeduction = failedCount * 5;
      score = Math.max(0, 100 - (deductionPerCritical + deductionPerHigh + deductionPerMed + deductionPerLow + failDeduction));
    } else {
      score = 100;
    }
  }

  // Generate clean Markdown Report (Gemini API key is NEVER included)
  const handleCopyMarkdown = () => {
    const mdLines = [
      `# TestPilot QA Test Report`,
      ``,
      `- **Target Website:** ${run.url}`,
      `- **Command:** ${run.command}`,
      `- **Test Mode:** ${run.mode}`,
      `- **Status:** ${(details?.status || run.lastKnownStatus).toUpperCase()}`,
      `- **Overall Score:** ${Math.round(score)}/100`,
      `- **Date:** ${new Date(run.createdAt).toLocaleString()}`,
      `- **Run ID:** \`${run.runId}\``,
      ``,
      `## Summary`,
      `- Total Steps: ${totalSteps}`,
      `- Passed Steps: ${passedCount}`,
      `- Failed Steps: ${failedCount}`,
      `- Warnings: ${warningCount}`,
      `- Total Bugs Identified: ${bugs.length}`,
      ``,
      `## Identified Bugs & Deficiencies`,
    ];

    if (bugs.length === 0) {
      mdLines.push(`*No bugs identified during this test run.*`);
    } else {
      bugs.forEach((bug, i) => {
        mdLines.push(
          `### ${i + 1}. [${(bug.severity || 'MEDIUM').toUpperCase()}] ${bug.title || 'Untitled Issue'}`
        );
        if (bug.pageUrl) mdLines.push(`- **Page URL:** ${bug.pageUrl}`);
        mdLines.push(`- **What happened:** ${bug.whatHappened || 'N/A'}`);
        mdLines.push(`- **Why it likely happened:** ${bug.whyItHappened || 'N/A'}`);
        mdLines.push(`- **How to fix it:** ${bug.howToFix || 'N/A'}`);
        if (bug.screenshot) mdLines.push(`- **Screenshot Evidence:** ${bug.screenshot}`);
        mdLines.push(``);
      });
    }

    if (steps.length > 0) {
      mdLines.push(`## Execution Steps`);
      mdLines.push(`| # | Action | Status | Duration |`);
      mdLines.push(`|---|--------|--------|----------|`);
      steps.forEach((s, idx) => {
        mdLines.push(
          `| ${s.index ?? idx + 1} | ${s.action ?? 'Step'} | ${s.status ?? 'done'} | ${
            s.durationMs ? s.durationMs + 'ms' : '-'
          } |`
        );
      });
    }

    const mdText = mdLines.join('\n');
    navigator.clipboard.writeText(mdText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download JSON Report (Gemini API key is NEVER included)
  const handleDownloadJson = () => {
    const reportData = {
      runId: run.runId,
      url: run.url,
      command: run.command,
      mode: run.mode,
      createdAt: run.createdAt,
      status: details?.status || run.lastKnownStatus,
      score,
      summary: {
        totalSteps,
        passedSteps: passedCount,
        failedSteps: failedCount,
        warningSteps: warningCount,
        bugCount: bugs.length,
      },
      bugs,
      steps,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `testpilot-report-${run.runId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  // 404 Handler: Prompt "If the Runner answers 404 for a runId, show 'This run is no longer available' and offer a Remove button."
  if (fetchError && (fetchError.isNotFound || fetchError.status === 404)) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="p-8 text-center border-dashed border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 text-[#DC2626] flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            This run is no longer available
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            The external Runner could not find records for Run ID <code className="font-mono text-zinc-700 dark:text-zinc-300">{run.runId}</code> (404 Not Found).
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" onClick={onBack}>
              Back to History
            </Button>
            {onDeleteRun && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  onDeleteRun(run.runId);
                  onBack();
                }}
                icon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
              >
                Remove
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onBack}
            icon={<ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                QA Test Report
              </h1>
              <Badge status={details?.status || run.lastKnownStatus} />
              <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-zinc-50 dark:bg-zinc-900">
                {run.mode.toUpperCase()}
              </span>
              {isLoadingDetails && (
                <span className="text-[11px] text-[#3B5BDB] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                  <span>Loading full report...</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <a
                href={run.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-[#3B5BDB] transition-colors truncate max-w-md flex items-center gap-1"
              >
                <span>{run.url}</span>
                <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              </a>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Copy Markdown, Download JSON, Run Again */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyMarkdown}
            disabled={isLoadingDetails}
            icon={
              copied ? (
                <Check className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.5} />
              ) : (
                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
              )
            }
          >
            {copied ? 'Copied' : 'Copy as Markdown'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadJson}
            disabled={isLoadingDetails}
            icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Download JSON
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => onRunAgain(run)}
            icon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Run again
          </Button>
        </div>
      </div>

      {/* Fetch Error Banner if non-404 */}
      {fetchError && (
        <ErrorBanner error={fetchError} onRetry={onRetryFetch} />
      )}

      {/* Skeleton Loader during fetch */}
      {isLoadingDetails ? (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-3 flex justify-center md:border-r border-zinc-200 dark:border-zinc-800 md:pr-6">
                <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              </div>
              <div className="md:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="h-5 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-44 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
            <div className="h-44 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* Summary Row */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Quality Score Ring */}
              <div className="md:col-span-3 flex justify-center md:border-r border-zinc-200 dark:border-zinc-800 md:pr-6">
                <ScoreRing score={score} size={92} strokeWidth={7} label="Quality Score" />
              </div>

              {/* Metric Stats */}
              <div className="md:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {/* Total Steps */}
                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 mb-1">
                    <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="font-medium">Total Steps</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {totalSteps}
                  </span>
                </div>

                {/* Passed */}
                <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.5} />
                    <span className="font-medium">Passed</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {passedCount}
                  </span>
                </div>

                {/* Failed */}
                <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 mb-1">
                    <XCircle className="w-3.5 h-3.5 text-[#DC2626]" strokeWidth={1.5} />
                    <span className="font-medium">Failed</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-red-800 dark:text-red-300 tabular-nums">
                    {failedCount}
                  </span>
                </div>

                {/* Warnings / Bugs */}
                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 mb-1">
                    <BugIcon className="w-3.5 h-3.5 text-[#EA580C]" strokeWidth={1.5} />
                    <span className="font-medium">Bugs Found</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {bugs.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Command info banner */}
            <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <span className="text-zinc-500 dark:text-zinc-400">
                Instruction: <span className="font-mono text-zinc-800 dark:text-zinc-200">{run.command}</span>
              </span>
              {warningCount > 0 && (
                <span className="text-[#CA8A04] flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{warningCount} warning step(s) encountered</span>
                </span>
              )}
            </div>
          </Card>

          {/* Bug List (Sorted by Severity: Critical, High, Medium, Low) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Identified Bugs & Regressions
                </h2>
                <span className="text-xs font-mono text-zinc-500 tabular-nums">
                  ({bugs.length})
                </span>
              </div>

              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Sorted by severity
              </span>
            </div>

            {bugs.length === 0 ? (
              <Card className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto mb-2" strokeWidth={1.5} />
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                  Zero Bugs Detected
                </h3>
                <p className="mt-1 text-zinc-500 max-w-md mx-auto">
                  All QA test assertions passed without regression or user flow blockers.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {bugs.map((bug, index) => (
                  <BugCard
                    key={bug.id || `bug-${index}`}
                    bug={bug}
                    onViewScreenshot={(src, title) =>
                      setActiveModalScreenshot({ url: src, title })
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Execution Steps Breakdown */}
          {steps.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 flex items-center justify-between text-xs">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Full Step Trace
                </h3>
                <span className="font-mono text-zinc-500 tabular-nums text-[11px]">
                  {steps.length} total operations
                </span>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs font-mono">
                {steps.map((step, idx) => {
                  const num = step.index !== undefined ? step.index : idx + 1;
                  const isFailed = step.status === 'failed';
                  return (
                    <div
                      key={num}
                      className={`px-5 py-2.5 flex items-center justify-between gap-3 ${
                        isFailed ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-zinc-400 text-[11px] w-5 text-right shrink-0">
                          {String(num).padStart(2, '0')}
                        </span>
                        <Badge status={step.status} />
                        <span className="font-sans text-xs text-zinc-800 dark:text-zinc-200 truncate">
                          {step.action || 'Action'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-[11px] text-zinc-500">
                        <span>{step.durationMs ? `${step.durationMs}ms` : '—'}</span>
                        {step.screenshot && (
                          <button
                            onClick={() =>
                              setActiveModalScreenshot({
                                url: step.screenshot!,
                                title: `Step ${num}: ${step.action}`,
                              })
                            }
                            className="text-[#3B5BDB] dark:text-blue-400 hover:underline font-sans text-xs"
                          >
                            View Shot
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Lightbox Screenshot Modal */}
      <ScreenshotModal
        isOpen={!!activeModalScreenshot}
        onClose={() => setActiveModalScreenshot(null)}
        screenshotUrl={activeModalScreenshot?.url || null}
        title={activeModalScreenshot?.title || 'Bug Screenshot'}
      />
    </div>
  );
}
