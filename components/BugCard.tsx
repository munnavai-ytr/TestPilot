'use client';

import React from 'react';
import { ExternalLink, ZoomIn, Image as ImageIcon } from 'lucide-react';
import { Bug } from '@/types/runner';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

interface BugCardProps {
  bug: Bug;
  onViewScreenshot: (src: string, title: string) => void;
}

export function BugCard({ bug, onViewScreenshot }: BugCardProps) {
  const severity = bug.severity || 'medium';

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge severity={severity} />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {bug.title || 'Untitled Bug'}
          </h3>
        </div>

        {bug.pageUrl && (
          <a
            href={bug.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 truncate max-w-xs transition-colors"
            title={bug.pageUrl}
          >
            <span className="truncate">{bug.pageUrl}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={1.5} />
          </a>
        )}
      </div>

      {/* Main Body */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Sections: What Happened, Why It Happened, How To Fix */}
        <div className="md:col-span-8 space-y-3.5 text-xs leading-relaxed">
          {/* Section 1: What happened */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider text-[11px] mb-1">
              What happened
            </h4>
            <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300">
              {bug.whatHappened || 'No description provided by the runner.'}
            </div>
          </div>

          {/* Section 2: Why it likely happened */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider text-[11px] mb-1">
              Why it likely happened
            </h4>
            <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300">
              {bug.whyItHappened || 'Probable root cause not specified.'}
            </div>
          </div>

          {/* Section 3: How to fix it */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider text-[11px] mb-1">
              How to fix it
            </h4>
            <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 font-mono text-[11.5px]">
              {bug.howToFix || 'Fix recommendation not available.'}
            </div>
          </div>
        </div>

        {/* Screenshot preview */}
        <div className="md:col-span-4 flex flex-col">
          <span className="font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider text-[11px] mb-1">
            Screenshot Evidence
          </span>
          {bug.screenshot ? (
            <button
              type="button"
              onClick={() => onViewScreenshot(bug.screenshot!, bug.title || 'Bug Screenshot')}
              className="relative group rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 aspect-video flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bug.screenshot}
                alt={bug.title || 'Bug screenshot evidence'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                <ZoomIn className="w-4 h-4" strokeWidth={1.5} />
                <span>Click to zoom</span>
              </div>
            </button>
          ) : (
            <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 aspect-video flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs">
              <ImageIcon className="w-5 h-5 mb-1 opacity-50" strokeWidth={1.5} />
              <span>No screenshot captured</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
