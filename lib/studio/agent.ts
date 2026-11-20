import { createFindingFingerprint } from './audits';
import { BridgeCallError, StudioBridge } from './bridge';
import { dataUrlToInlinePart, GeminiPart, generateJson, StudioGeminiHooks } from './gemini';
import { AGENT_RESPONSE_SCHEMA, AGENT_SYSTEM_PROMPT } from './prompts';
import { createStudioId, getStudioSettings, getStudioVault, saveShot } from './store';
import {
  AgentDecision,
  AgentNextAction,
  BridgeEvidence,
  BridgeSnapshot,
  SnapshotElement,
  StageActivityStatus,
  StudioFinding,
  StudioStep,
  StudioVaultAccount,
} from './types';

export interface AgentGoalRunParams {
  sessionId: string;
  goalId: string;
  goal: string;
  maxSteps: number;
  languageHint: string;
  personaId?: string;
  personaName?: string;
  personaRules?: string;
  bridge: StudioBridge;
  signal: AbortSignal;
  isPaused: () => boolean;
  waitWhilePaused: () => Promise<void>;
  isSkipped: () => boolean;
  consumeSteeringMessages: () => string[];
  askUser: (params: {
    question: string;
    kind: 'text' | 'choice' | 'credentials' | 'destructive';
    options?: string[];
    dangerLabel?: string;
  }) => Promise<{
    answer?: string;
    accountId?: string;
    timedOut?: boolean;
  }>;
  getSessionAlwaysAllowDestructive: () => boolean;
  setSessionAlwaysAllowDestructive: () => void;
  isScreenshotAvailable: () => boolean;
  markScreenshotUnavailable: () => void;
  pauseSession: (reason: string) => void;
  onActivityChange: (status: StageActivityStatus, caption?: string) => void;
  onStep: (step: StudioStep) => void;
  onFinding: (finding: StudioFinding) => void;
  onAgentSay: (text: string) => void;
  onSystemNotice: (text: string) => void;
  geminiHooks: StudioGeminiHooks;
}

export interface AgentGoalRunResult {
  status: 'completed' | 'blocked' | 'stopped' | 'skipped' | 'max_steps';
  reason: string;
  steps: StudioStep[];
}

function summarizeSnapshotForPrompt(snap: BridgeSnapshot) {
  const sorted = [...(snap.elements || [])].sort((a, b) => {
    if (a.inView !== b.inView) return a.inView ? -1 : 1;
    return a.i - b.i;
  });

  const compactElements = sorted.slice(0, 60).map((el: SnapshotElement) => {
    const item: Record<string, unknown> = {
      i: el.i,
      tag: el.tag,
      role: el.role,
      name: el.name,
      inView: el.inView,
    };
    if (el.type) item.type = el.type;
    if (el.disabled) item.disabled = true;
    if (el.checked !== undefined) item.checked = el.checked;
    if (el.invalid) item.invalid = true;
    if (el.required) item.required = true;
    if (el.danger) item.danger = true;
    if (el.href) item.href = el.href;
    if (el.options && el.options.length > 0) item.options = el.options.slice(0, 12);
    if (el.value) {
      item.value = el.type === 'password' ? '[MASKED]' : String(el.value).slice(0, 80);
    }
    return item;
  });

  return {
    url: snap.url,
    title: snap.title,
    viewport: snap.viewport,
    headings: (snap.headings || []).slice(0, 12),
    visibleAlerts: (snap.visibleAlerts || []).slice(0, 8),
    dialogs: (snap.dialogs || []).slice(0, 5),
    focused: snap.focused || null,
    totalInteractive: snap.totalInteractive,
    shown: compactElements.length,
    elements: compactElements,
    textExcerpt: (snap.text || '').slice(0, 1000),
  };
}

function buildSnapshotFingerprint(snap: BridgeSnapshot): string {
  const topEls = (snap.elements || [])
    .slice(0, 20)
    .map((e) => `${e.i}:${e.tag}:${e.name}:${e.type === 'password' ? '*' : e.value || ''}:${e.checked || ''}`)
    .join('|');
  return `${snap.url}::${snap.viewport?.scrollY || 0}::${topEls}`;
}

function buildActionFingerprint(next: AgentNextAction): string {
  return `${next.type}:${next.index ?? ''}:${next.path ?? ''}:${next.key ?? ''}:${next.to ?? ''}:${next.dy ?? ''}`;
}

