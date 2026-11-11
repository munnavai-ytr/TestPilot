'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ApiError,
  RunDetails,
  RunnerSettings,
  RunStatus,
  StoredRun,
  TestMode,
} from '@/types/runner';
import {
  clearStoredHistory,
  deleteRunFromHistory,
  getStoredHistory,
  getStoredSettings,
  getStoredTheme,
  saveRunToHistory,
  saveStoredSettings,
  saveStoredTheme,
  updateRunStatusInHistory,
} from '@/lib/storage';
import { createRun, fetchRunDetails, stopRun } from '@/lib/runner-api';
import { NavScreen, Sidebar } from '@/components/Sidebar';
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { NewTestScreen } from '@/components/screens/NewTestScreen';
import { LiveRunScreen } from '@/components/screens/LiveRunScreen';
import { ReportScreen } from '@/components/screens/ReportScreen';
import { HistoryScreen } from '@/components/screens/HistoryScreen';

function applyThemeToDocument(t: 'light' | 'dark' | 'system') {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (t === 'dark') {
    root.classList.add('dark');
  } else if (t === 'light') {
    root.classList.remove('dark');
  } else {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isSystemDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

export default function HomePage() {
  // Client hydration check using React's idiomatic useSyncExternalStore
  const isHydrated = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Settings & Theme
  const [settings, setSettings] = useState<RunnerSettings>(() => getStoredSettings());
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => getStoredTheme());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // History & Navigation
  const [history, setHistory] = useState<StoredRun[]>(() => getStoredHistory());
  const [currentScreen, setCurrentScreen] = useState<NavScreen>('new_test');
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const [unavailableRunIds, setUnavailableRunIds] = useState<Set<string>>(new Set());

  // Active Test Run State (for live streaming)
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunUrl, setActiveRunUrl] = useState<string>('');
  const [activeRunCommand, setActiveRunCommand] = useState<string>('');
  const [activeRunMode, setActiveRunMode] = useState<TestMode>('smoke');
  const [activeRunCredentials, setActiveRunCredentials] = useState<{
    email?: string;
    password?: string;
  } | null>(null);

  const [runDetails, setRunDetails] = useState<RunDetails | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>('running');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [startError, setStartError] = useState<ApiError | null>(null);
  const [pollError, setPollError] = useState<ApiError | null>(null);

  // Screen prefill for "Run again"
  const [prefillValues, setPrefillValues] = useState<{
    url?: string;
    command?: string;
    mode?: TestMode;
    credentials?: { email?: string; password?: string } | null;
  } | undefined>(undefined);

  // Report View State
  const [selectedReportRun, setSelectedReportRun] = useState<StoredRun | null>(null);
  const [reportDetails, setReportDetails] = useState<RunDetails | null>(null);
  const [isLoadingReportDetails, setIsLoadingReportDetails] = useState(false);
  const [reportFetchError, setReportFetchError] = useState<ApiError | null>(null);

  // Polling interval ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize document theme
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme: 'light' | 'dark' | 'system' =
      theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
    saveStoredTheme(nextTheme);
    applyThemeToDocument(nextTheme);
  };

  const handleSaveSettings = (newSettings: RunnerSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
    if (startError && !startError.isAuthError && newSettings.runnerUrl) {
      setStartError(null);
    }
  };

  // Stop polling helper
  const clearTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Update history record on poll completion (saving strictly minimal data to localStorage)
  const recordCompletedRun = useCallback(
    (details: RunDetails, currentRunId: string, currentStatus: RunStatus) => {
      const bugs = details.bugs || [];
      const score = details.summary?.score;

      // Update in storage with ONLY minimal metadata
      const updated = updateRunStatusInHistory(currentRunId, currentStatus, score, bugs.length);
      setHistory(updated);

      const found = updated.find((r) => r.runId === currentRunId);
      if (found) {
        setSelectedReportRun(found);
      }
    },
    []
  );

  // Status polling (2s ticks, following Runner API contract)
  const startPolling = useCallback(
    (runId: string) => {
      clearTimers();

      // Elapsed Timer (1s ticks)
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      const executePoll = async () => {
        try {
          const details = await fetchRunDetails(settings, runId);
          setRunDetails(details);
          setPollError(null);

          const status = details.status || 'running';
          setRunStatus(status);

          if (status === 'completed' || status === 'failed' || status === 'stopped') {
            clearTimers();
            recordCompletedRun(details, runId, status);
          }
        } catch (err: unknown) {
          const apiErr = err as ApiError;
          setPollError(apiErr);
          if (apiErr.status === 404 || apiErr.isNotFound) {
            clearTimers();
            setUnavailableRunIds((prev) => new Set([...prev, runId]));
          }
        }
      };

      // Initial immediate fetch
      executePoll();

      // Regular 2-second interval
      pollIntervalRef.current = setInterval(executePoll, 2000);
    },
    [settings, clearTimers, recordCompletedRun]
  );

  // Refresh status of all non-finished runs when History loads
  const handleRefreshRunningRuns = useCallback(async () => {
    if (!settings.runnerUrl.trim()) return;
    setIsRefreshingHistory(true);

    const currentHistory = getStoredHistory();
    const runningRuns = currentHistory.filter((r) => r.lastKnownStatus === 'running');

    for (const r of runningRuns) {
      try {
        const details = await fetchRunDetails(settings, r.runId);
        const status = details.status || 'running';
        const score = details.summary?.score;
        const bugCount = details.bugs?.length || 0;
        updateRunStatusInHistory(r.runId, status, score, bugCount);
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        if (apiErr.status === 404 || apiErr.isNotFound) {
          setUnavailableRunIds((prev) => new Set([...prev, r.runId]));
        }
      }
    }

    setHistory(getStoredHistory());
    setIsRefreshingHistory(false);
  }, [settings]);

  // Fetch full report data from Runner (with skeleton loaders)
  const loadReportDetails = useCallback(
    async (run: StoredRun) => {
      setSelectedReportRun(run);
      setIsLoadingReportDetails(true);
      setReportFetchError(null);
      setReportDetails(null);

      try {
        const full = await fetchRunDetails(settings, run.runId);
        setReportDetails(full);
        // Sync any updated score or bug count into localStorage
        const status = full.status || run.lastKnownStatus;
        const score = full.summary?.score ?? run.score;
        const bugCount = full.bugs?.length ?? run.bugCount;
        const updated = updateRunStatusInHistory(run.runId, status, score, bugCount);
        setHistory(updated);
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        setReportFetchError(apiErr);
        if (apiErr.status === 404 || apiErr.isNotFound) {
          setUnavailableRunIds((prev) => new Set([...prev, run.runId]));
        }
      } finally {
        setIsLoadingReportDetails(false);
      }
    },
    [settings]
  );

  // Launch a new test
  const handleStartTest = async (payload: {
    url: string;
    command: string;
    mode: TestMode;
    credentials?: { email?: string; password?: string } | null;
  }) => {
    setIsStarting(true);
    setStartError(null);
    setPollError(null);

    try {
      const response = await createRun(settings, {
        url: payload.url,
        command: payload.command,
        mode: payload.mode,
        credentials: payload.credentials
          ? {
              email: payload.credentials.email || '',
              password: payload.credentials.password || '',
            }
          : null,
      });
      const newRunId = response.runId;

      setActiveRunId(newRunId);
      setActiveRunUrl(payload.url);
      setActiveRunCommand(payload.command);
      setActiveRunMode(payload.mode);
      setActiveRunCredentials(payload.credentials || null);

      setRunStatus('running');
      setRunDetails({ status: 'running', steps: [], bugs: [] });
      setElapsedSeconds(0);
      setCurrentScreen('live_run');

      // Prompt Requirement: Save immediately to History with ONLY minimal fields:
      // runId, url, command, mode, createdAt, lastKnownStatus, score, bugCount. Never store screenshots or full steps.
      const initialStored: StoredRun = {
        runId: newRunId,
        url: payload.url,
        command: payload.command,
        mode: payload.mode,
        createdAt: new Date().toISOString(),
        lastKnownStatus: 'running',
        bugCount: 0,
      };
      saveRunToHistory(initialStored);
      setHistory(getStoredHistory());

      // Begin polling
      startPolling(newRunId);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setStartError(apiErr);
    } finally {
      setIsStarting(false);
    }
  };

  // Stop the current running test
  const handleStopRun = async () => {
    if (!activeRunId || isStopping) return;
    setIsStopping(true);

    try {
      await stopRun(settings, activeRunId);
      clearTimers();
      setRunStatus('stopped');

      // Refresh final details
      try {
        const finalDetails = await fetchRunDetails(settings, activeRunId);
        setRunDetails(finalDetails);
        recordCompletedRun(finalDetails, activeRunId, 'stopped');
      } catch {
        if (runDetails) {
          recordCompletedRun({ ...runDetails, status: 'stopped' }, activeRunId, 'stopped');
        }
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setPollError(apiErr);
    } finally {
      setIsStopping(false);
    }
  };

  // Open run from History:
  // If running -> resume Live Run and resume polling
  // If finished -> open Report and fetch full data with skeleton loader
  const handleOpenRunFromHistory = (run: StoredRun) => {
    if (run.lastKnownStatus === 'running') {
      setActiveRunId(run.runId);
      setActiveRunUrl(run.url);
      setActiveRunCommand(run.command);
      setActiveRunMode(run.mode);
      setActiveRunCredentials(run.credentials || null);
      setRunStatus('running');
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(run.createdAt).getTime()) / 1000)));
      setCurrentScreen('live_run');
      startPolling(run.runId);
    } else {
      setCurrentScreen('report');
      loadReportDetails(run);
    }
  };

  // Run Again from Report
  const handleRunAgain = (run: StoredRun) => {
    setPrefillValues({
      url: run.url,
      command: run.command,
      mode: run.mode,
      credentials: run.credentials,
    });
    setCurrentScreen('new_test');
  };

  // Delete run from history
  const handleDeleteRun = (runId: string) => {
    const updated = deleteRunFromHistory(runId);
    setHistory(updated);
    setUnavailableRunIds((prev) => {
      const next = new Set(prev);
      next.delete(runId);
      return next;
    });
    if (selectedReportRun?.runId === runId) {
      setSelectedReportRun(null);
      setCurrentScreen('history');
    }
  };

  // Clear all history
  const handleClearHistory = () => {
    clearStoredHistory();
    setHistory([]);
    setUnavailableRunIds(new Set());
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400 text-xs">
        Initializing TestPilot...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Navigation Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasActiveRun={!!activeRunId}
        activeRunUrl={activeRunUrl}
        settings={settings}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Viewport (max-width 1200px) */}
      <main className="flex-1 min-w-0 max-w-[1200px] pb-16 md:pb-0">
        {currentScreen === 'new_test' && (
          <NewTestScreen
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSubmit={handleStartTest}
            isLoading={isStarting}
            error={startError}
            onClearError={() => setStartError(null)}
            initialValues={prefillValues}
          />
        )}

        {currentScreen === 'live_run' && (
          <LiveRunScreen
            runId={activeRunId || ''}
            url={activeRunUrl}
            command={activeRunCommand}
            details={runDetails}
            status={runStatus}
            elapsedSeconds={elapsedSeconds}
            onStop={handleStopRun}
            onViewReport={() => {
              if (activeRunId) {
                const currentStored: StoredRun = {
                  runId: activeRunId,
                  url: activeRunUrl,
                  command: activeRunCommand,
                  mode: activeRunMode,
                  createdAt: new Date().toISOString(),
                  lastKnownStatus: runStatus,
                  score: runDetails?.summary?.score,
                  bugCount: runDetails?.bugs?.length || 0,
                  details: runDetails || {},
                };
                setSelectedReportRun(currentStored);
                setReportDetails(runDetails);
                setCurrentScreen('report');
              }
            }}
            onBackToNew={() => setCurrentScreen('new_test')}
            isStopping={isStopping}
            error={pollError}
            onRetryPoll={() => {
              if (activeRunId) startPolling(activeRunId);
            }}
          />
        )}

        {currentScreen === 'report' && (
          selectedReportRun ? (
            <ReportScreen
              run={selectedReportRun}
              details={reportDetails}
              isLoadingDetails={isLoadingReportDetails}
              fetchError={reportFetchError}
              onRetryFetch={() => loadReportDetails(selectedReportRun)}
              onDeleteRun={handleDeleteRun}
              onRunAgain={handleRunAgain}
              onBack={() => setCurrentScreen('history')}
            />
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500">
              <p>No report currently active.</p>
              <button
                onClick={() => setCurrentScreen('new_test')}
                className="mt-2 text-[#3B5BDB] underline"
              >
                Return to New Test
              </button>
            </div>
          )
        )}

        {currentScreen === 'history' && (
          <HistoryScreen
            runs={history}
            onOpenRun={handleOpenRunFromHistory}
            onNewTest={() => setCurrentScreen('new_test')}
            onDeleteRun={handleDeleteRun}
            onClearHistory={handleClearHistory}
            onRefreshRunningRuns={handleRefreshRunningRuns}
            isRefreshing={isRefreshingHistory}
            unavailableRunIds={unavailableRunIds}
          />
        )}
      </main>

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
