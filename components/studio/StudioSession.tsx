'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Square,
  Pause,
  Play,
  SkipForward,
  Sliders,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  MessageSquare,
  ListChecks,
  Gauge,
  Users,
  FileText,
} from 'lucide-react';
import {
  createFindingFingerprint,
  runA11yAudit,
  runDevicesAudit,
  runLinksAudit,
  runPerfAudit,
  runSeoAudit,
} from '@/lib/studio/audits';
import { runAgentGoal } from '@/lib/studio/agent';
import { StudioBridge } from '@/lib/studio/bridge';
import { generateJson, StudioGeminiError, StudioGeminiHooks } from '@/lib/studio/gemini';
import {
  aggregatePersonaFeedback,
  evaluatePersonaFeedback,
  getDeviceDimensionsForPersona,
  getPersonaById,
  STUDIO_PERSONAS,
} from '@/lib/studio/personas';
import {
  CHECK_SUMMARY_SCHEMA,
  LEAD_RESPONSE_SCHEMA,
  TEST_LEAD_SYSTEM_PROMPT,
} from '@/lib/studio/prompts';
import {
  computeRegressionComparison,
  computeStudioScore,
  deduplicateFindings,
  generateExecutiveSummary,
  generateFindingFixPrompt,
  generateTop5CombinedFixPrompt,
} from '@/lib/studio/score';
import {
  createStudioId,
  getShotsForSession,
  getStudioFindingsForSession,
  getStudioSettings,
  hasSeenStagingWarningForOrigin,
  listStudioSessions,
  markStagingWarningSeenForOrigin,
  saveStudioFindings,
  saveStudioSession,
} from '@/lib/studio/store';
import {
  BridgeConnectionStatus,
  PlanCheckItem,
  StageActivityStatus,
  StudioChatMessage,
  StudioFinding,
  StudioQuestionCard,
  StudioRegressionComparison,
  StudioSession,
  StudioTestPlan,
} from '@/lib/studio/types';
import { RunnerSettings } from '@/types/runner';
import { Button } from '@/components/ui/Button';
import { StudioStage } from './StudioStage';
import { StudioChat } from './StudioChat';
import { StudioSteps } from './StudioSteps';
import { StudioAudits } from './StudioAudits';
import { StudioFeedback } from './StudioFeedback';
import { StudioReport } from './StudioReport';

type SessionTab = 'chat' | 'steps' | 'audits' | 'feedback' | 'report';

const FREE_AUDIT_CHECKS = new Set(['smoke', 'devices', 'a11y', 'perf', 'seo', 'links']);

interface StudioSessionViewProps {
  initialSession: StudioSession;
  initialFindings?: StudioFinding[];
  settings: RunnerSettings;
  isPastReadOnly?: boolean;
  onBackToSetup: () => void;
  onOpenSettings: () => void;
  onOpenStudioSettings: () => void;
  onUseCloudMode: (appUrl: string) => void;
  onRetestApp: (session: StudioSession) => void;
  onSessionUpdated: () => void;
}