function formatSafeActionSummary(next: AgentNextAction, targetName?: string): string {
  switch (next.type) {
    case 'click':
      return `click "${targetName || `#${next.index}`}"`;
    case 'type':
      return `type into "${targetName || `#${next.index}`}"`;
    case 'type_credential':
      return next.field === 'password' ? 'typed password' : 'typed email';
    case 'select':
      return `select "${next.value || ''}" on "${targetName || `#${next.index}`}"`;
    case 'check':
      return `${next.checked ? 'check' : 'uncheck'} "${targetName || `#${next.index}`}"`;
    case 'hover':
      return `hover "${targetName || `#${next.index}`}"`;
    case 'press':
      return `press ${next.key || 'Enter'}`;
    case 'scroll':
      return next.to ? `scroll to ${next.to}` : `scroll ${next.dy || 300}px`;
    case 'navigate':
      return `navigate to ${next.path || '/'}`;
    case 'back':
      return 'navigate back';
    case 'wait':
      return 'wait for page';
    case 'finish':
      return 'finish goal';
    default:
      return String(next.type);
  }
}

export async function runAgentGoal(params: AgentGoalRunParams): Promise<AgentGoalRunResult> {
  const steps: StudioStep[] = [];
  let lastEvidence: BridgeEvidence | null = null;
  let lastActionNote = '';
  let lastActionFp = '';
  let repeatedActionCount = 0;
  let lastSnapFp = '';
  let unchangedSnapCount = 0;
  let stuckWarnings = 0;
  let latestShotDataUrl: string | null = null;

  const findAccountByIdOrLabel = (
    accounts: StudioVaultAccount[],
    preferred?: string
  ): StudioVaultAccount | undefined => {
    if (accounts.length === 0) return undefined;
    if (!preferred) return accounts[0];
    const lower = preferred.trim().toLowerCase();
    return (
      accounts.find((a) => a.id === preferred) ||
      accounts.find((a) => a.label.toLowerCase() === lower) ||
      accounts[0]
    );
  };

  for (let stepNum = 1; stepNum <= params.maxSteps; stepNum += 1) {
    if (params.signal.aborted) {
      return { status: 'stopped', reason: 'Stopped by user.', steps };
    }
    if (params.isSkipped()) {
      return { status: 'skipped', reason: 'Skipped by user.', steps };
    }
    if (params.isPaused()) {
      params.onActivityChange('Paused');
      await params.waitWhilePaused();
      if (params.signal.aborted) {
        return { status: 'stopped', reason: 'Stopped by user.', steps };
      }
      if (params.isSkipped()) {
        return { status: 'skipped', reason: 'Skipped by user.', steps };
      }
    }

    // 1. Snapshot
    params.onActivityChange('Thinking', 'Inspecting screen...');
    let snap: BridgeSnapshot;
    try {
      snap = await params.bridge.snapshot(80);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Snapshot failed';
      return {
        status: 'blocked',
        reason: `Could not read page snapshot: ${msg}`,
        steps,
      };
    }

    // Stuck detection on snapshot fingerprint
    const snapFp = buildSnapshotFingerprint(snap);
    if (snapFp === lastSnapFp) {
      unchangedSnapCount += 1;
    } else {
      unchangedSnapCount = 0;
      lastSnapFp = snapFp;
    }

    let stuckNotice: string | undefined;
    if (repeatedActionCount >= 3 || unchangedSnapCount >= 3) {
      stuckWarnings += 1;
      if (stuckWarnings >= 2) {
        const reason =
          repeatedActionCount >= 3
            ? 'Goal stopped as blocked: repeated the same action without progress.'
            : 'Goal stopped as blocked: page state did not change after multiple steps.';
        params.onSystemNotice(reason);
        return { status: 'blocked', reason, steps };
      }
      stuckNotice =
        'WARNING: You appear stuck (same action repeated or page unchanged for 3 steps). Try a different element, scroll, go back, or set next.type="finish" if blocked.';
      repeatedActionCount = 0;
      unchangedSnapCount = 0;
    }

    const vaultAccounts = getStudioVault();
    const steeringMessages = params.consumeSteeringMessages();

    const promptPayload = {
      goal: params.goal,
      stepNumber: stepNum,
      maxSteps: params.maxSteps,
      preferredLanguage: params.languageHint || 'English',
      persona: params.personaId
        ? {
            name: params.personaName,
            behaviorRules: params.personaRules,
          }
        : null,
      availableVaultAccounts: vaultAccounts.map((a) => ({
        label: a.label,
        hasEmail: !!a.email,
        hasPassword: !!a.password,
      })),
      stuckWarning: stuckNotice || null,
      previousActionNote: lastActionNote || null,
      newSteeringMessages: steeringMessages.map((msg) => ({ NEW: msg })),
      recentSteps: steps.slice(-12).map((s) => ({
        step: s.index,
        url: s.url,
        action: s.actionSummary,
        result: s.resultStatus,
        detail: s.resultDetail,
      })),
      evidenceSinceLastStep: lastEvidence
        ? {
            consoleErrors: lastEvidence.consoleErrors.slice(0, 6),
            pageErrors: lastEvidence.pageErrors.slice(0, 6),
            failedRequests: lastEvidence.failedRequests.slice(0, 6),
            brokenResources: lastEvidence.brokenResources.slice(0, 6),
          }
        : null,
      untrustedPageSnapshot: summarizeSnapshotForPrompt(snap),
    };

    const userParts: GeminiPart[] = [{ text: JSON.stringify(promptPayload) }];
    if (latestShotDataUrl) {
      const part = dataUrlToInlinePart(latestShotDataUrl);
      if (part) userParts.push(part);
      latestShotDataUrl = null;
    }

    // 2. Gemini decision
    const decision = await generateJson<AgentDecision>(
      {
        system: AGENT_SYSTEM_PROMPT,
        schema: AGENT_RESPONSE_SCHEMA,
        userParts,
        temperature: 0.25,
        signal: params.signal,
      },
      params.geminiHooks
    );

    if (params.signal.aborted) {
      return { status: 'stopped', reason: 'Stopped by user.', steps };
    }

    if (decision.say) {
      params.onAgentSay(decision.say);
    }

    // Record any reported issues from agent
    const reportedIssues = Array.isArray(decision.issues) ? decision.issues : [];
    const stepFindings: StudioFinding[] = [];
    for (const iss of reportedIssues) {
      const pageUrl = iss.page || snap.url || params.bridge.getCurrentUrl();
      const finding: StudioFinding = {
        id: createStudioId('find'),
        sessionId: params.sessionId,
        fingerprint: createFindingFingerprint(iss.title, pageUrl),
        severity: iss.severity || 'medium',
        title: iss.title || 'Observed issue',
        page: pageUrl,
        source: params.personaId ? 'persona' : 'agent',
        whatHappened: iss.evidence || decision.observation || decision.say,
        whyItHappened: decision.observation || 'Observed during autonomous browser interaction.',
        expectedVsActual: `Expected: clean user flow without errors or blockers.\nActual: ${iss.evidence || iss.title}`,
        stepsToReproduce: [
          ...steps.slice(-4).map((s) => `${s.actionSummary} (${s.url})`),
          `${decision.caption} on ${pageUrl}`,
        ],
        evidence: iss.evidence || '',
        createdAt: new Date().toISOString(),
      };
      stepFindings.push(finding);
    }

    // 3. Handle agent asking the user a question
    let selectedAccountForCredential: StudioVaultAccount | undefined;
    if (decision.ask && decision.ask.question) {
      params.onActivityChange('Waiting for you', decision.ask.question);
      const userReply = await params.askUser({
        question: decision.ask.question,
        kind: decision.ask.kind,
        options: decision.ask.options,
      });

      if (params.signal.aborted) {
        return { status: 'stopped', reason: 'Stopped by user.', steps };
      }

      if (userReply.timedOut) {
        params.onSystemNotice(
          'No answer received within 90 seconds. Continuing with a safe default.'
        );
      } else if (userReply.accountId) {
        const latestVault = getStudioVault();
        selectedAccountForCredential = findAccountByIdOrLabel(latestVault, userReply.accountId);
      } else if (userReply.answer) {
        lastActionNote = `User answered your question "${decision.ask.question}": ${userReply.answer}`;
      }
    }

    const next = decision.next || { type: 'finish' };
    const targetElement =
      typeof next.index === 'number'
        ? (snap.elements || []).find((el) => el.i === next.index)
        : undefined;

    // 4. Finish check
    if (next.type === 'finish') {
      let finishShotId: string | undefined;
      if (stepFindings.length > 0 && params.isScreenshotAvailable()) {
        try {
          const shot = await params.bridge.screenshot(0.5, 0.6);
          if (shot?.dataUrl) {
            finishShotId = await saveShot(params.sessionId, shot.dataUrl);
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('screenshot_unavailable')) {
            params.markScreenshotUnavailable();
          }
        }
      }
      for (const f of stepFindings) {
        if (finishShotId) f.shotId = finishShotId;
        params.onFinding(f);
      }

      const finishStep: StudioStep = {
        id: createStudioId('step'),
        index: stepNum,
        ts: new Date().toISOString(),
        goalId: params.goalId,
        personaId: params.personaId,
        personaName: params.personaName,
        caption: decision.caption || 'Goal finished',
        say: decision.say || 'Completed goal.',
        action: next,
        actionSummary: 'finish',
        resultStatus: 'passed',
        resultDetail: decision.observation || 'Goal completed',
        url: snap.url,
        shotId: finishShotId,
        evidenceDelta: {
          consoleErrors: [],
          pageErrors: [],
          failedRequests: [],
          brokenResources: [],
        },
      };
      steps.push(finishStep);
      params.onStep(finishStep);
      return {
        status: 'completed',
        reason: decision.observation || decision.say || 'Goal completed.',
        steps,
      };
    }

    // Track action repetition
    const currentActionFp = buildActionFingerprint(next);
    if (currentActionFp === lastActionFp) {
      repeatedActionCount += 1;
    } else {
      repeatedActionCount = 1;
      lastActionFp = currentActionFp;
    }

    // 5. Destructive guard
    const studioSettings = getStudioSettings();
    let skipActionBecauseDestructive = false;
    if (
      targetElement?.danger &&
      !studioSettings.allowDestructive &&
      !params.getSessionAlwaysAllowDestructive()
    ) {
      params.onActivityChange('Waiting for you', 'Confirm destructive action');
      const guardReply = await params.askUser({
        question: `The next action targets a potentially destructive control: "${targetElement.name || targetElement.tag}". How would you like to proceed?`,
        kind: 'destructive',
        options: ['Allow once', 'Skip', 'Always allow in this session'],
        dangerLabel: targetElement.name || targetElement.tag,
      });

      if (params.signal.aborted) {
        return { status: 'stopped', reason: 'Stopped by user.', steps };
      }

      if (guardReply.answer === 'Always allow in this session') {
        params.setSessionAlwaysAllowDestructive();
      } else if (guardReply.answer !== 'Allow once') {
        skipActionBecauseDestructive = true;
      }
    }

    // 6. Execute action
    params.onActivityChange('Acting', decision.caption || formatSafeActionSummary(next, targetElement?.name));

    let resultStatus: StudioStep['resultStatus'] = 'passed';
    let resultDetail = 'Executed';
    const urlBeforeAction = snap.url || params.bridge.getCurrentUrl();

    if (skipActionBecauseDestructive) {
      resultStatus = 'warning';
      resultDetail = 'Skipped destructive action per safety guard.';
      lastActionNote = 'Destructive action was skipped by the user. Choose another safe action.';
    } else {
      try {
        if (typeof next.index === 'number') {
          await params.bridge.highlight({ index: next.index, label: decision.caption }).catch(() => {});
        }

        switch (next.type) {
          case 'click': {
            if (typeof next.index !== 'number') {
              resultStatus = 'failed';
              resultDetail = 'Missing element index for click.';
              break;
            }
            const clickRes = await params.bridge.click({
              index: next.index,
              label: decision.caption,
            });
            if (!clickRes.ok) {
              if (clickRes.reason === 'covered') {
                resultStatus = 'failed';
                resultDetail = `Element is covered by ${clickRes.blockedBy || 'another element'}.`;
                const title = `Interactive element covered: ${targetElement?.name || clickRes.target || `#${next.index}`}`;
                stepFindings.push({
                  id: createStudioId('find'),
                  sessionId: params.sessionId,
                  fingerprint: createFindingFingerprint(title, urlBeforeAction),
                  severity: 'high',
                  title,
                  page: urlBeforeAction,
                  source: 'covered',
                  whatHappened: `Element "${targetElement?.name || clickRes.target || `#${next.index}`}" exists in the DOM but cannot be tapped because it is covered by ${clickRes.blockedBy || 'an overlapping element'}.`,
                  whyItHappened: 'A sticky header, overlay, modal backdrop, or z-index stacking issue is blocking pointer events.',
                  expectedVsActual: `Expected: clicking "${targetElement?.name || `#${next.index}`}" triggers its action.\nActual: blocked by ${clickRes.blockedBy || 'overlapping element'}.`,
                  stepsToReproduce: [
                    `Open ${urlBeforeAction}`,
                    `Attempt to click "${targetElement?.name || `#${next.index}`}"`,
                  ],
                  evidence: `click returned reason="covered", blockedBy="${clickRes.blockedBy || 'unknown'}"`,
                  createdAt: new Date().toISOString(),
                });
              } else {
                resultStatus = 'warning';
                resultDetail = `Click blocked (${clickRes.reason || 'disabled'}).`;
              }
            } else {
              resultDetail = `Clicked ${clickRes.target || targetElement?.name || `#${next.index}`}`;
            }
            break;
          }

          case 'type': {
            if (typeof next.index !== 'number') {
              resultStatus = 'failed';
              resultDetail = 'Missing element index for type.';
              break;
            }
            const typeRes = await params.bridge.type({
              index: next.index,
              text: next.text ?? next.value ?? '',
              clear: true,
              submit: !!next.submit,
              label: decision.caption,
            });
            if (!typeRes.ok) {
              resultStatus = 'failed';
              resultDetail = `Cannot type (${typeRes.reason || 'not_editable'}).`;
            } else {
              resultDetail = `Entered ${typeRes.valueLength ?? (next.text || '').length} chars`;
            }
            break;
          }

          case 'type_credential': {
            if (typeof next.index !== 'number') {
              resultStatus = 'failed';
              resultDetail = 'Missing element index for credential input.';
              break;
            }
            let vault = getStudioVault();
            let account =
              selectedAccountForCredential || findAccountByIdOrLabel(vault, next.account);

            if (!account) {
              params.onActivityChange('Waiting for you', 'Need test account');
              const credRes = await params.askUser({
                question: 'Select or add a test account from the vault to sign in.',
                kind: 'credentials',
              });
              if (params.signal.aborted) {
                return { status: 'stopped', reason: 'Stopped by user.', steps };
              }
              vault = getStudioVault();
              account = findAccountByIdOrLabel(vault, credRes.accountId);
            }

            if (!account) {
              resultStatus = 'warning';
              resultDetail = 'No test account available in vault.';
              lastActionNote = 'No test account was provided. Continue without logging in or finish if blocked.';
              break;
            }

            const secretVal = next.field === 'password' ? account.password : account.email;
            const typeRes = await params.bridge.type({
              index: next.index,
              text: secretVal,
              clear: true,
              submit: !!next.submit,
              label: next.field === 'password' ? 'password' : 'email',
            });
            if (!typeRes.ok) {
              resultStatus = 'failed';
              resultDetail = `Could not fill credential (${typeRes.reason || 'error'}).`;
            } else {
              resultDetail =
                next.field === 'password' ? 'typed password' : 'typed email';
            }
            break;
          }

          case 'select': {
            if (typeof next.index !== 'number') {
              resultStatus = 'failed';
              resultDetail = 'Missing element index for select.';
              break;
            }
            const selRes = await params.bridge.select({
              index: next.index,
              value: next.value || next.text || '',
            });
            if (!selRes.ok) {
              resultStatus = 'warning';
              resultDetail = `Option not found. Available: ${(selRes.options || []).slice(0, 6).join(', ')}`;
              lastActionNote = resultDetail;
            } else {
              resultDetail = `Selected "${selRes.selected || next.value}"`;
            }
            break;
          }

          case 'check': {
            if (typeof next.index !== 'number') {
              resultStatus = 'failed';
              resultDetail = 'Missing element index for check.';
              break;
            }
            await params.bridge.check({
              index: next.index,
              checked: next.checked ?? true,
            });
            resultDetail = next.checked ?? true ? 'Checked' : 'Unchecked';
            break;
          }

          case 'hover': {
            if (typeof next.index !== 'number') {
              resultStatus = 'failed';
              resultDetail = 'Missing element index for hover.';
              break;
            }
            await params.bridge.hover({ index: next.index });
            resultDetail = 'Hovered';
            break;
          }

          case 'press': {
            await params.bridge.press({ key: next.key || 'Enter' });
            resultDetail = `Pressed ${next.key || 'Enter'}`;
            break;
          }

          case 'scroll': {
            await params.bridge.scroll(
              next.to ? { to: next.to } : { dy: next.dy ?? 420 }
            );
            resultDetail = next.to ? `Scrolled to ${next.to}` : `Scrolled ${next.dy ?? 420}px`;
            break;
          }

          case 'navigate': {
            await params.bridge.navigate(next.path || '/');
            resultDetail = `Navigated to ${next.path || '/'}`;
            break;
          }

          case 'back': {
            await params.bridge.back();
            resultDetail = 'Navigated back';
            break;
          }

          case 'wait': {
            await params.bridge.waitSettled(2000, 300);
            resultDetail = 'Waited for page settle';
            break;
          }
        }
      } catch (err) {
        if (err instanceof BridgeCallError && (err.code === 'stale_element' || err.code === 'unknown_index')) {
          resultStatus = 'warning';
          resultDetail = 'Element index became stale; refreshing snapshot.';
          lastActionNote = 'Previous element index was stale or unknown; use indexes from the newest snapshot.';
        } else if (err instanceof BridgeCallError && err.code === 'cross_origin_blocked') {
          resultStatus = 'warning';
          resultDetail = 'Cross-origin navigation blocked by safety guard.';
          lastActionNote = 'Cannot navigate outside the tested app origin.';
        } else {
          resultStatus = 'failed';
          resultDetail = err instanceof Error ? err.message : 'Action execution failed';
          lastActionNote = `Last action failed: ${resultDetail}`;
        }
      }
    }

    // 7. waitSettled + evidence delta
    await params.bridge.waitSettled(4000, 400);
    const ev = await params.bridge.evidence(true).catch(
      (): BridgeEvidence => ({
        consoleErrors: [],
        consoleWarnings: [],
        pageErrors: [],
        failedRequests: [],
        brokenResources: [],
        longTasks: 0,
        cls: 0,
        lcp: 0,
        fcp: 0,
        pendingRequests: 0,
      })
    );
    lastEvidence = ev;

    const currentUrlAfter = params.bridge.getCurrentUrl();
    const urlChanged = currentUrlAfter !== urlBeforeAction;

    // 8. Screenshot when issue reported, page changed, or every 5 steps
    let stepShotId: string | undefined;
    const shouldTakeShot =
      stepFindings.length > 0 || urlChanged || stepNum % 5 === 0 || stepNum === 1;

    if (shouldTakeShot && params.isScreenshotAvailable()) {
      try {
        const shot = await params.bridge.screenshot(0.5, 0.6);
        if (shot?.dataUrl) {
          latestShotDataUrl = shot.dataUrl;
          stepShotId = await saveShot(params.sessionId, shot.dataUrl);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('screenshot_unavailable')) {
          params.markScreenshotUnavailable();
        }
      }
    }

    for (const f of stepFindings) {
      if (stepShotId) f.shotId = stepShotId;
      params.onFinding(f);
    }

    const stepRecord: StudioStep = {
      id: createStudioId('step'),
      index: stepNum,
      ts: new Date().toISOString(),
      goalId: params.goalId,
      personaId: params.personaId,
      personaName: params.personaName,
      caption: decision.caption || formatSafeActionSummary(next, targetElement?.name),
      say: decision.say || '',
      action: next,
      actionSummary: formatSafeActionSummary(next, targetElement?.name),
      resultStatus,
      resultDetail,
      url: currentUrlAfter,
      shotId: stepShotId,
      evidenceDelta: {
        consoleErrors: ev.consoleErrors || [],
        pageErrors: ev.pageErrors || [],
        failedRequests: ev.failedRequests || [],
        brokenResources: ev.brokenResources || [],
      },
    };

    steps.push(stepRecord);
    params.onStep(stepRecord);

    // Optional pause on error setting
    const hasNewRuntimeErrors =
      (ev.consoleErrors?.length || 0) > 0 ||
      (ev.pageErrors?.length || 0) > 0 ||
      (ev.failedRequests?.length || 0) > 0;

    if (studioSettings.pauseOnError && (hasNewRuntimeErrors || resultStatus === 'failed')) {
      params.pauseSession(
        `Paused on step ${stepNum} because an error was detected (${
          ev.pageErrors?.[0] || ev.consoleErrors?.[0] || ev.failedRequests?.[0] || resultDetail
        }).`
      );
    }
  }

  return {
    status: 'max_steps',
    reason: `Reached configured step budget (${params.maxSteps} steps).`,
    steps,
  };
}
