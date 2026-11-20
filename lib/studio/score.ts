import { createFindingFingerprint } from './audits';
import { generateJson, StudioGeminiHooks } from './gemini';
import {
  EXECUTIVE_SUMMARY_SCHEMA,
  FIX_PROMPT_REQUIRED_ENDING,
  FIX_PROMPT_SCHEMA,
} from './prompts';
import {
  StudioExecutiveSummary,
  StudioFinding,
  StudioRegressionComparison,
  StudioScoreBreakdown,
  StudioSession,
  StudioSeverity,
  StudioVerdict,
} from './types';

const SEVERITY_RANK: Record<StudioSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function deduplicateFindings(findings: StudioFinding[]): StudioFinding[] {
  const map = new Map<string, StudioFinding>();

  for (const item of findings) {
    const fp = item.fingerprint || createFindingFingerprint(item.title, item.page);
    const existing = map.get(fp);
    if (!existing) {
      map.set(fp, { ...item, fingerprint: fp });
    } else {
      const winnerSeverity =
        SEVERITY_RANK[item.severity] > SEVERITY_RANK[existing.severity]
          ? item.severity
          : existing.severity;
      map.set(fp, {
        ...existing,
        severity: winnerSeverity,
        shotId: existing.shotId || item.shotId,
        evidence:
          item.evidence && item.evidence.length > existing.evidence.length
            ? item.evidence
            : existing.evidence,
        whatHappened:
          item.whatHappened && item.whatHappened.length > existing.whatHappened.length
            ? item.whatHappened
            : existing.whatHappened,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );
}

export const ALWAYS_NOT_TESTED = [
  'CAPTCHA, SMS/email OTP, and multi-factor authentication challenges',
  'Real payment processing and third-party checkout redirects',
  'Native OS file upload pickers and camera/microphone hardware prompts',
  'Real physical iOS and Android devices (only viewport simulation was run)',
  'High-concurrency load, stress, and server-side security penetration testing',
];

export function computeStudioScore(
  session: StudioSession,
  dedupedFindings: StudioFinding[]
): StudioScoreBreakdown {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const f of dedupedFindings) {
    if (f.severity === 'critical') criticalCount += 1;
    else if (f.severity === 'high') highCount += 1;
    else if (f.severity === 'medium') mediumCount += 1;
    else lowCount += 1;
  }

  const criticalDed = criticalCount * 20;
  const highDed = highCount * 10;
  const mediumDed = mediumCount * 4;
  const lowDed = lowCount * 1;

  // Accessibility high issues: 3 each (max 15)
  const a11yHighCount = (session.audits?.a11y?.issues || [])
    .filter((i) => i.severity === 'high' || i.severity === 'critical')
    .reduce((sum, i) => sum + (i.count || 1), 0);
  const a11yHighDed = Math.min(15, a11yHighCount * 3);

  // Layout issues: 2 per device that has any (max 12)
  const devicesWithIssues = (session.audits?.devices || []).filter(
    (d) => (d.result?.issues?.length || 0) > 0
  ).length;
  const layoutDevicesDed = Math.min(12, devicesWithIssues * 2);

  // Console errors and failed requests combined: min(count, 10)
  let consoleAndReqCount = 0;
  for (const step of session.steps || []) {
    consoleAndReqCount +=
      (step.evidenceDelta?.consoleErrors?.length || 0) +
      (step.evidenceDelta?.pageErrors?.length || 0) +
      (step.evidenceDelta?.failedRequests?.length || 0);
  }
  if (session.audits?.perf?.evidence) {
    consoleAndReqCount +=
      (session.audits.perf.evidence.consoleErrors?.length || 0) +
      (session.audits.perf.evidence.pageErrors?.length || 0) +
      (session.audits.perf.evidence.failedRequests?.length || 0);
  }
  if (session.audits?.links?.entries) {
    for (const entry of session.audits.links.entries) {
      consoleAndReqCount += (entry.consoleErrors || 0) + (entry.failedRequests || 0);
    }
  }
  const consoleAndNetworkDed = Math.min(10, consoleAndReqCount);

  // Persona failure rate * 25 + low rating penalty
  const personas = session.personaResults || [];
  let personaFailuresDed = 0;
  let lowPersonaRatingDed = 0;

  if (personas.length > 0) {
    const failedCount = personas.filter((p) => p.taskResult === 'failed').length;
    const failureRate = failedCount / personas.length;
    personaFailuresDed = Math.round(failureRate * 25);

    const avgRating =
      personas.reduce((sum, p) => sum + (p.rating || 0), 0) / personas.length;
    if (avgRating < 3) {
      lowPersonaRatingDed = 10;
    }
  }

  const totalDeduction =
    criticalDed +
    highDed +
    mediumDed +
    lowDed +
    a11yHighDed +
    layoutDevicesDed +
    consoleAndNetworkDed +
    personaFailuresDed +
    lowPersonaRatingDed;

  const score = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));

  let verdict: StudioVerdict = 'Not ready';
  if (score >= 85 && criticalCount === 0 && highCount === 0) {
    verdict = 'Ready';
  } else if (score >= 65 && criticalCount === 0) {
    verdict = 'Ready with fixes';
  }

  const notTested = Array.from(
    new Set([...ALWAYS_NOT_TESTED, ...(session.notTestedSelections || [])])
  );

  return {
    score,
    verdict,
    deductions: {
      critical: criticalDed,
      high: highDed,
      medium: mediumDed,
      low: lowDed,
      a11yHigh: a11yHighDed,
      layoutDevices: layoutDevicesDed,
      consoleAndNetwork: consoleAndNetworkDed,
      personaFailures: personaFailuresDed,
      lowPersonaRating: lowPersonaRatingDed,
    },
    notTested,
  };
}

