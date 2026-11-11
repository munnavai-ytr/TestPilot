'use client';

import React, { useEffect } from 'react';
import {
  ExternalLink,
  Trash2,
  PlayCircle,
  FileText,
  Clock,
  Bug as BugIcon,
  Radio,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { StoredRun } from '@/types/runner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface HistoryScreenProps {
  runs: StoredRun[];
  onOpenRun: (run: StoredRun) => void;
  onNewTest: () => void;
  onDeleteRun: (runId: string) => void;
  onClearHistory: () => void;
  onRefreshRunningRuns: () => void;
  isRefreshing?: boolean;
  unavailableRunIds?: Set<string>;
}

export function HistoryScreen({
  runs,
  onOpenRun,
  onNewTest,
  onDeleteRun,
  onClearHistory,
  onRefreshRunningRuns,
  isRefreshing = false,
  unavailableRunIds = new Set(),
}: HistoryScreenProps) {
  // When History page loads, check status of all runs not yet finished
  useEffect(() => {
    onRefreshRunningRuns();
  }, [onRefreshRunningRuns]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Test Run History
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Review past automated QA test audits. Active runs update status from the Runner automatically.
          </p>
        </div>

        {runs.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRefreshRunningRuns}
              loading={isRefreshing}
              icon={<RefreshCw className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />}
            >
              Sync Status
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClearHistory}
              icon={<Trash2 className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={onNewTest}
              icon={<PlayCircle className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              New Test
            </Button>
          </div>
        )}
      </div>

      {/* Runs List or Empty State */}
      {runs.length === 0 ? (
        <Card className="p-12 text-center text-xs text-zinc-500 dark:text-zinc-400 border-dashed">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No Test Runs in History
          </h2>
          <p className="mt-1 max-w-sm mx-auto text-zinc-500">
            Completed QA sessions and bug reports are stored locally in your browser. Launch a test to view records here.
          </p>
          <div className="mt-5">
            <Button size="md" variant="primary" onClick={onNewTest}>
              Create First Test
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const dateStr = new Date(run.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            const score = run.score !== undefined ? Math.round(run.score) : '—';
            const status = run.lastKnownStatus || 'running';
            const isRunning = status === 'running';
            const isUnavailable = unavailableRunIds.has(run.runId);

            return (
              <Card
                key={run.runId}
                className="p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div
                    onClick={() => !isUnavailable && onOpenRun(run)}
                    className={`flex-1 min-w-0 ${isUnavailable ? 'opacity-70' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {/* History status pill: Running, Completed, Failed, Stopped */}
                      <Badge status={status} />
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 uppercase">
                        {run.mode}
                      </span>
                      <span className="text-xs text-zinc-400">·</span>
                      <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {dateStr}
                      </span>
                      <span className="text-xs text-zinc-400">·</span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        ID: {run.runId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate mt-1">
                      <span className="truncate">{run.url}</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" strokeWidth={1.5} />
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xl mt-0.5 font-sans">
                      Command: {run.command}
                    </p>

                    {/* 404 notice if runner reports unavailable */}
                    {isUnavailable && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                        <span>This run is no longer available on the Runner.</span>
                      </div>
                    )}
                  </div>

                  {/* Middle: Metrics (Score, Bugs) */}
                  {!isUnavailable && (
                    <div
                      onClick={() => onOpenRun(run)}
                      className="flex items-center gap-4 cursor-pointer shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800"
                    >
                      {/* Score */}
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-medium text-zinc-400 block">
                          Score
                        </span>
                        <span className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                          {score}
                          {typeof score === 'number' && (
                            <span className="text-[11px] font-normal text-zinc-400">/100</span>
                          )}
                        </span>
                      </div>

                      {/* Bugs */}
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-medium text-zinc-400 block">
                          Bugs
                        </span>
                        <span className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums flex items-center justify-end gap-1">
                          <BugIcon className="w-3.5 h-3.5 text-[#EA580C]" strokeWidth={1.5} />
                          {run.bugCount}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isUnavailable ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onDeleteRun(run.runId)}
                        icon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      >
                        Remove
                      </Button>
                    ) : isRunning ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onOpenRun(run)}
                        icon={<Radio className="w-3.5 h-3.5 animate-pulse" strokeWidth={1.5} />}
                      >
                        Resume Live Run
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenRun(run)}
                        icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      >
                        Report
                      </Button>
                    )}

                    {!isUnavailable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRun(run.runId);
                        }}
                        className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Delete from history"
                        aria-label="Delete run"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
