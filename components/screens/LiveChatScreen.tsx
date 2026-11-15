'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ExternalLink,
  Square,
  ArrowLeft,
  Sparkles,
  Loader2,
  Check,
  X,
  ArrowDown,
  MessageSquare,
  Monitor,
  CheckCircle2,
  XCircle,
  Bug as BugIcon,
  ZoomIn,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { ApiError, ChatMessage, RunDetails, RunStatus, Step } from '@/types/runner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ScoreRing } from '@/components/ScoreRing';
import { StepItem } from '@/components/StepItem';
import { ScreenshotModal } from '@/components/ScreenshotModal';
import { ErrorBanner } from '@/components/ErrorBanner';

interface LiveChatScreenProps {
  runId: string;
  url: string;
  command: string;
  details: RunDetails | null;
  status: RunStatus;
  elapsedSeconds: number;
  isLoadingDetails?: boolean;
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

interface ChatMessageItemProps {
  message: ChatMessage;
  onOpenScreenshot: (url: string, title: string) => void;
}

const ChatMessageItem = React.memo(
  function ChatMessageItem({ message, onOpenScreenshot }: ChatMessageItemProps) {
    if (message.type === 'summary') {
      return null;
    }

    if (message.type === 'system') {
      const isFailed = message.state === 'failed';
      return (
        <div
          dir="auto"
          className={`text-center text-[11px] py-1 px-2 [overflow-wrap:anywhere] leading-relaxed ${
            isFailed
              ? 'text-[#DC2626] dark:text-red-400 font-medium'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {message.text}
        </div>
      );
    }

    if (message.type === 'finding') {
      const severity = message.severity || 'medium';
      return (
        <div className="rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 max-w-full sm:max-w-[85%] space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge severity={severity} />
            {message.caption && (
              <span
                dir="auto"
                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]"
              >
                {message.caption}
              </span>
            )}
          </div>

          {message.text && (
            <p
              dir="auto"
              className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
            >
              {message.text}
            </p>
          )}

          {message.screenshot && (
            <button
              type="button"
              onClick={() =>
                onOpenScreenshot(message.screenshot!, message.caption || 'Finding Screenshot')
              }
              className="block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.screenshot}
                alt={message.caption || 'Finding screenshot'}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="max-h-[160px] w-auto max-w-full object-contain"
              />
            </button>
          )}
        </div>
      );
    }

    // type === 'ai'
    return (
      <div className="flex items-start gap-2.5 max-w-full sm:max-w-[88%]">
        {/* 28px round avatar */}
        <div
          className="w-7 h-7 rounded-full bg-[#3B5BDB]/10 dark:bg-blue-500/15 text-[#3B5BDB] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
        </div>

        <div className="flex-1 min-w-0 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-2">
          {(message.caption || message.state) && (
            <div className="flex items-center justify-between gap-2">
              <span
                dir="auto"
                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]"
              >
                {message.caption || 'Test update'}
              </span>

              {message.state === 'running' && (
                <Loader2
                  className="w-3.5 h-3.5 text-[#3B5BDB] animate-spin motion-reduce:animate-none shrink-0"
                  strokeWidth={1.75}
                />
              )}
              {message.state === 'done' && (
                <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" strokeWidth={2} />
              )}
              {message.state === 'failed' && (
                <X className="w-3.5 h-3.5 text-[#DC2626] shrink-0" strokeWidth={2} />
              )}
            </div>
          )}

          {message.text && (
            <p
              dir="auto"
              className="text-xs sm:text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
            >
              {message.text}
            </p>
          )}

          {message.screenshot && (
            <button
              type="button"
              onClick={() =>
                onOpenScreenshot(message.screenshot!, message.caption || 'Step Screenshot')
              }
              className="block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.screenshot}
                alt={message.caption || 'Step screenshot'}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="max-h-[160px] w-auto max-w-full object-contain"
              />
            </button>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.text === next.message.text &&
    prev.message.caption === next.message.caption &&
    prev.message.state === next.message.state &&
    prev.message.screenshot === next.message.screenshot &&
    prev.message.severity === next.message.severity &&
    prev.message.type === next.message.type
);

export function LiveChatScreen({
  url,
  details,
  status,
  elapsedSeconds,
  isLoadingDetails = false,
  onStop,
  onViewReport,
  onBackToNew,
  isStopping,
  error,
  onRetryPoll,
}: LiveChatScreenProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'browser'>('chat');
  const [selectedBrowserStepIndex, setSelectedBrowserStepIndex] = useState<number | null>(null);
  const [modalShot, setModalShot] = useState<{ url: string; title: string } | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const isTerminal = status === 'completed' || status === 'failed' || status === 'stopped';
  const steps: Step[] = useMemo(() => details?.steps || [], [details?.steps]);
  const bugs = useMemo(() => details?.bugs || [], [details?.bugs]);
  const budget = details?.budget;
  const liveStatus = details?.liveStatus || null;

  // Build display messages (with fallback for older runs that only have steps)
  const displayMessages: ChatMessage[] = useMemo(() => {
    const rawMessages = details?.messages;
    if (Array.isArray(rawMessages) && rawMessages.length > 0) {
      return rawMessages;
    }
    if (steps.length > 0) {
      return steps.map((step, idx) => {
        const num = step.index !== undefined ? step.index : idx + 1;
        return {
          id: `legacy-step-${num}`,
          type: 'system' as const,
          text: step.action || `Step ${num}`,
          state:
            step.status === 'failed'
              ? ('failed' as const)
              : step.status === 'running'
              ? ('running' as const)
              : ('done' as const),
          stepIndex: num,
        };
      });
    }
    return [];
  }, [details?.messages, steps]);

  // Compute summary numbers for final report card
  const passedCount = useMemo(
    () => steps.filter((s) => s.status === 'passed').length,
    [steps]
  );
  const failedCount = useMemo(
    () => steps.filter((s) => s.status === 'failed').length,
    [steps]
  );

  const computedScore = useMemo(() => {
    const s = details?.summary?.score;
    if (typeof s === 'number') return s;
    const dedCrit = bugs.filter((b) => b.severity === 'critical').length * 25;
    const dedHigh = bugs.filter((b) => b.severity === 'high').length * 15;
    const dedMed = bugs.filter((b) => b.severity === 'medium').length * 8;
    const dedLow = bugs.filter((b) => b.severity === 'low').length * 3;
    return Math.max(0, 100 - (dedCrit + dedHigh + dedMed + dedLow + failedCount * 5));
  }, [details?.summary?.score, bugs, failedCount]);

  // Auto-scroll chat when near bottom
  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(distance < 80);
  }, []);

  const scrollToLatest = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setIsNearBottom(true);
  }, []);

  const lastMessageId = displayMessages[displayMessages.length - 1]?.id || '';
  const lastMessageState = displayMessages[displayMessages.length - 1]?.state || '';

  useEffect(() => {
    if (activeTab !== 'chat') return;
    if (!isNearBottom) return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeTab, displayMessages.length, lastMessageId, lastMessageState, liveStatus, status, isNearBottom]);

  const handleOpenScreenshot = useCallback((shotUrl: string, title: string) => {
    setModalShot({ url: shotUrl, title });
  }, []);

  // Browser tab computed data
  const stepsWithScreenshots = useMemo(
    () =>
      steps
        .map((s, idx) => ({
          ...s,
          resolvedIndex: s.index !== undefined ? s.index : idx + 1,
        }))
        .filter((s) => !!s.screenshot),
    [steps]
  );

  const latestAiMessage = useMemo(() => {
    const raw = details?.messages || [];
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].type === 'ai' && (raw[i].caption || raw[i].text)) {
        return raw[i];
      }
    }
    return null;
  }, [details?.messages]);

  const activeBrowserShot = useMemo(() => {
    if (selectedBrowserStepIndex !== null) {
      const match = stepsWithScreenshots.find((s) => s.resolvedIndex === selectedBrowserStepIndex);
      if (match) return match;
    }
    return stepsWithScreenshots[stepsWithScreenshots.length - 1] || null;
  }, [selectedBrowserStepIndex, stepsWithScreenshots]);

  // Fallback latest screenshot from AI message if steps have no screenshots yet
  const fallbackAiShot = useMemo(() => {
    const raw = details?.messages || [];
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].screenshot) return raw[i];
    }
    return null;
  }, [details?.messages]);

  const displayedScreenshotUrl =
    activeBrowserShot?.screenshot || fallbackAiShot?.screenshot || null;

  const displayedCaption =
    selectedBrowserStepIndex !== null && activeBrowserShot
      ? activeBrowserShot.action || `Step ${activeBrowserShot.resolvedIndex}`
      : latestAiMessage?.caption ||
        latestAiMessage?.text ||
        activeBrowserShot?.action ||
        null;

  const showBudgetMeter = budget && typeof budget.max === 'number' && budget.max > 0;
  const budgetPercent = showBudgetMeter
    ? Math.min(100, Math.max(0, Math.round((budget.used / budget.max) * 100)))
    : 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-6.75rem)] md:h-dvh overflow-hidden">
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-20 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Back button, Target URL, Status pill */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBackToNew}
              aria-label="Back to New Test"
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#3B5BDB] dark:hover:text-blue-400 transition-colors truncate flex items-center gap-1.5 min-w-0"
                title={url}
              >
                <span className="truncate">{url}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" strokeWidth={1.5} />
              </a>
              <Badge status={status} className="shrink-0" />
            </div>
          </div>

          {/* Right: Elapsed timer + Stop button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold">{formatElapsed(elapsedSeconds)}</span>
            </div>

            {!isTerminal && (
              <Button
                size="sm"
                variant="danger"
                onClick={onStop}
                loading={isStopping}
                icon={<Square className="w-3 h-3 fill-current shrink-0" strokeWidth={1.5} />}
              >
                Stop
              </Button>
            )}
          </div>
        </div>

        {/* Gemini requests budget meter (hidden when max is 0 or missing) */}
        {showBudgetMeter && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
              <span>
                Gemini requests {budget.used}/{budget.max}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-[#3B5BDB] transition-all duration-300"
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Tabs: Chat & Browser */}
      <div className="px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`inline-flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'chat'
              ? 'border-[#3B5BDB] text-zinc-900 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('browser')}
          className={`inline-flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'browser'
              ? 'border-[#3B5BDB] text-zinc-900 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Browser</span>
        </button>
      </div>

      {/* Inline Polling / Network Warning Banner */}
      {error && (
        <div className="px-4 pt-3 shrink-0">
          <ErrorBanner error={error} onRetry={onRetryPoll} />
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'chat' ? (
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {isLoadingDetails && displayMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                <Loader2
                  className="w-5 h-5 animate-spin motion-reduce:animate-none text-[#3B5BDB] mb-2"
                  strokeWidth={1.5}
                />
                <span>Loading conversation...</span>
              </div>
            ) : displayMessages.length === 0 && status === 'running' ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 max-w-sm w-full space-y-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#3B5BDB]/10 dark:bg-blue-500/15 text-[#3B5BDB] dark:text-blue-400 flex items-center justify-center mx-auto">
                    <Loader2
                      className="w-4 h-4 animate-spin motion-reduce:animate-none"
                      strokeWidth={1.75}
                    />
                  </div>
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
                    Starting the test machine. This usually takes about a minute.
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    The test keeps running on the server. You can close this page and open it later from History.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {displayMessages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    onOpenScreenshot={handleOpenScreenshot}
                  />
                ))}

                {/* Live Status Chip while running */}
                {status === 'running' && liveStatus && (
                  <div className="pt-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-300">
                      <span
                        className="w-2 h-2 rounded-full bg-[#3B5BDB] motion-safe:animate-pulse shrink-0"
                        aria-hidden="true"
                      />
                      <span dir="auto" className="[overflow-wrap:anywhere]">
                        {liveStatus}
                      </span>
                    </div>
                  </div>
                )}

                {/* Failed Error Line */}
                {status === 'failed' && details?.error?.message && (
                  <div
                    dir="auto"
                    className="text-center text-xs text-[#DC2626] dark:text-red-400 font-medium py-1.5 px-2 [overflow-wrap:anywhere]"
                  >
                    {details.error.message}
                  </div>
                )}

                {/* Final Report Card when terminal */}
                {isTerminal && (
                  <div className="pt-2">
                    <div className="rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                        <div className="shrink-0 flex justify-center sm:justify-start">
                          <ScoreRing
                            score={computedScore}
                            size={76}
                            strokeWidth={6}
                            label="Score"
                          />
                        </div>

                        <div className="flex-1 grid grid-cols-3 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40">
                            <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 mb-1 text-[11px]">
                              <BugIcon className="w-3.5 h-3.5 text-[#EA580C] shrink-0" strokeWidth={1.5} />
                              <span className="truncate">Bugs</span>
                            </div>
                            <span className="text-base font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                              {bugs.length}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 mb-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" strokeWidth={1.5} />
                              <span className="truncate">Passed</span>
                            </div>
                            <span className="text-base font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
                              {passedCount}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
                            <div className="flex items-center gap-1 text-red-700 dark:text-red-400 mb-1 text-[11px]">
                              <XCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" strokeWidth={1.5} />
                              <span className="truncate">Failed</span>
                            </div>
                            <span className="text-base font-bold font-mono tabular-nums text-red-800 dark:text-red-300">
                              {failedCount}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={onViewReport}
                          icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          View full report
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Floating "Jump to latest" button when scrolled up */}
          {!isNearBottom && displayMessages.length > 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={scrollToLatest}
                className="shadow-md"
                icon={<ArrowDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
              >
                Jump to latest
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Browser Tab */
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {/* Large Latest / Selected Screenshot */}
          <div className="rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {displayedScreenshotUrl ? (
              <button
                type="button"
                onClick={() =>
                  handleOpenScreenshot(
                    displayedScreenshotUrl,
                    displayedCaption || 'Browser Screenshot'
                  )
                }
                className="relative group w-full bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayedScreenshotUrl}
                  alt={displayedCaption || 'Browser viewport screenshot'}
                  referrerPolicy="no-referrer"
                  className="max-h-[420px] w-auto max-w-full object-contain rounded border border-zinc-200 dark:border-zinc-800"
                />
                <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-md bg-black/70 text-white text-[11px] flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Expand</span>
                </div>
              </button>
            ) : (
              <div className="p-10 text-center flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs">
                <ImageIcon className="w-7 h-7 mb-2 opacity-50" strokeWidth={1.5} />
                <span>No screenshots captured yet</span>
              </div>
            )}

            {displayedCaption && (
              <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80">
                <p
                  dir="auto"
                  className="text-xs text-zinc-700 dark:text-zinc-300 [overflow-wrap:anywhere] leading-relaxed"
                >
                  {displayedCaption}
                </p>
              </div>
            )}
          </div>

          {/* Horizontal Scrollable Strip of All Step Screenshots */}
          {stepsWithScreenshots.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">
                Step Screenshots ({stepsWithScreenshots.length})
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                {stepsWithScreenshots.map((step) => {
                  const isActive = activeBrowserShot?.resolvedIndex === step.resolvedIndex;
                  return (
                    <button
                      key={step.resolvedIndex}
                      type="button"
                      onClick={() => setSelectedBrowserStepIndex(step.resolvedIndex)}
                      className={`shrink-0 rounded-lg overflow-hidden border transition-all bg-zinc-100 dark:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] ${
                        isActive
                          ? 'border-[#3B5BDB] ring-1 ring-[#3B5BDB]'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={step.screenshot!}
                        alt={step.action || `Step ${step.resolvedIndex}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-16 w-24 object-cover block"
                      />
                      <div className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-center">
                        #{String(step.resolvedIndex).padStart(2, '0')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Existing Step List */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">
              Steps ({steps.length})
            </span>
            {steps.length === 0 ? (
              <div className="rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No steps recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const stepNum = step.index !== undefined ? step.index : idx + 1;
                  return (
                    <StepItem
                      key={stepNum}
                      step={{ ...step, index: stepNum }}
                      isSelected={activeBrowserShot?.resolvedIndex === stepNum}
                      onSelect={() => {
                        if (step.screenshot) {
                          setSelectedBrowserStepIndex(stepNum);
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Screenshot Lightbox Modal */}
      <ScreenshotModal
        isOpen={!!modalShot}
        onClose={() => setModalShot(null)}
        screenshotUrl={modalShot?.url || null}
        title={modalShot?.title || 'Screenshot Viewer'}
      />
    </div>
  );
}