export function computeRegressionComparison(
  currentScore: number,
  currentFindings: StudioFinding[],
  previousSession: StudioSession,
  previousFindings: StudioFinding[]
): StudioRegressionComparison {
  const prevMap = new Map<string, StudioFinding>();
  for (const f of deduplicateFindings(previousFindings)) {
    prevMap.set(f.fingerprint, f);
  }

  const currMap = new Map<string, StudioFinding>();
  for (const f of deduplicateFindings(currentFindings)) {
    currMap.set(f.fingerprint, f);
  }

  const fixed: StudioRegressionComparison['fixed'] = [];
  const stillFailing: StudioRegressionComparison['stillFailing'] = [];
  const newFindings: StudioRegressionComparison['newFindings'] = [];

  for (const [fp, pf] of prevMap) {
    if (!currMap.has(fp)) {
      fixed.push({
        fingerprint: fp,
        title: pf.title,
        severity: pf.severity,
        page: pf.page,
      });
    } else {
      stillFailing.push({
        fingerprint: fp,
        title: currMap.get(fp)!.title,
        severity: currMap.get(fp)!.severity,
        page: currMap.get(fp)!.page,
      });
    }
  }

  for (const [fp, cf] of currMap) {
    if (!prevMap.has(fp)) {
      newFindings.push({
        fingerprint: fp,
        title: cf.title,
        severity: cf.severity,
        page: cf.page,
      });
    }
  }

  const previousScore = previousSession.scoreBreakdown?.score ?? 100;

  return {
    previousSessionId: previousSession.id,
    previousDate: previousSession.createdAt,
    previousScore,
    scoreDelta: currentScore - previousScore,
    fixed,
    stillFailing,
    newFindings,
  };
}

