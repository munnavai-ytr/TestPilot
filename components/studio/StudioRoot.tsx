'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  clearAllStudioSessions,
  createStudioId,
  deleteStudioSession,
  getStudioFindingsForSession,
  getStudioSessionById,
  listStudioSessions,
  saveStudioSession,
} from '@/lib/studio/store';
import { StudioFinding, StudioSession } from '@/lib/studio/types';
import { RunnerSettings } from '@/types/runner';
import { StudioErrorBoundary } from './StudioErrorBoundary';
import { StudioSetup } from './StudioSetup';
import { StudioSessionView } from './StudioSession';
import { StudioSettingsModal } from './StudioSettingsModal';

interface StudioRootProps {
  settings: RunnerSettings;
  onOpenSettings: () => void;
  onUseCloudMode: (appUrl: string) => void;
}

function StudioInner({ settings, onOpenSettings, onUseCloudMode }: StudioRootProps) {
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [activeSession, setActiveSession] = useState<StudioSession | null>(null);
  const [activeFindings, setActiveFindings] = useState<StudioFinding[]>([]);
  const [isPastSessionOpen, setIsPastSessionOpen] = useState(false);
  const [isStudioSettingsOpen, setIsStudioSettingsOpen] = useState(false);
  const [prefillUrl, setPrefillUrl] = useState('');

  const reloadSessions = useCallback(async () => {
    try {
      const list = await listStudioSessions();
      setSessions(list);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    void reloadSessions();
  }, [reloadSessions]);

  const handleLaunchSession = async (config: {
    appUrl: string;
    appOrigin: string;
    deviceId: string;
    width: number;
    height: number;
  }) => {
    const existingList = await listStudioSessions();
    const previousForOrigin = existingList.find(
      (s) => s.appOrigin === config.appOrigin && !!s.scoreBreakdown
    );

    const newSession: StudioSession = {
      id: createStudioId('sess'),
      appUrl: config.appUrl,
      appOrigin: config.appOrigin,
      deviceId: config.deviceId,
      deviceWidth: config.width,
      deviceHeight: config.height,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'planning',
      geminiRequestsUsed: 0,
      messages: [],
      steps: [],
      audits: {},
      personaResults: [],
      personaAggregate: null,
      scoreBreakdown: null,
      executiveSummary: null,
      previousSessionId: previousForOrigin?.id || null,
      notTestedSelections: [],
    };

    await saveStudioSession(newSession);
    setActiveFindings([]);
    setIsPastSessionOpen(false);
    setActiveSession(newSession);
    void reloadSessions();
  };

  const handleOpenPastSession = async (sessionId: string) => {
    const loaded = await getStudioSessionById(sessionId);
    if (!loaded) return;
    const loadedFindings = await getStudioFindingsForSession(sessionId);
    setActiveFindings(loadedFindings);
    setIsPastSessionOpen(true);
    setActiveSession(loaded);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteStudioSession(sessionId);
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
    }
    void reloadSessions();
  };

  const handleClearAllSessions = async () => {
    await clearAllStudioSessions();
    setSessions([]);
  };

  const handleRetestApp = async (previous: StudioSession) => {
    setPrefillUrl(previous.appUrl);
    await handleLaunchSession({
      appUrl: previous.appUrl,
      appOrigin: previous.appOrigin,
      deviceId: previous.deviceId,
      width: previous.deviceWidth,
      height: previous.deviceHeight,
    });
  };

  return (
    <>
      {activeSession ? (
        <StudioSessionView
          key={activeSession.id}
          initialSession={activeSession}
          initialFindings={activeFindings}
          settings={settings}
          isPastReadOnly={isPastSessionOpen}
          onBackToSetup={() => {
            setActiveSession(null);
            setIsPastSessionOpen(false);
            void reloadSessions();
          }}
          onOpenSettings={onOpenSettings}
          onOpenStudioSettings={() => setIsStudioSettingsOpen(true)}
          onUseCloudMode={(url) => onUseCloudMode(url)}
          onRetestApp={(sess) => void handleRetestApp(sess)}
          onSessionUpdated={() => void reloadSessions()}
        />
      ) : (
        <StudioSetup
          settings={settings}
          onOpenSettings={onOpenSettings}
          onOpenStudioSettings={() => setIsStudioSettingsOpen(true)}
          onLaunchSession={(cfg) => void handleLaunchSession(cfg)}
          sessions={sessions}
          isLoadingSessions={isLoadingSessions}
          onOpenPastSession={(id) => void handleOpenPastSession(id)}
          onDeleteSession={(id) => void handleDeleteSession(id)}
          onClearAllSessions={() => void handleClearAllSessions()}
          initialUrl={prefillUrl}
        />
      )}

      <StudioSettingsModal
        isOpen={isStudioSettingsOpen}
        onClose={() => setIsStudioSettingsOpen(false)}
      />
    </>
  );
}

export function StudioRoot(props: StudioRootProps) {
  return (
    <StudioErrorBoundary onResetToCloud={() => props.onUseCloudMode('')}>
      <StudioInner {...props} />
    </StudioErrorBoundary>
  );
}
