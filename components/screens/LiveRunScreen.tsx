'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Square, FileText, ArrowLeft, RefreshCw, Server, AlertCircle } from 'lucide-react';
import { ApiError, RunDetails, RunStatus, Step } from '@/types/runner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StepItem } from '@/components/StepItem';
import { ScreenshotViewer } from '@/components/ScreenshotViewer';
import { ErrorBanner } from '@/components/ErrorBanner';

interface LiveRunScreenProps {
  runId: string;
  url: string;
  command: string;
  details: RunDetails | null;
  status: RunStatus;
  elapsedSeconds: number;
  onStop: () => void;
  onViewReport: () => void;
  onBackToNew: () => void;
  isStopping: boolean;
  error: ApiError | null;
  onRetryPoll: () => void;
}

export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LiveRunScreen({
  runId,
  url,
  command,
  details,
  status,
  elapsedSeconds,
  onStop,
  onViewReport,
  onBackToNew,
  isStopping,
  error,
  onRetryPoll,
}: LiveRunScreenProps) {
  const steps: Step[] = details?.steps || [];
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

  const stepsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest step as new steps stream in
  useEffect(() => {
    if (selectedStepIndex === null && steps.length > 0) {
      stepsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [steps.length, selectedStepIndex]);

  // Find latest step with screenshot if none selected
  const latestStepWithScreenshot = [...steps].reverse().find((s) => !!s.screenshot);
  const selectedStep = selectedStepIndex !== null
    ? steps.find((s) => s.index === selectedStepIndex)
    : latestStepWithScreenshot || steps[steps.length - 1];

  const currentScreenshot = selectedStep?.screenshot || null;
  const currentStepIndex = selectedStep?.index;
  const currentStepAction = selectedStep?.action;

  const isTerminal = status === 'completed' || status === 'failed' || status === 'stopped';

  // Check if runner returned an optional error in GET response
  const runnerReturnedError = details?.error?.message ? details.error.message : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Top Bar: URL, Elapsed Timer, Stop Button, Status Pill */}
      <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Back button & Target URL */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToNew}
            aria-label="Back to New Test"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#3B5BDB] dark:hover:text-blue-400 transition-colors truncate max-w-xs sm:max-w-md flex items-center gap-1.5"
                title={url}
              >
                <span className="truncate">{url}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" strokeWidth={1.5} />
              </a>
              <Badge status={status} />
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-xs sm:max-w-lg mt-0.5">
              Command: {command}
            </p>
          </div>
        </div>

        {/* Right: Elapsed timer, Stop, View Report */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
            <span className="text-[10px] text-zinc-400 font-sans uppercase">Elapsed</span>
            <span className="font-semibold">{formatElapsed(elapsedSeconds)}</span>
          </div>

          {!isTerminal ? (
            <Button
              size="sm"
              variant="danger"
              onClick={onStop}
              loading={isStopping}
              icon={<Square className="w-3 h-3 fill-current shrink-0" strokeWidth={1.5} />}
            >
              Stop Run
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={onViewReport}
              icon={<FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />}
            >
              View Report
            </Button>
          )}
        </div>
      </header>

      {/* Background Run Notice (Mandatory Prompt Requirement) */}
      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <Server className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.5} />
          <span className="truncate">
            The test keeps running on the server. You can close this page and open the run later from History.
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-400 shrink-0">ID: {runId}</span>
      </div>

      {/* Inline Error Banner if polling or network failed */}
      {error && (
        <div className="px-4 pt-3 shrink-0">
          <ErrorBanner error={error} onRetry={onRetryPoll} />
        </div>
      )}

      {/* Runner response error object banner if status is failed */}
      {((status === 'failed' && details?.error?.message) || runnerReturnedError) && !error && (
        <div className="px-4 pt-3 shrink-0">
          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 p-3 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <span className="font-semibold block">Test Error</span>
              <p className="mt-0.5 text-red-800 dark:text-red-300 leading-relaxed font-normal">
                {details?.error?.message || runnerReturnedError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Split Layout: Left Timeline, Right Screenshot */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto lg:overflow-hidden">
        {/* Left Column: Vertical Timeline of Steps */}
        <div className="lg:col-span-5 flex flex-col h-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
          {/* Timeline Header */}
          <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                Execution Steps
              </span>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                ({steps.length})
              </span>
            </div>

            {selectedStepIndex !== null && (
              <button
                onClick={() => setSelectedStepIndex(null)}
                className="text-[11px] text-[#3B5BDB] dark:text-blue-400 hover:underline font-medium"
              >
                Follow Latest
              </button>
            )}
          </div>

          {/* Steps List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {steps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mb-2 text-[#3B5BDB]" strokeWidth={1.5} />
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  Starting the test machine. This can take 1 to 2 minutes.
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                  Preparing isolated browser session and opening <span className="font-mono">{url}</span>.
                </p>
              </div>
            ) : (
              <>
                {steps.map((step, idx) => {
                  const stepNum = step.index !== undefined ? step.index : idx + 1;
                  return (
                    <StepItem
                      key={stepNum}
                      step={{ ...step, index: stepNum }}
                      isSelected={selectedStepIndex === stepNum}
                      onSelect={() => setSelectedStepIndex(stepNum)}
                    />
                  );
                })}
                <div ref={stepsEndRef} />
              </>
            )}
          </div>

          {/* Terminal Banner at bottom of timeline if completed */}
          {isTerminal && (
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">
                Run finished with status: <strong className="capitalize">{status}</strong>
              </span>
              <Button size="sm" variant="primary" onClick={onViewReport}>
                Inspect Report
              </Button>
            </div>
          )}
        </div>

        {/* Right Column: Screenshot Viewer */}
        <div className="lg:col-span-7 h-full">
          <ScreenshotViewer
            screenshotUrl={currentScreenshot}
            stepIndex={currentStepIndex}
            stepAction={currentStepAction}
            isLive={!isTerminal}
          />
        </div>
      </div>
    </div>
  );
}