export async function generateExecutiveSummary(
  params: {
    session: StudioSession;
    findings: StudioFinding[];
    breakdown: StudioScoreBreakdown;
    languageHint: string;
    signal?: AbortSignal;
  },
  hooks: StudioGeminiHooks = {}
): Promise<StudioExecutiveSummary> {
  const compactFindings = params.findings.slice(0, 25).map((f) => ({
    severity: f.severity,
    title: f.title,
    page: f.page,
    whatHappened: f.whatHappened,
  }));

  const raw = await generateJson<StudioExecutiveSummary>(
    {
      system:
        'You are TestPilot Lead writing an executive QA readiness summary for a solo builder. Explain the go/no-go reasoning plainly and prioritize up to 5 concrete fixes. Base every statement strictly on the provided score, findings, audits, and persona results. Reply in the requested language.',
      schema: EXECUTIVE_SUMMARY_SCHEMA,
      temperature: 0.25,
      signal: params.signal,
      userParts: [
        {
          text: JSON.stringify({
            appUrl: params.session.appUrl,
            preferredLanguage: params.languageHint || 'English',
            score: params.breakdown.score,
            verdict: params.breakdown.verdict,
            deductions: params.breakdown.deductions,
            findingsCount: params.findings.length,
            topFindings: compactFindings,
            audits: {
              devicesChecked: params.session.audits?.devices?.length || 0,
              a11yIssues: params.session.audits?.a11y?.issues?.length || 0,
              seoIssues: params.session.audits?.seo?.issues?.length || 0,
              brokenLinks: params.session.audits?.links?.brokenCount || 0,
            },
            personasSummary: (params.session.personaResults || []).map((p) => ({
              name: p.personaName,
              taskResult: p.taskResult,
              rating: p.rating,
            })),
          }),
        },
      ],
    },
    hooks
  );

  return {
    goNoGoReasoning: raw.goNoGoReasoning || `Score ${params.breakdown.score}/100 (${params.breakdown.verdict}).`,
    top5Fixes: (Array.isArray(raw.top5Fixes) ? raw.top5Fixes : []).slice(0, 5),
  };
}

function enforceFixPromptEnding(text: string): string {
  const cleaned = text.trim();
  if (cleaned.endsWith(FIX_PROMPT_REQUIRED_ENDING)) {
    return cleaned;
  }
  return `${cleaned}\n\n${FIX_PROMPT_REQUIRED_ENDING}`;
}

export async function generateFindingFixPrompt(
  params: {
    finding: StudioFinding;
    appUrl: string;
    languageHint: string;
    signal?: AbortSignal;
  },
  hooks: StudioGeminiHooks = {}
): Promise<string> {
  const raw = await generateJson<{ fixPrompt: string }>(
    {
      system: `You write a crisp, ready-to-paste fix prompt for an AI app builder. Name the affected screen or route, clearly describe the bug and the expected behavior, include the factual evidence, and ALWAYS end with the exact sentence: "${FIX_PROMPT_REQUIRED_ENDING}"`,
      schema: FIX_PROMPT_SCHEMA,
      temperature: 0.2,
      signal: params.signal,
      userParts: [
        {
          text: JSON.stringify({
            appUrl: params.appUrl,
            preferredLanguage: params.languageHint || 'English',
            finding: {
              severity: params.finding.severity,
              title: params.finding.title,
              page: params.finding.page,
              whatHappened: params.finding.whatHappened,
              whyItHappened: params.finding.whyItHappened,
              expectedVsActual: params.finding.expectedVsActual,
              stepsToReproduce: params.finding.stepsToReproduce,
              evidence: params.finding.evidence,
            },
          }),
        },
      ],
    },
    hooks
  );

  return enforceFixPromptEnding(raw.fixPrompt || params.finding.whatHappened);
}

export async function generateTop5CombinedFixPrompt(
  params: {
    session: StudioSession;
    findings: StudioFinding[];
    languageHint: string;
    signal?: AbortSignal;
  },
  hooks: StudioGeminiHooks = {}
): Promise<string> {
  const top5 = params.findings.slice(0, 5).map((f, idx) => ({
    rank: idx + 1,
    severity: f.severity,
    title: f.title,
    page: f.page,
    whatHappened: f.whatHappened,
    expectedVsActual: f.expectedVsActual,
    evidence: f.evidence,
  }));

  const raw = await generateJson<{ fixPrompt: string }>(
    {
      system: `You combine the top QA findings into one clean, well-structured prompt for an AI app builder. Reference each screen/route, problem, expected behavior, and factual evidence. End with the exact sentence: "${FIX_PROMPT_REQUIRED_ENDING}"`,
      schema: FIX_PROMPT_SCHEMA,
      temperature: 0.2,
      signal: params.signal,
      userParts: [
        {
          text: JSON.stringify({
            appUrl: params.session.appUrl,
            preferredLanguage: params.languageHint || 'English',
            topFindings: top5,
          }),
        },
      ],
    },
    hooks
  );

  return enforceFixPromptEnding(raw.fixPrompt || 'Fix the top 5 issues listed above.');
}

