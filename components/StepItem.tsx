import React from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { Step } from '@/types/runner';
import { cn } from '@/lib/utils';

interface StepItemProps {
  step: Step;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null || isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function StepItem({ step, isSelected = false, onSelect }: StepItemProps) {
  const status = step.status || 'running';
  const isFailed = status === 'failed';

  let StatusIcon = Loader2;
  let iconClass = 'text-[#3B5BDB] animate-spin';

  if (status === 'passed') {
    StatusIcon = CheckCircle2;
    iconClass = 'text-[#16A34A]';
  } else if (status === 'failed') {
    StatusIcon = XCircle;
    iconClass = 'text-[#DC2626]';
  } else if (status === 'warning') {
    StatusIcon = AlertTriangle;
    iconClass = 'text-[#CA8A04]';
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left group flex items-start gap-3 p-3 rounded-lg border transition-all text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]',
        isFailed
          ? 'border-red-300 dark:border-red-800/80 bg-red-50/50 dark:bg-red-950/20 hover:border-red-400'
          : isSelected
          ? 'border-[#3B5BDB] bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
      )}
    >
      {/* Index & Status */}
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <span className="font-mono text-zinc-400 dark:text-zinc-500 text-[11px] w-5 tabular-nums text-right">
          {step.index !== undefined ? String(step.index).padStart(2, '0') : '—'}
        </span>
        <StatusIcon className={cn('w-4 h-4 shrink-0', iconClass)} strokeWidth={1.5} />
      </div>

      {/* Action Text */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-900 dark:text-zinc-100 break-words leading-relaxed">
          {step.action || 'Executing action...'}
        </p>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="font-mono tabular-nums">{formatDuration(step.durationMs)}</span>
          {step.screenshot && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-[#3B5BDB] dark:text-blue-400">
                <ImageIcon className="w-3 h-3" strokeWidth={1.5} />
                <span>Screenshot</span>
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
