'use client';

import React from 'react';
import { Users, Star, Quote, AlertCircle, Lightbulb } from 'lucide-react';
import { PersonaAggregateSummary, PersonaFeedbackResult } from '@/lib/studio/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface StudioFeedbackProps {
  personaResults: PersonaFeedbackResult[];
  aggregate?: PersonaAggregateSummary | null;
}

export function StudioFeedback({ personaResults, aggregate }: StudioFeedbackProps) {
  if (personaResults.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
        <Users className="w-7 h-7 mx-auto text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
        <p className="font-medium text-zinc-700 dark:text-zinc-300">No virtual user feedback yet</p>
        <p className="text-[11px] max-w-xs mx-auto">
          Include Virtual Users (personas) in your test plan to see candid first-person feedback, usability friction clusters, and ratings.
        </p>
      </div>
    );
  }

  const avgRating =
    aggregate?.averageRating ??
    Number(
      (
        personaResults.reduce((sum, p) => sum + (p.rating || 0), 0) /
        Math.max(1, personaResults.length)
      ).toFixed(2)
    );

  return (
    <div className="p-3.5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Aggregate Cross-Persona Clusters */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#3B5BDB]" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Persona Insights ({personaResults.length} virtual user{personaResults.length === 1 ? '' : 's'})
            </h3>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono">
            <Star className="w-3.5 h-3.5 text-[#CA8A04] fill-[#CA8A04]" strokeWidth={1.5} />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {avgRating.toFixed(1)}
            </span>
            <span className="text-zinc-400">/ 5.0 avg</span>
          </div>
        </div>

        {aggregate && aggregate.clusters.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block">
              Shared Friction Points
            </span>
            <div className="space-y-1.5">
              {aggregate.clusters.map((cluster, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-start justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {cluster.theme}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {cluster.label || `${cluster.affectedCount} of ${cluster.totalPersonas} users got stuck here`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="neutral" className="font-mono">
                      {cluster.affectedCount}/{cluster.totalPersonas}
                    </Badge>
                    <Badge severity={cluster.severity} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aggregate && aggregate.topThemes.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block">
              Top Themes
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-zinc-700 dark:text-zinc-300">
              {aggregate.topThemes.slice(0, 5).map((theme, i) => (
                <li key={i}>{theme}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Individual Persona Cards */}
      <div className="space-y-3">
        {personaResults.map((p) => (
          <Card key={p.personaId} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {p.personaName}
                  </h4>
                  <Badge
                    status={
                      p.taskResult === 'success'
                        ? 'passed'
                        : p.taskResult === 'partial'
                        ? 'warning'
                        : 'failed'
                    }
                  >
                    {p.taskResult}
                  </Badge>
                </div>
                <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {p.deviceLabel} · {p.stepsTaken} steps · {p.wouldReturn ? 'Would return' : 'Would not return'}
                </div>
              </div>

              <div className="flex items-center gap-0.5" aria-label={`Rating ${p.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((starIdx) => (
                  <Star
                    key={starIdx}
                    className={`w-3.5 h-3.5 ${
                      starIdx <= p.rating
                        ? 'text-[#CA8A04] fill-[#CA8A04]'
                        : 'text-zinc-300 dark:text-zinc-700'
                    }`}
                    strokeWidth={1.5}
                  />
                ))}
              </div>
            </div>

            <p dir="auto" className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {p.summary}
            </p>

            {p.confusingMoments.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <Quote className="w-3 h-3" strokeWidth={1.5} />
                  Quotes
                </span>
                <div className="space-y-1">
                  {p.confusingMoments.map((q, i) => (
                    <blockquote
                      key={i}
                      dir="auto"
                      className="pl-2.5 border-l-2 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 italic"
                    >
                      &ldquo;{q}&rdquo;
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {p.frictionPoints.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" strokeWidth={1.5} />
                  Friction Points
                </span>
                <div className="space-y-1">
                  {p.frictionPoints.map((fp, i) => (
                    <div
                      key={i}
                      className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 block">
                          {fp.what}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">{fp.where}</span>
                      </div>
                      <Badge severity={fp.severity} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {p.suggestions.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" strokeWidth={1.5} />
                  Suggestions
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-600 dark:text-zinc-400">
                  {p.suggestions.map((s, i) => (
                    <li key={i} dir="auto">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