export function StudioSessionView({
  initialSession,
  initialFindings = [],
  settings,
  isPastReadOnly = false,
  onBackToSetup,
  onOpenSettings,
  onOpenStudioSettings,
  onUseCloudMode,
  onRetestApp,
  onSessionUpdated,
}: StudioSessionViewProps) {
  const [session, setSession] = useState<StudioSession>(initialSession);
  const [findings, setFindings] = useState<StudioFinding[]>(initialFindings);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [regression, setRegression] = useState<StudioRegressionComparison | null>(null);

  const [activeTab, setActiveTab] = useState<SessionTab>(
    isPastReadOnly && initialSession.scoreBreakdown ? 'report' : 'chat'
  );
  const [mobileStageCollapsed, setMobileStageCollapsed] = useState<boolean>(false);

  const [stageWidth, setStageWidth] = useState(initialSession.deviceWidth);
  const [stageHeight, setStageHeight] = useState(initialSession.deviceHeight);
  const [stageDeviceId, setStageDeviceId] = useState(initialSession.deviceId);

  const [connectionStatus, setConnectionStatus] = useState<BridgeConnectionStatus>('connecting');
  const [activityStatus, setActivityStatus] = useState<StageActivityStatus>('Connecting');
  const [currentCaption, setCurrentCaption] = useState<string>('');
  const [showStagingBanner, setShowStagingBanner] = useState<boolean>(
    () => !hasSeenStagingWarningForOrigin(initialSession.appOrigin)
  );

  const [isLeadThinking, setIsLeadThinking] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [quotaWaitMessage, setQuotaWaitMessage] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<StudioQuestionCard | null>(null);
  const [questionRemainingSec, setQuestionRemainingSec] = useState(90);

  // Refs for async orchestration
  const sessionRef = useRef<StudioSession>(initialSession);
  const findingsRef = useRef<StudioFinding[]>(initialFindings);
  const bridgeRef = useRef<StudioBridge | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const pauseResolversRef = useRef<Array<() => void>>([]);
  const skipCheckFlagRef = useRef(false);
  const steeringQueueRef = useRef<string[]>([]);
  const alwaysAllowDestructiveRef = useRef(false);
  const screenshotAvailableRef = useRef(true);
  const languageHintRef = useRef('English');
  const questionResolverRef = useRef<
    ((val: { answer?: string; accountId?: string; timedOut?: boolean }) => void) | null
  >(null);

  const hasGeminiKey = !!settings.geminiApiKey?.trim();

  // Keep refs synced
  const updateSession = useCallback(
    (updater: (prev: StudioSession) => StudioSession) => {
      setSession((prev) => {
        const next = updater(prev);
        sessionRef.current = next;
        return next;
      });
    },
    []
  );

  const appendMessage = useCallback(
    (msg: Omit<StudioChatMessage, 'id' | 'ts'>) => {
      const full: StudioChatMessage = {
        ...msg,
        id: createStudioId('msg'),
        ts: new Date().toISOString(),
      };
      updateSession((prev) => ({
        ...prev,
        messages: [...prev.messages, full],
      }));
    },
    [updateSession]
  );

  const addFinding = useCallback((f: StudioFinding) => {
    setFindings((prev) => {
      const merged = deduplicateFindings([...prev, f]);
      findingsRef.current = merged;
      return merged;
    });
  }, []);

  // Load shots & previous regression if viewing or starting
  useEffect(() => {
    let active = true;
    (async () => {
      const loadedShots = await getShotsForSession(initialSession.id);
      if (active) setShots(loadedShots);

      if (initialSession.previousSessionId) {
        const all = await listStudioSessions();
        const prevSess = all.find((s) => s.id === initialSession.previousSessionId);
        if (prevSess && active) {
          const prevFindings = await getStudioFindingsForSession(prevSess.id);
          if (active) {
            setRegression(
              computeRegressionComparison(
                initialSession.scoreBreakdown?.score ?? 100,
                initialFindings,
                prevSess,
                prevFindings
              )
            );
          }
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [initialSession, initialFindings]);

  // Persist session periodically on changes
  const persistCurrentState = useCallback(
    async (overrideSession?: StudioSession, overrideFindings?: StudioFinding[]) => {
      const s = overrideSession || sessionRef.current;
      const f = overrideFindings || findingsRef.current;
      await saveStudioSession(s);
      await saveStudioFindings(s.id, f);
      onSessionUpdated();
    },
    [onSessionUpdated]
  );

  // Initialize Bridge for the session
  useEffect(() => {
    const bridge = new StudioBridge(initialSession.appUrl, {
      onStatusChange: (st) => {
        setConnectionStatus(st);
        if (st === 'connected') setActivityStatus('Connected');
        else if (st === 'connecting' || st === 'reconnecting') setActivityStatus('Connecting');
        else if (st === 'disconnected' || st === 'failed') setActivityStatus('Disconnected');
      },
      onConnectionLost: () => {
        pausedRef.current = true;
        setIsPaused(true);
        setActivityStatus('Paused');
        appendMessage({
          role: 'system',
          text: 'Connection to the app was lost (ping failed twice). Paused — click Reconnect above the stage.',
        });
      },
    });

    bridgeRef.current = bridge;
    setIframeSrc(bridge.getIframeSrc());

    return () => {
      abortControllerRef.current?.abort();
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, [initialSession.appUrl, appendMessage]);

  const handleIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    if (el && bridgeRef.current) {
      bridgeRef.current.attachIframe(el);
    }
  }, []);

  const refreshShotsMap = useCallback(async () => {
    const latest = await getShotsForSession(sessionRef.current.id);
    setShots(latest);
  }, []);

  const geminiHooks: StudioGeminiHooks = {
    onRequestUsed: () => {
      updateSession((prev) => ({
        ...prev,
        geminiRequestsUsed: prev.geminiRequestsUsed + 1,
      }));
    },
    onQuotaWait: (delayMs) => {
      const secs = Math.max(1, Math.round(delayMs / 1000));
      setQuotaWaitMessage(`Waiting for your Gemini quota... retrying in ${secs}s`);
      setTimeout(() => {
        setQuotaWaitMessage((curr) => (curr && curr.includes(`${secs}s`) ? null : curr));
      }, delayMs);
    },
  };

  const handlePause = () => {
    pausedRef.current = true;
    setIsPaused(true);
    setActivityStatus('Paused');
    appendMessage({ role: 'system', text: 'Run paused by user.' });
  };

  const handleResume = () => {
    pausedRef.current = false;
    setIsPaused(false);
    setActivityStatus('Connected');
    for (const resolve of pauseResolversRef.current) {
      resolve();
    }
    pauseResolversRef.current = [];
    appendMessage({ role: 'system', text: 'Run resumed.' });
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    pausedRef.current = false;
    setIsPaused(false);
    for (const resolve of pauseResolversRef.current) {
      resolve();
    }
    pauseResolversRef.current = [];
    if (questionResolverRef.current) {
      questionResolverRef.current({ timedOut: true });
      questionResolverRef.current = null;
      setActiveQuestion(null);
    }
    setIsRunning(false);
    setQuotaWaitMessage(null);
    setCurrentCaption('');
    setActivityStatus(connectionStatus === 'connected' ? 'Connected' : 'Disconnected');
    updateSession((prev) => ({ ...prev, status: 'stopped' }));
    appendMessage({ role: 'system', text: 'Run stopped immediately by user.' });
  };

  const handleSkipCurrentCheck = () => {
    skipCheckFlagRef.current = true;
    if (pausedRef.current) handleResume();
    appendMessage({ role: 'system', text: 'Skipping current check...' });
  };

  const askUserWithTimeout = useCallback(
    (params: {
      question: string;
      kind: 'text' | 'choice' | 'credentials' | 'destructive';
      options?: string[];
      dangerLabel?: string;
    }): Promise<{ answer?: string; accountId?: string; timedOut?: boolean }> => {
      return new Promise((resolve) => {
        const card: StudioQuestionCard = {
          id: createStudioId('q'),
          question: params.question,
          kind: params.kind,
          options: params.options,
          dangerLabel: params.dangerLabel,
        };
        setActiveQuestion(card);
        setQuestionRemainingSec(90);

        let settled = false;
        const interval = setInterval(() => {
          setQuestionRemainingSec((prev) => Math.max(0, prev - 1));
        }, 1000);

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          clearInterval(interval);
          questionResolverRef.current = null;
          setActiveQuestion(null);
          resolve({ timedOut: true });
        }, 90000);

        questionResolverRef.current = (payload) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearInterval(interval);
          questionResolverRef.current = null;
          setActiveQuestion(null);
          resolve(payload);
        };
      });
    },
    []
  );

  const handleAnswerQuestion = (payload: { answer?: string; accountId?: string }) => {
    if (questionResolverRef.current) {
      questionResolverRef.current(payload);
    }
  };

  // Send message to Lead Chat (or steer if running)
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    languageHintRef.current = text;

    appendMessage({ role: 'user', text });

    if (isRunning) {
      steeringQueueRef.current.push(text);
      appendMessage({
        role: 'system',
        text: 'Steering note queued for the agent on its next step.',
      });
      return;
    }

    if (!hasGeminiKey) {
      appendMessage({
        role: 'lead',
        text: 'Please add your Gemini API key in Settings so I can plan and run tests.',
      });
      return;
    }

    setIsLeadThinking(true);
    setActivityStatus('Thinking');

    try {
      let snapSummary: Record<string, unknown> | null = null;
      if (bridgeRef.current && connectionStatus === 'connected') {
        try {
          const snap = await bridgeRef.current.snapshot(40);
          snapSummary = {
            url: snap.url,
            title: snap.title,
            headings: snap.headings?.slice(0, 8),
            elementsCount: snap.totalInteractive,
            sampleControls: (snap.elements || []).slice(0, 20).map((e) => ({
              tag: e.tag,
              role: e.role,
              name: e.name,
              type: e.type,
            })),
          };
        } catch {
          // snapshot optional for Lead planning
        }
      }

      const currentSess = sessionRef.current;
      const runResultsContext =
        currentSess.scoreBreakdown || currentSess.steps.length > 0
          ? {
              scoreBreakdown: currentSess.scoreBreakdown || null,
              findings: findingsRef.current.slice(0, 20).map((f) => ({
                severity: f.severity,
                title: f.title,
                page: f.page,
                whatHappened: f.whatHappened,
                evidence: f.evidence,
              })),
              auditsSummary: {
                devicesChecked: currentSess.audits.devices?.length || 0,
                a11yIssues: currentSess.audits.a11y?.issues?.length || 0,
                seoIssues: currentSess.audits.seo?.issues?.length || 0,
                brokenLinks: currentSess.audits.links?.brokenCount || 0,
              },
              personaResults: currentSess.personaResults.map((p) => ({
                name: p.personaName,
                result: p.taskResult,
                rating: p.rating,
                summary: p.summary,
              })),
            }
          : null;

      const leadResponse = await generateJson<{
        reply: string;
        quickReplies: string[];
        plan?: {
          title: string;
          summary: string;
          notCovered: string[];
          checks: Array<{
            id: PlanCheckItem['id'];
            title: string;
            why: string;
            enabled: boolean;
            goal?: string;
            personaIds?: string[];
            estimatedRequests: number;
            estimatedMinutes: number;
          }>;
        } | null;
      }>(
        {
          system: TEST_LEAD_SYSTEM_PROMPT,
          schema: LEAD_RESPONSE_SCHEMA,
          temperature: 0.35,
          userParts: [
            {
              text: JSON.stringify({
                appUrl: currentSess.appUrl,
                availablePersonaIds: STUDIO_PERSONAS.map((p) => `${p.id} (${p.name})`),
                conversationHistory: currentSess.messages.slice(-14).map((m) => ({
                  role: m.role,
                  text: m.text,
                  hadPlan: !!m.plan,
                })),
                latestUserMessage: text,
                untrustedPageOverview: snapSummary,
                untrustedPastRunResultsData: runResultsContext,
              }),
            },
          ],
        },
        geminiHooks
      );

      let normalizedPlan: StudioTestPlan | undefined;
      if (leadResponse.plan && Array.isArray(leadResponse.plan.checks)) {
        normalizedPlan = {
          id: createStudioId('plan'),
          title: leadResponse.plan.title || 'Proposed QA Test Plan',
          summary: leadResponse.plan.summary || '',
          notCovered: Array.isArray(leadResponse.plan.notCovered)
            ? leadResponse.plan.notCovered
            : [],
          status: 'pending',
          checks: leadResponse.plan.checks.map((c) => ({
            id: c.id,
            title: c.title,
            why: c.why,
            enabled: c.enabled ?? true,
            goal: c.goal,
            personaIds:
              c.id === 'personas'
                ? c.personaIds && c.personaIds.length > 0
                  ? c.personaIds
                  : ['new_user', 'impatient_user', 'careless_user', 'phone_thumb_user']
                : c.personaIds,
            estimatedRequests: FREE_AUDIT_CHECKS.has(c.id) ? 0 : c.estimatedRequests || 12,
            estimatedMinutes: c.estimatedMinutes || 1,
          })),
        };
      }

      appendMessage({
        role: 'lead',
        text: leadResponse.reply,
        quickReplies: Array.isArray(leadResponse.quickReplies)
          ? leadResponse.quickReplies.slice(0, 4)
          : [],
        plan: normalizedPlan,
      });

      await persistCurrentState();
    } catch (err) {
      const gErr = err as StudioGeminiError;
      if (gErr?.isAuthError) {
        appendMessage({
          role: 'system',
          text: 'Your Gemini API key was rejected. Check it in Settings.',
        });
      } else {
        appendMessage({
          role: 'system',
          text: gErr?.message || 'Could not reach Gemini. Please try again.',
        });
      }
    } finally {
      setIsLeadThinking(false);
      setQuotaWaitMessage(null);
      setActivityStatus(connectionStatus === 'connected' ? 'Connected' : 'Disconnected');
    }
  };

  const handleRequestPlanChange = (plan: StudioTestPlan) => {
    void handleSendMessage(`Please adjust the plan "${plan.title}": `);
  };

  // Execute Approved Test Plan
  const handleApprovePlan = async (approvedPlan: StudioTestPlan) => {
    const bridge = bridgeRef.current;
    if (!bridge || isRunning) return;

    if (showStagingBanner) {
      markStagingWarningSeenForOrigin(sessionRef.current.appOrigin);
      setShowStagingBanner(false);
    }

    // Mark plan approved -> running
    updateSession((prev) => ({
      ...prev,
      status: 'running',
      messages: prev.messages.map((m) =>
        m.plan?.id === approvedPlan.id ? { ...m, plan: { ...approvedPlan, status: 'running' } } : m
      ),
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;
    pausedRef.current = false;
    setIsPaused(false);
    setIsRunning(true);
    skipCheckFlagRef.current = false;

    const studioSettings = getStudioSettings();
    const enabledChecks = approvedPlan.checks.filter((c) => c.enabled);
    const disabledCheckTitles = approvedPlan.checks
      .filter((c) => !c.enabled)
      .map((c) => `Skipped check: ${c.title}`);

    updateSession((prev) => ({
      ...prev,
      notTestedSelections: Array.from(new Set([...prev.notTestedSelections, ...disabledCheckTitles])),
    }));

    const waitWhilePaused = () =>
      new Promise<void>((resolve) => {
        if (!pausedRef.current) {
          resolve();
          return;
        }
        pauseResolversRef.current.push(resolve);
      });

    const summarizeCheckInChat = async (title: string, summaryData: unknown) => {
      if (!hasGeminiKey || controller.signal.aborted) return;
      try {
        const res = await generateJson<{ summary: string }>(
          {
            system:
              'You are TestPilot Lead briefly summarizing an automated audit result in 1 to 2 plain, helpful sentences in the user language. State only factual numbers/issues from the data.',
            schema: CHECK_SUMMARY_SCHEMA,
            temperature: 0.25,
            signal: controller.signal,
            userParts: [
              {
                text: JSON.stringify({
                  check: title,
                  preferredLanguage: languageHintRef.current || 'English',
                  data: summaryData,
                }),
              },
            ],
          },
          geminiHooks
        );
        if (res.summary) {
          appendMessage({ role: 'lead', text: res.summary });
        }
      } catch {
        // optional summary; ignore failure
      }
    };

    try {
      for (const check of enabledChecks) {
        if (controller.signal.aborted) break;
        if (pausedRef.current) {
          setActivityStatus('Paused');
          await waitWhilePaused();
          if (controller.signal.aborted) break;
        }

        skipCheckFlagRef.current = false;
        appendMessage({ role: 'system', text: `Starting check: ${check.title}` });

        if (check.id === 'smoke') {
          setActivityStatus('Acting');
          setCurrentCaption('Running baseline smoke check');
          try {
            const snap = await bridge.snapshot(60);
            const ev = await bridge.evidence(true);
            const errList = [
              ...(ev.pageErrors || []),
              ...(ev.consoleErrors || []),
              ...(ev.failedRequests || []),
            ];
            for (const errTxt of errList.slice(0, 5)) {
              addFinding({
                id: createStudioId('find'),
                sessionId: sessionRef.current.id,
                fingerprint: createFindingFingerprint(`Runtime error: ${errTxt.slice(0, 60)}`, snap.url),
                severity: 'high',
                title: `Runtime / Network error on load`,
                page: snap.url,
                source: 'agent',
                whatHappened: errTxt,
                whyItHappened: 'Detected by the TestPilot SDK evidence monitor on the active page.',
                expectedVsActual: `Expected: 0 console/page/network errors.\nActual: ${errTxt}`,
                stepsToReproduce: [`Open ${snap.url}`, 'Monitor browser console & network'],
                evidence: errTxt,
                createdAt: new Date().toISOString(),
              });
            }
            appendMessage({
              role: 'lead',
              text: `Smoke check finished on ${snap.url}: found ${snap.totalInteractive} interactive elements and ${errList.length} console/network error(s).`,
            });
          } catch (err) {
            appendMessage({
              role: 'system',
              text: `Smoke check failed: ${err instanceof Error ? err.message : 'bridge error'}`,
            });
          }
        } else if (check.id === 'explore' || check.id === 'forms') {
          const goalText =
            check.goal ||
            (check.id === 'forms'
              ? 'Locate forms and test validation rules, required fields, error messages, and clean submission.'
              : check.title);

          const res = await runAgentGoal({
            sessionId: sessionRef.current.id,
            goalId: check.id,
            goal: goalText,
            maxSteps: studioSettings.maxStepsPerGoal,
            languageHint: languageHintRef.current,
            bridge,
            signal: controller.signal,
            isPaused: () => pausedRef.current,
            waitWhilePaused,
            isSkipped: () => skipCheckFlagRef.current,
            consumeSteeringMessages: () => {
              const copy = [...steeringQueueRef.current];
              steeringQueueRef.current = [];
              return copy;
            },
            askUser: askUserWithTimeout,
            getSessionAlwaysAllowDestructive: () => alwaysAllowDestructiveRef.current,
            setSessionAlwaysAllowDestructive: () => {
              alwaysAllowDestructiveRef.current = true;
            },
            isScreenshotAvailable: () => screenshotAvailableRef.current,
            markScreenshotUnavailable: () => {
              screenshotAvailableRef.current = false;
              if (!sessionRef.current.screenshotUnavailableNotified) {
                updateSession((prev) => ({ ...prev, screenshotUnavailableNotified: true }));
                appendMessage({
                  role: 'system',
                  text: 'Screenshots are unavailable in this app (cross-origin/canvas limit). Continuing without screenshots.',
                });
              }
            },
            pauseSession: (reason) => {
              pausedRef.current = true;
              setIsPaused(true);
              setActivityStatus('Paused');
              appendMessage({ role: 'system', text: reason });
            },
            onActivityChange: (st, caption) => {
              setActivityStatus(st);
              setCurrentCaption(caption || '');
            },
            onStep: (step) => {
              updateSession((prev) => ({
                ...prev,
                steps: [...prev.steps, step],
              }));
              if (step.shotId) void refreshShotsMap();
            },
            onFinding: addFinding,
            onAgentSay: (say) => {
              appendMessage({ role: 'lead', text: say });
            },
            onSystemNotice: (txt) => {
              appendMessage({ role: 'system', text: txt });
            },
            geminiHooks,
          });

          setCurrentCaption('');
          appendMessage({
            role: 'system',
            text: `Finished "${check.title}" (${res.status}): ${res.reason}`,
          });
        } else if (check.id === 'devices') {
          setActivityStatus('Acting');
          setCurrentCaption('Auditing responsive devices');
          const { entries, findings: devFindings } = await runDevicesAudit(
            sessionRef.current.id,
            bridge,
            studioSettings.selectedDevices,
            stageWidth,
            stageHeight,
            {
              signal: controller.signal,
              onResizeStage: (w, h) => {
                setStageDeviceId('custom');
                setStageWidth(w);
                setStageHeight(h);
              },
              onStatusText: (txt) => setCurrentCaption(txt),
              screenshotAvailable: screenshotAvailableRef.current,
              onScreenshotUnavailable: () => {
                screenshotAvailableRef.current = false;
              },
            }
          );
          setStageDeviceId(initialSession.deviceId);
          setStageWidth(initialSession.deviceWidth);
          setStageHeight(initialSession.deviceHeight);
          setCurrentCaption('');

          updateSession((prev) => ({
            ...prev,
            audits: { ...prev.audits, devices: entries },
          }));
          devFindings.forEach(addFinding);
          await refreshShotsMap();

          await summarizeCheckInChat('Devices layout audit', {
            devicesTested: entries.length,
            devicesWithIssues: entries.filter((e) => e.result.issues.length > 0).length,
            totalIssues: devFindings.length,
          });
        } else if (check.id === 'a11y') {
          setActivityStatus('Acting');
          setCurrentCaption('Running accessibility audit');
          const { result, findings: a11yFindings } = await runA11yAudit(
            sessionRef.current.id,
            bridge
          );
          updateSession((prev) => ({
            ...prev,
            audits: { ...prev.audits, a11y: result },
          }));
          a11yFindings.forEach(addFinding);
          await summarizeCheckInChat('Accessibility audit', result);
        } else if (check.id === 'perf') {
          setActivityStatus('Acting');
          setCurrentCaption('Measuring performance metrics');
          const { result, findings: perfFindings } = await runPerfAudit(
            sessionRef.current.id,
            bridge
          );
          updateSession((prev) => ({
            ...prev,
            audits: { ...prev.audits, perf: result },
          }));
          perfFindings.forEach(addFinding);
          await summarizeCheckInChat('Performance audit', result);
        } else if (check.id === 'seo') {
          setActivityStatus('Acting');
          setCurrentCaption('Checking SEO metadata');
          const { result, findings: seoFindings } = await runSeoAudit(
            sessionRef.current.id,
            bridge
          );
          updateSession((prev) => ({
            ...prev,
            audits: { ...prev.audits, seo: result },
          }));
          seoFindings.forEach(addFinding);
          await summarizeCheckInChat('SEO audit', result);
        } else if (check.id === 'links') {
          setActivityStatus('Acting');
          setCurrentCaption('Checking same-origin links');
          const { result, findings: linkFindings } = await runLinksAudit(
            sessionRef.current.id,
            bridge,
            studioSettings.maxLinks,
            controller.signal,
            (txt) => setCurrentCaption(txt)
          );
          setCurrentCaption('');
          updateSession((prev) => ({
            ...prev,
            audits: { ...prev.audits, links: result },
          }));
          linkFindings.forEach(addFinding);
          await summarizeCheckInChat('Links check', {
            checkedCount: result.checkedCount,
            brokenCount: result.brokenCount,
          });
        } else if (check.id === 'personas') {
          const personaIds =
            check.personaIds && check.personaIds.length > 0
              ? check.personaIds
              : ['new_user', 'impatient_user', 'careless_user', 'phone_thumb_user'];

          const collectedResults = [...sessionRef.current.personaResults];

          for (const pid of personaIds) {
            if (controller.signal.aborted || skipCheckFlagRef.current) break;
            const persona = getPersonaById(pid);
            if (!persona) continue;

            const dims = getDeviceDimensionsForPersona(persona);
            setStageDeviceId(persona.preferredDeviceId);
            setStageWidth(dims.width);
            setStageHeight(dims.height);

            appendMessage({
              role: 'system',
              text: `Virtual user "${persona.name}" starting on ${dims.label}...`,
            });

            if (studioSettings.freshStartPerPersona) {
              try {
                await bridge.resetAndReload();
              } catch {
                // ignore reset error on first run
              }
            }

            const goalForPersona = check.goal?.trim() || persona.defaultGoal;
            const pRes = await runAgentGoal({
              sessionId: sessionRef.current.id,
              goalId: `persona_${persona.id}`,
              goal: goalForPersona,
              maxSteps: studioSettings.personaSteps,
              languageHint: languageHintRef.current,
              personaId: persona.id,
              personaName: persona.name,
              personaRules: persona.rules,
              bridge,
              signal: controller.signal,
              isPaused: () => pausedRef.current,
              waitWhilePaused,
              isSkipped: () => skipCheckFlagRef.current,
              consumeSteeringMessages: () => {
                const copy = [...steeringQueueRef.current];
                steeringQueueRef.current = [];
                return copy;
              },
              askUser: askUserWithTimeout,
              getSessionAlwaysAllowDestructive: () => alwaysAllowDestructiveRef.current,
              setSessionAlwaysAllowDestructive: () => {
                alwaysAllowDestructiveRef.current = true;
              },
              isScreenshotAvailable: () => screenshotAvailableRef.current,
              markScreenshotUnavailable: () => {
                screenshotAvailableRef.current = false;
              },
              pauseSession: (reason) => {
                pausedRef.current = true;
                setIsPaused(true);
                setActivityStatus('Paused');
                appendMessage({ role: 'system', text: reason });
              },
              onActivityChange: (st, caption) => {
                setActivityStatus(st);
                setCurrentCaption(`${persona.name}: ${caption || ''}`);
              },
              onStep: (step) => {
                updateSession((prev) => ({
                  ...prev,
                  steps: [...prev.steps, step],
                }));
                if (step.shotId) void refreshShotsMap();
              },
              onFinding: addFinding,
              onAgentSay: (say) => {
                appendMessage({ role: 'lead', text: `[${persona.name}] ${say}` });
              },
              onSystemNotice: (txt) => {
                appendMessage({ role: 'system', text: txt });
              },
              geminiHooks,
            });

            setCurrentCaption('');

            if (!controller.signal.aborted && pRes.steps.length > 0) {
              const fb = await evaluatePersonaFeedback(
                {
                  persona,
                  deviceLabel: dims.label,
                  goal: goalForPersona,
                  steps: pRes.steps,
                  stopReason: pRes.reason,
                  languageHint: languageHintRef.current,
                  signal: controller.signal,
                },
                geminiHooks
              );
              collectedResults.push(fb);
              updateSession((prev) => ({
                ...prev,
                personaResults: [...collectedResults],
              }));
            }
          }

          // Restore stage dimensions
          setStageDeviceId(initialSession.deviceId);
          setStageWidth(initialSession.deviceWidth);
          setStageHeight(initialSession.deviceHeight);

          if (!controller.signal.aborted && collectedResults.length > 0) {
            const agg = await aggregatePersonaFeedback(
              {
                results: collectedResults,
                languageHint: languageHintRef.current,
                signal: controller.signal,
              },
              geminiHooks
            );
            updateSession((prev) => ({ ...prev, personaAggregate: agg }));
            appendMessage({
              role: 'lead',
              text: `Virtual user feedback collected across ${collectedResults.length} persona(s). Average rating: ${agg.averageRating.toFixed(1)}/5.`,
            });
          }
        }
      }

      // Compute final deterministic score, regression comparison, and executive summary
      const finalFindings = deduplicateFindings(findingsRef.current);
      findingsRef.current = finalFindings;
      setFindings(finalFindings);

      const breakdown = computeStudioScore(sessionRef.current, finalFindings);

      let prevRegression: StudioRegressionComparison | null = null;
      const allPast = await listStudioSessions();
      const previousForOrigin = allPast.find(
        (s) =>
          s.id !== sessionRef.current.id &&
          s.appOrigin === sessionRef.current.appOrigin &&
          !!s.scoreBreakdown
      );
      if (previousForOrigin) {
        const prevFindings = await getStudioFindingsForSession(previousForOrigin.id);
        prevRegression = computeRegressionComparison(
          breakdown.score,
          finalFindings,
          previousForOrigin,
          prevFindings
        );
        setRegression(prevRegression);
      }

      let execSummary = sessionRef.current.executiveSummary || null;
      if (hasGeminiKey && !controller.signal.aborted) {
        try {
          execSummary = await generateExecutiveSummary(
            {
              session: sessionRef.current,
              findings: finalFindings,
              breakdown,
              languageHint: languageHintRef.current,
              signal: controller.signal,
            },
            geminiHooks
          );
        } catch {
          // fallback below
        }
      }

      const finalStatus = controller.signal.aborted ? 'stopped' : 'completed';
      const updatedSession: StudioSession = {
        ...sessionRef.current,
        status: finalStatus,
        scoreBreakdown: breakdown,
        executiveSummary: execSummary,
        previousSessionId: previousForOrigin?.id || null,
        messages: sessionRef.current.messages.map((m) =>
          m.plan?.id === approvedPlan.id
            ? { ...m, plan: { ...approvedPlan, status: 'completed' } }
            : m
        ),
      };

      sessionRef.current = updatedSession;
      setSession(updatedSession);
      await persistCurrentState(updatedSession, finalFindings);

      appendMessage({
        role: 'lead',
        text: `Test run ${finalStatus}. Readiness Score: ${breakdown.score}/100 (${breakdown.verdict}). ${
          execSummary?.goNoGoReasoning || ''
        } Open the Report tab to inspect findings, copy fix prompts, or click Re-test.`,
        quickReplies: [
          'Explain the most urgent fix',
          'Write a fix prompt for the top issue',
        ],
      });
    } catch (err) {
      const gErr = err as StudioGeminiError;
      if (gErr?.isAuthError) {
        appendMessage({
          role: 'system',
          text: 'Your Gemini API key was rejected. Check it in Settings.',
        });
      } else if (!gErr?.isAborted) {
        appendMessage({
          role: 'system',
          text: gErr?.message || 'Test run interrupted.',
        });
      }
    } finally {
      setIsRunning(false);
      setCurrentCaption('');
      setQuotaWaitMessage(null);
      setActivityStatus(connectionStatus === 'connected' ? 'Connected' : 'Disconnected');
      await persistCurrentState();
    }
  };

  const handleGenerateFixPrompt = async (finding: StudioFinding): Promise<string> => {
    const prompt = await generateFindingFixPrompt(
      {
        finding,
        appUrl: session.appUrl,
        languageHint: languageHintRef.current,
      },
      geminiHooks
    );

    const updatedFindings = findingsRef.current.map((f) =>
      f.id === finding.id ? { ...f, fixPrompt: prompt } : f
    );
    findingsRef.current = updatedFindings;
    setFindings(updatedFindings);
    await persistCurrentState(sessionRef.current, updatedFindings);
    return prompt;
  };

  const handleGenerateTop5Prompt = async (): Promise<string> => {
    const prompt = await generateTop5CombinedFixPrompt(
      {
        session: sessionRef.current,
        findings: findingsRef.current,
        languageHint: languageHintRef.current,
      },
      geminiHooks
    );

    updateSession((prev) => ({ ...prev, top5CombinedFixPrompt: prompt }));
    await persistCurrentState();
    return prompt;
  };

  const tabs: Array<{ id: SessionTab; label: string; count?: number; icon: React.ReactNode }> = [
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />,
    },
    {
      id: 'steps',
      label: 'Steps',
      count: session.steps.length,
      icon: <ListChecks className="w-3.5 h-3.5" strokeWidth={1.5} />,
    },
    {
      id: 'audits',
      label: 'Audits',
      icon: <Gauge className="w-3.5 h-3.5" strokeWidth={1.5} />,
    },
    {
      id: 'feedback',
      label: 'Feedback',
      count: session.personaResults.length,
      icon: <Users className="w-3.5 h-3.5" strokeWidth={1.5} />,
    },
    {
      id: 'report',
      label: 'Report',
      count: findings.length,
      icon: <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-6.75rem)] md:h-dvh w-full min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Top Session Header */}
      <header className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBackToSetup}
            aria-label="Back to Studio Setup"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>

          <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[180px] sm:max-w-[280px]">
            {session.appUrl}
          </span>

          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 tabular-nums">
            Gemini requests used: {session.geminiRequestsUsed}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="sm:hidden font-mono text-[10.5px] text-zinc-500 mr-1 tabular-nums">
            Reqs: {session.geminiRequestsUsed}
          </span>

          {isRunning && (
            <>
              {isPaused ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleResume}
                  icon={<Play className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handlePause}
                  icon={<Pause className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  Pause
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSkipCurrentCheck}
                icon={<SkipForward className="w-3.5 h-3.5" strokeWidth={1.5} />}
              >
                Skip
              </Button>

              {/* Visible Red Stop Kill Switch */}
              <Button
                type="button"
                size="sm"
                onClick={handleStop}
                className="bg-[#DC2626] hover:bg-red-700 text-white border border-red-700"
                icon={<Square className="w-3 h-3 fill-white" strokeWidth={1.5} />}
              >
                Stop
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenStudioSettings}
            aria-label="Open Studio Settings"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Sliders className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* First-Run Staging Warning Banner */}
      {showStagingBanner && (
        <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-3.5 h-3.5 text-[#CA8A04] shrink-0" strokeWidth={1.5} />
            <span className="truncate">
              Staging reminder for {session.appOrigin}: only test preview/staging copies, never real customer data.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              markStagingWarningSeenForOrigin(session.appOrigin);
              setShowStagingBanner(false);
            }}
            className="font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Split Workspace: Mobile Top/Bottom with Collapsible Handle, Desktop Left/Right */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Stage Pane */}
        <div
          className={`flex flex-col shrink-0 lg:shrink lg:h-full lg:w-[50%] border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 transition-all ${
            mobileStageCollapsed ? 'h-0 overflow-hidden lg:overflow-visible' : 'h-[42dvh] lg:h-full'
          }`}
        >
          {iframeSrc && (
            <StudioStage
              iframeSrc={iframeSrc}
              onIframeRef={handleIframeRef}
              deviceId={stageDeviceId}
              width={stageWidth}
              height={stageHeight}
              onChangeDevice={(id, w, h) => {
                setStageDeviceId(id);
                setStageWidth(w);
                setStageHeight(h);
              }}
              connectionStatus={connectionStatus}
              activityStatus={activityStatus}
              currentCaption={currentCaption}
              onReload={() => {
                void bridgeRef.current?.reload().catch(() => {
                  bridgeRef.current?.retryConnection();
                });
              }}
              onResetAppData={async () => {
                try {
                  await bridgeRef.current?.resetAndReload();
                  appendMessage({ role: 'system', text: 'App storage cleared and reloaded.' });
                } catch {
                  bridgeRef.current?.retryConnection();
                }
              }}
              onRetryConnection={() => bridgeRef.current?.retryConnection()}
              onReconnect={() => {
                void bridgeRef.current?.reconnect().then((ok) => {
                  if (ok && isPaused) handleResume();
                });
              }}
              onUseCloudMode={() => onUseCloudMode(session.appUrl)}
            />
          )}
        </div>

        {/* Mobile Collapsible Handle */}
        <button
          type="button"
          onClick={() => setMobileStageCollapsed((v) => !v)}
          className="lg:hidden w-full py-1.5 px-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 shrink-0"
        >
          {mobileStageCollapsed ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Show App Stage</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Collapse Stage</span>
            </>
          )}
        </button>

        {/* Right / Bottom Tabs Panel */}
        <div className="flex-1 min-h-0 flex flex-col lg:w-[50%] bg-white dark:bg-zinc-900">
          {/* Tab Strip */}
          <div
            role="tablist"
            aria-label="Studio workspace tabs"
            className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-2 bg-zinc-50/70 dark:bg-zinc-950/60 overflow-x-auto shrink-0"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    selected
                      ? 'border-[#3B5BDB] text-[#3B5BDB] dark:text-blue-400'
                      : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-800 text-[10px] font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Tab Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'chat' && (
              <StudioChat
                messages={session.messages}
                isLeadThinking={isLeadThinking}
                isRunning={isRunning}
                quotaWaitMessage={quotaWaitMessage}
                activeQuestion={activeQuestion}
                questionRemainingSec={questionRemainingSec}
                hasGeminiKey={hasGeminiKey}
                onOpenSettings={onOpenSettings}
                onSendMessage={handleSendMessage}
                onApprovePlan={handleApprovePlan}
                onRequestPlanChange={handleRequestPlanChange}
                onAnswerQuestion={handleAnswerQuestion}
              />
            )}

            {activeTab === 'steps' && <StudioSteps steps={session.steps} shots={shots} />}

            {activeTab === 'audits' && <StudioAudits audits={session.audits} shots={shots} />}

            {activeTab === 'feedback' && (
              <StudioFeedback
                personaResults={session.personaResults}
                aggregate={session.personaAggregate}
              />
            )}

            {activeTab === 'report' && (
              <StudioReport
                session={session}
                findings={findings}
                shots={shots}
                regression={regression}
                hasGeminiKey={hasGeminiKey}
                onGenerateFixPrompt={handleGenerateFixPrompt}
                onGenerateTop5Prompt={handleGenerateTop5Prompt}
                onRetest={() => onRetestApp(session)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