export function buildCleanSessionExportJson(
  session: StudioSession,
  findings: StudioFinding[]
): string {
  const sanitized = {
    id: session.id,
    appUrl: session.appUrl,
    appOrigin: session.appOrigin,
    device: {
      id: session.deviceId,
      width: session.deviceWidth,
      height: session.deviceHeight,
    },
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    geminiRequestsUsed: session.geminiRequestsUsed,
    scoreBreakdown: session.scoreBreakdown || null,
    executiveSummary: session.executiveSummary || null,
    findings: findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      page: f.page,
      source: f.source,
      whatHappened: f.whatHappened,
      whyItHappened: f.whyItHappened,
      expectedVsActual: f.expectedVsActual,
      stepsToReproduce: f.stepsToReproduce,
      evidence: f.evidence,
      fixPrompt: f.fixPrompt,
    })),
    audits: session.audits,
    personaResults: session.personaResults,
    personaAggregate: session.personaAggregate || null,
    steps: session.steps.map((s) => ({
      index: s.index,
      ts: s.ts,
      goalId: s.goalId,
      personaName: s.personaName,
      caption: s.caption,
      say: s.say,
      actionSummary: s.actionSummary,
      resultStatus: s.resultStatus,
      resultDetail: s.resultDetail,
      url: s.url,
      evidenceDelta: s.evidenceDelta,
    })),
  };

  return JSON.stringify(sanitized, null, 2);
}

export function exportSessionMarkdown(
  session: StudioSession,
  findings: StudioFinding[]
): string {
  const score = session.scoreBreakdown;
  const lines: string[] = [];

  lines.push(`# TestPilot Studio QA Report`);
  lines.push(``);
  lines.push(`- **App URL:** ${session.appUrl}`);
  lines.push(`- **Date:** ${new Date(session.createdAt).toLocaleString()}`);
  lines.push(`- **Viewport:** ${session.deviceWidth}x${session.deviceHeight}`);
  if (score) {
    lines.push(`- **Readiness Score:** ${score.score}/100 (**${score.verdict}**)`);
  }
  lines.push(`- **Gemini Requests Used:** ${session.geminiRequestsUsed}`);
  lines.push(``);

  if (session.executiveSummary) {
    lines.push(`## Executive Summary`);
    lines.push(session.executiveSummary.goNoGoReasoning);
    lines.push(``);
    if (session.executiveSummary.top5Fixes.length > 0) {
      lines.push(`### Top Priority Fixes`);
      for (const fix of session.executiveSummary.top5Fixes) {
        lines.push(`${fix.priority}. **${fix.title}** (${fix.page}) — ${fix.reason}`);
      }
      lines.push(``);
    }
  }

  lines.push(`## Findings (${findings.length})`);
  lines.push(``);
  if (findings.length === 0) {
    lines.push(`No defects or audit issues were recorded.`);
    lines.push(``);
  } else {
    for (const f of findings) {
      lines.push(`### [${f.severity.toUpperCase()}] ${f.title}`);
      lines.push(`- **Page:** ${f.page}`);
      lines.push(`- **What happened:** ${f.whatHappened}`);
      lines.push(`- **Why it likely happened:** ${f.whyItHappened}`);
      lines.push(`- **Expected vs Actual:** ${f.expectedVsActual.replace(/\n/g, ' ')}`);
      if (f.stepsToReproduce.length > 0) {
        lines.push(`- **Steps to reproduce:** ${f.stepsToReproduce.join(' -> ')}`);
      }
      if (f.evidence) {
        lines.push(`- **Evidence:** \`${f.evidence.replace(/\n/g, ' | ')}\``);
      }
      lines.push(``);
    }
  }

  if (session.personaResults.length > 0) {
    lines.push(`## Virtual User Feedback`);
    lines.push(``);
    for (const p of session.personaResults) {
      lines.push(`### ${p.personaName} (${p.taskResult.toUpperCase()}, ${p.rating}/5)`);
      lines.push(p.summary);
      if (p.confusingMoments.length > 0) {
        lines.push(`- **Quotes:** ${p.confusingMoments.map((q) => `"${q}"`).join('; ')}`);
      }
      lines.push(``);
    }
  }

  if (score?.notTested && score.notTested.length > 0) {
    lines.push(`## What Was NOT Tested`);
    for (const item of score.notTested) {
      lines.push(`- ${item}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}
