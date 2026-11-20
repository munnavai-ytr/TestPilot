'use client';

import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  Printer,
  RotateCw,
  Sparkles,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  ShieldOff,
} from 'lucide-react';
import {
  StudioFinding,
  StudioRegressionComparison,
  StudioSession,
} from '@/lib/studio/types';
import {
  buildCleanSessionExportJson,
  exportSessionMarkdown,
} from '@/lib/studio/score';
import { ScoreRing } from '@/components/ScoreRing';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenshotModal } from '@/components/ScreenshotModal';

interface StudioReportProps {
  session: StudioSession;
  findings: StudioFinding[];
  shots: Record<string, string>;
  regression: StudioRegressionComparison | null;
  hasGeminiKey: boolean;
  onGenerateFixPrompt: (finding: StudioFinding) => Promise<string>;
  onGenerateTop5Prompt: () => Promise<string>;
  onRetest: () => void;
}

export function StudioReport({
  session,
  findings,
  shots,
  regression,
  hasGeminiKey,
  onGenerateFixPrompt,
  onGenerateTop5Prompt,
  onRetest,
}: StudioReportProps) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedTop5, setCopiedTop5] = useState(false);
  const [loadingTop5, setLoadingTop5] = useState(false);
  const [loadingFindingId, setLoadingFindingId] = useState<string | null>(null);
  const [copiedFindingId, setCopiedFindingId] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [modalShot, setModalShot] = useState<{ src: string; title: string } | null>(null);

  const score = session.scoreBreakdown;
  const exec = session.executiveSummary;

  if (!score && findings.length === 0 && session.steps.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
        <FileText className="w-7 h-7 mx-auto text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Report not generated yet</p>
        <p className="text-[11px] max-w-xs mx-auto">
          Run a test plan in Chat to generate the deterministic production-readiness score, deduplicated findings, and AI builder fix prompts.
        </p>
      </div>
    );
  }

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportSessionMarkdown(session, findings));
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownloadJson = () => {
    const json = buildCleanSessionExportJson(session, findings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `testpilot-studio-report-${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyFixPrompt = async (finding: StudioFinding) => {
    setPromptError(null);
    setLoadingFindingId(finding.id);
    try {
      const promptText = finding.fixPrompt || (await onGenerateFixPrompt(finding));
      await navigator.clipboard.writeText(promptText);
      setCopiedFindingId(finding.id);
      setTimeout(() => setCopiedFindingId(null), 2000);
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Failed to generate fix prompt.');
    } finally {
      setLoadingFindingId(null);
    }
  };

  const handleCopyTop5 = async () => {
    setPromptError(null);
    setLoadingTop5(true);
    try {
      const promptText = session.top5CombinedFixPrompt || (await onGenerateTop5Prompt());
      await navigator.clipboard.writeText(promptText);
      setCopiedTop5(true);
      setTimeout(() => setCopiedTop5(false), 2000);
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Failed to generate combined fix prompt.');
    } finally {
      setLoadingTop5(false);
    }
  };

  const verdictColor =
    score?.verdict === 'Ready'
      ? 'bg-emerald-50 text-[#16A34A] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
      : score?.verdict === 'Ready with fixes'
      ? 'bg-amber-50 text-[#CA8A04] border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
      : 'bg-red-50 text-[#DC2626] border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50';

  return (
    <div className="p-3.5 space-y-4 overflow-y-auto h-full text-xs print:overflow-visible print:h-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onRetest}
            icon={<RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Re-test
          </Button>
          {findings.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!hasGeminiKey && !session.top5CombinedFixPrompt}
              loading={loadingTop5}
              onClick={handleCopyTop5}
              icon={
                copiedTop5 ? (
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.5} />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#3B5BDB]" strokeWidth={1.5} />
                )
              }
            >
              {copiedTop5 ? 'Copied top 5 prompt' : 'Copy top 5 fixes as one prompt'}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyMarkdown}
            icon={
              copiedMd ? (
                <Check className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.5} />
              ) : (
                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
              )
            }
          >
            {copiedMd ? 'Copied MD' : 'Markdown'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownloadJson}
            icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            JSON
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            icon={<Printer className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Print
          </Button>
        </div>
      </div>

      {promptError && (
        <div className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 text-[#DC2626] dark:text-red-400">
          {promptError}
        </div>
      )}

      {/* Readiness Score + Verdict */}
      {score && (
        <Card className="p-4 flex flex-col sm:flex-row items-center gap-4">
          <ScoreRing score={score.score} size={86} label="Readiness" />
          <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold ${verdictColor}`}
              >
                {score.verdict}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                {findings.length} unique finding{findings.length === 1 ? '' : 's'}
              </span>
            </div>

            {exec?.goNoGoReasoning && (
              <p dir="auto" className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {exec.goNoGoReasoning}
              </p>
            )}

            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 text-[10.5px] font-mono text-zinc-500">
              {score.deductions.critical > 0 && <span>Crit: -{score.deductions.critical}</span>}
              {score.deductions.high > 0 && <span>High: -{score.deductions.high}</span>}
              {score.deductions.medium > 0 && <span>Med: -{score.deductions.medium}</span>}
              {score.deductions.low > 0 && <span>Low: -{score.deductions.low}</span>}
              {score.deductions.a11yHigh > 0 && <span>A11y: -{score.deductions.a11yHigh}</span>}
              {score.deductions.layoutDevices > 0 && (
                <span>Layout: -{score.deductions.layoutDevices}</span>
              )}
              {score.deductions.consoleAndNetwork > 0 && (
                <span>Errors: -{score.deductions.consoleAndNetwork}</span>
              )}
              {score.deductions.personaFailures > 0 && (
                <span>Personas: -{score.deductions.personaFailures}</span>
              )}
              {score.deductions.lowPersonaRating > 0 && (
                <span>Rating &lt;3: -{score.deductions.lowPersonaRating}</span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Regression Comparison Card */}
      {regression && (
        <Card className="p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {regression.scoreDelta >= 0 ? (
                <TrendingUp className="w-4 h-4 text-[#16A34A]" strokeWidth={1.75} />
              ) : (
                <TrendingDown className="w-4 h-4 text-[#DC2626]" strokeWidth={1.75} />
              )}
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Regression vs Previous Run ({new Date(regression.previousDate).toLocaleDateString()})
              </h3>
            </div>
            <Badge
              status={
                regression.scoreDelta > 0
                  ? 'passed'
                  : regression.scoreDelta < 0
                  ? 'failed'
                  : 'stopped'
              }
              className="font-mono"
            >
              {regression.scoreDelta > 0
                ? `+${regression.scoreDelta}`
                : regression.scoreDelta}{' '}
              pts (was {regression.previousScore})
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
            <div className="p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="text-base font-bold text-[#16A34A]">{regression.fixed.length}</div>
              <div className="text-zinc-600 dark:text-zinc-400">Fixed</div>
            </div>
            <div className="p-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="text-base font-bold text-[#CA8A04]">
                {regression.stillFailing.length}
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">Still failing</div>
            </div>
            <div className="p-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
              <div className="text-base font-bold text-[#DC2626]">
                {regression.newFindings.length}
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">New</div>
            </div>
          </div>
        </Card>
      )}

      {/* Top 5 Priority Fixes */}
      {exec && exec.top5Fixes.length > 0 && (
        <Card className="p-4 space-y-2">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Top Priority Fixes
          </h3>
          <ol className="space-y-1.5 list-decimal list-inside">
            {exec.top5Fixes.map((fix, i) => (
              <li key={i} dir="auto" className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {fix.title}
                </strong>{' '}
                <span className="font-mono text-[11px] text-zinc-500">({fix.page})</span> —{' '}
                {fix.reason}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Findings Cards */}
      <div className="space-y-3">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Findings ({findings.length})
        </h3>

        {findings.length === 0 ? (
          <Card className="p-5 text-center text-zinc-500 dark:text-zinc-400">
            No issues reported in this session.
          </Card>
        ) : (
          findings.map((f) => {
            const shotUrl = f.shotId ? shots[f.shotId] : undefined;
            const isLoadingPrompt = loadingFindingId === f.id;
            const isCopied = copiedFindingId === f.id;

            return (
              <Card key={f.id} className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge severity={f.severity} />
                    <h4 dir="auto" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {f.title}
                    </h4>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!hasGeminiKey && !f.fixPrompt}
                    loading={isLoadingPrompt}
                    onClick={() => handleCopyFixPrompt(f)}
                    icon={
                      isCopied ? (
                        <Check className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.5} />
                      ) : (
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                      )
                    }
                  >
                    {isCopied ? 'Copied fix prompt' : 'Copy fix prompt'}
                  </Button>
                </div>

                <div className="text-[11px] font-mono text-zinc-500 truncate">{f.page}</div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-8 space-y-2">
                    <div>
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 block">
                        What happened
                      </span>
                      <p dir="auto" className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {f.whatHappened}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 block">
                        Why it likely happened
                      </span>
                      <p dir="auto" className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {f.whyItHappened}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 block">
                        Expected vs Actual
                      </span>
                      <p
                        dir="auto"
                        className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed"
                      >
                        {f.expectedVsActual}
                      </p>
                    </div>
                    {f.stepsToReproduce.length > 0 && (
                      <div>
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 block">
                          Steps to reproduce
                        </span>
                        <ol className="list-decimal list-inside text-zinc-600 dark:text-zinc-400">
                          {f.stepsToReproduce.map((st, idx) => (
                            <li key={idx} dir="auto">
                              {st}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {f.evidence && (
                      <div>
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 block">
                          Evidence
                        </span>
                        <pre className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[10.5px] text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                          {f.evidence}
                        </pre>
                      </div>
                    )}
                  </div>

                  {shotUrl && (
                    <div className="md:col-span-4">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                        Screenshot
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalShot({ src: shotUrl, title: f.title })}
                        className="w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:opacity-90 transition-opacity"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shotUrl}
                          alt={f.title}
                          className="w-full h-auto object-cover"
                        />
                      </button>
                    </div>
                  )}
                  {!shotUrl && f.shotId && (
                    <div className="md:col-span-4 flex items-center gap-1.5 text-zinc-400 text-[11px]">
                      <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Screenshot stored</span>
                    </div>
                  )}
                </div>

                {f.fixPrompt && (
                  <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 space-y-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#3B5BDB] block">
                      Generated AI Fix Prompt
                    </span>
                    <p className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                      {f.fixPrompt}
                    </p>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* What Was NOT Tested */}
      {score && score.notTested.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldOff className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              What Was NOT Tested
            </h3>
          </div>
          <ul className="list-disc list-inside space-y-1 text-zinc-600 dark:text-zinc-400">
            {score.notTested.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Card>
      )}

      <ScreenshotModal
        isOpen={!!modalShot}
        onClose={() => setModalShot(null)}
        screenshotUrl={modalShot?.src || null}
        title={modalShot?.title}
      />
    </div>
  );
}
