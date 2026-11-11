'use client';

import React, { useState } from 'react';
import { Maximize2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { ScreenshotModal } from './ScreenshotModal';

interface ScreenshotViewerProps {
  screenshotUrl?: string | null;
  stepIndex?: number;
  stepAction?: string;
  isLive?: boolean;
}

export function ScreenshotViewer({
  screenshotUrl,
  stepIndex,
  stepAction,
  isLive = true,
}: ScreenshotViewerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        {/* Header bar */}
        <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs bg-zinc-50/70 dark:bg-zinc-900/90">
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Live Browser View
            </span>
            {stepIndex !== undefined && (
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                (Step {stepIndex})
              </span>
            )}
            {stepAction && (
              <span className="text-zinc-500 dark:text-zinc-400 truncate hidden sm:inline">
                — {stepAction}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {screenshotUrl && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 transition-colors"
                title="Expand full screen"
              >
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Expand</span>
              </button>
            )}
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 min-h-[360px] p-4 flex items-center justify-center bg-zinc-100/60 dark:bg-zinc-950/60 overflow-hidden relative">
          {screenshotUrl ? (
            <div
              onClick={() => setModalOpen(true)}
              className="relative group cursor-zoom-in max-h-full max-w-full flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshotUrl}
                alt={stepAction || 'Live QA runner screenshot'}
                referrerPolicy="no-referrer"
                className="max-h-[580px] w-auto max-w-full object-contain rounded border border-zinc-200 dark:border-zinc-800 shadow-sm"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <span className="px-3 py-1.5 rounded-md bg-black/75 text-white text-xs font-medium backdrop-blur-xs flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Click to inspect full resolution
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 text-zinc-400 dark:text-zinc-500 max-w-sm">
              {isLive ? (
                <>
                  <div className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center mb-3 text-[#3B5BDB]">
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Awaiting Browser Stream
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Runner has initiated the headless browser session. Screenshots will render as steps execute.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center mb-3">
                    <ImageIcon className="w-5 h-5 opacity-40" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    No Screenshot Available
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    The selected step did not record visual evidence.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ScreenshotModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        screenshotUrl={screenshotUrl || null}
        title={stepAction ? `Step ${stepIndex || ''}: ${stepAction}` : 'Browser Screenshot'}
      />
    </>
  );
}
