import React from 'react';
import { cn } from '@/lib/utils';
import { BugSeverity, RunStatus, StepStatus } from '@/types/runner';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'severity' | 'status' | 'neutral';
  severity?: BugSeverity;
  status?: RunStatus | StepStatus;
}

export function Badge({
  className,
  variant = 'neutral',
  severity,
  status,
  children,
  ...props
}: BadgeProps) {
  // Severity badges: critical #DC2626, high #EA580C, medium #CA8A04, low #2563EB, success #16A34A
  if (variant === 'severity' || severity) {
    const sev = severity || 'low';
    const severityStyles: Record<BugSeverity, string> = {
      critical:
        'bg-red-50 text-[#DC2626] border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
      high:
        'bg-orange-50 text-[#EA580C] border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50',
      medium:
        'bg-amber-50 text-[#CA8A04] border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
      low:
        'bg-blue-50 text-[#2563EB] border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border tabular-nums capitalize tracking-wide select-none',
          severityStyles[sev],
          className
        )}
        {...props}
      >
        {children || sev}
      </span>
    );
  }

  if (variant === 'status' || status) {
    const st = status || 'running';
    const statusStyles: Record<string, string> = {
      running:
        'bg-blue-50 text-[#3B5BDB] border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
      completed:
        'bg-emerald-50 text-[#16A34A] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
      passed:
        'bg-emerald-50 text-[#16A34A] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
      failed:
        'bg-red-50 text-[#DC2626] border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
      stopped:
        'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
      warning:
        'bg-amber-50 text-[#CA8A04] border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize tabular-nums select-none',
          statusStyles[st] || 'bg-zinc-100 text-zinc-700 border-zinc-200',
          className
        )}
        {...props}
      >
        {children || st}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 select-none',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
