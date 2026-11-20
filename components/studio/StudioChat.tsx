'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  ArrowDown,
  Check,
  Clock,
  KeyRound,
  Plus,
  ShieldAlert,
  Play,
  Edit3,
  Loader2,
} from 'lucide-react';
import { MISSION_CHIPS } from '@/lib/studio/prompts';
import { STUDIO_PERSONAS } from '@/lib/studio/personas';
import { createStudioId, getStudioVault, saveStudioVault } from '@/lib/studio/store';
import {
  StudioChatMessage,
  StudioQuestionCard,
  StudioTestPlan,
  StudioVaultAccount,
} from '@/lib/studio/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const FREE_CHECK_IDS = new Set(['smoke', 'devices', 'a11y', 'perf', 'seo', 'links']);

interface StudioChatProps {
  messages: StudioChatMessage[];
  isLeadThinking: boolean;
  isRunning: boolean;
  quotaWaitMessage: string | null;
  activeQuestion: StudioQuestionCard | null;
  questionRemainingSec: number;
  hasGeminiKey: boolean;
  onOpenSettings: () => void;
  onSendMessage: (text: string) => void;
  onApprovePlan: (plan: StudioTestPlan) => void;
  onRequestPlanChange: (plan: StudioTestPlan) => void;
  onAnswerQuestion: (payload: { answer?: string; accountId?: string }) => void;
}

export function StudioChat({
  messages,
  isLeadThinking,
  isRunning,
  quotaWaitMessage,
  activeQuestion,
  questionRemainingSec,
  hasGeminiKey,
  onOpenSettings,
  onSendMessage,
  onApprovePlan,
  onRequestPlanChange,
  onAnswerQuestion,
}: StudioChatProps) {
  const [input, setInput] = useState('');
  const [planEdits, setPlanEdits] = useState<Record<string, StudioTestPlan>>({});
  const [questionText, setQuestionText] = useState('');
  const [vaultAccounts, setVaultAccounts] = useState<StudioVaultAccount[]>(() => getStudioVault());
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [acctLabel, setAcctLabel] = useState('');
  const [acctEmail, setAcctEmail] = useState('');
  const [acctPassword, setAcctPassword] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance <= 120;
    isNearBottomRef.current = near;
    setShowJumpToLatest(!near);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isLeadThinking, quotaWaitMessage, activeQuestion?.id]);

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getEditablePlan = (original: StudioTestPlan): StudioTestPlan => {
    return planEdits[original.id] || original;
  };

  const togglePlanCheck = (plan: StudioTestPlan, checkIndex: number) => {
    if (plan.status !== 'pending') return;
    const current = getEditablePlan(plan);
    const nextChecks = current.checks.map((c, idx) =>
      idx === checkIndex ? { ...c, enabled: !c.enabled } : c
    );
    setPlanEdits((p) => ({ ...p, [plan.id]: { ...current, checks: nextChecks } }));
  };

  const togglePersonaInPlan = (plan: StudioTestPlan, checkIndex: number, personaId: string) => {
    if (plan.status !== 'pending') return;
    const current = getEditablePlan(plan);
    const nextChecks = current.checks.map((c, idx) => {
      if (idx !== checkIndex) return c;
      const existing = c.personaIds || [];
      const updated = existing.includes(personaId)
        ? existing.filter((id) => id !== personaId)
        : [...existing, personaId];
      return { ...c, personaIds: updated };
    });
    setPlanEdits((p) => ({ ...p, [plan.id]: { ...current, checks: nextChecks } }));
  };

  const updateCheckGoal = (plan: StudioTestPlan, checkIndex: number, goal: string) => {
    if (plan.status !== 'pending') return;
    const current = getEditablePlan(plan);
    const nextChecks = current.checks.map((c, idx) => (idx === checkIndex ? { ...c, goal } : c));
    setPlanEdits((p) => ({ ...p, [plan.id]: { ...current, checks: nextChecks } }));
  };

  const handleAddInlineVaultAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acctEmail.trim() && !acctPassword.trim()) return;
    const created: StudioVaultAccount = {
      id: createStudioId('acct'),
      label: acctLabel.trim() || acctEmail.trim() || 'Test user',
      email: acctEmail.trim(),
      password: acctPassword,
      createdAt: new Date().toISOString(),
    };
    const next = [created, ...vaultAccounts];
    setVaultAccounts(next);
    saveStudioVault(next);
    setAcctLabel('');
    setAcctEmail('');
    setAcctPassword('');
    setShowAddAccount(false);
    onAnswerQuestion({ accountId: created.id });
  };

  // Find last lead message index for quick replies
  let lastLeadMsgIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'lead') {
      lastLeadMsgIndex = i;
      break;
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative bg-white dark:bg-zinc-900">
      {/* Scrollable Chat History */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-xs"
      >
        {/* Empty State with 5 Mission Chips */}
        {messages.length === 0 && (
          <div className="py-5 px-2 space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#3B5BDB]/10 border border-[#3B5BDB]/20 flex items-center justify-center text-[#3B5BDB] shrink-0">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
              </div>
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-1.5 max-w-[90%]">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Hi, I am TestPilot Lead.
                </p>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Tell me what your app does and which journeys matter most, or pick a mission below. I will propose a test plan for your approval before running anything.
                </p>
              </div>
            </div>

            {!hasGeminiKey && (
              <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 flex items-center justify-between gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                <span>Add your Gemini API key in Settings to chat with the Test Lead.</span>
                <Button size="sm" variant="outline" onClick={onOpenSettings}>
                  Settings
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">
                Start with a mission:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MISSION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={!hasGeminiKey || isLeadThinking}
                    onClick={() => onSendMessage(chip)}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200 hover:border-[#3B5BDB]/60 hover:text-[#3B5BDB] dark:hover:text-blue-400 transition-colors font-medium text-[11.5px] disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          if (msg.role === 'system') {
            return (
              <div key={msg.id} className="flex justify-center py-0.5">
                <span
                  dir="auto"
                  className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-800 rounded-md px-2.5 py-1 text-center [overflow-wrap:anywhere] max-w-[92%]"
                >
                  {msg.text}
                </span>
              </div>
            );
          }

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div
                  dir="auto"
                  className="max-w-[85%] rounded-xl px-3 py-2 bg-[#3B5BDB] text-white text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
                >
                  {msg.text}
                </div>
              </div>
            );
          }

          // Lead message
          const plan = msg.plan ? getEditablePlan(msg.plan) : null;
          const totalReqs = plan
            ? plan.checks
                .filter((c) => c.enabled)
                .reduce(
                  (s, c) => s + (FREE_CHECK_IDS.has(c.id) ? 0 : c.estimatedRequests || 0),
                  0
                )
            : 0;
          const totalMins = plan
            ? plan.checks
                .filter((c) => c.enabled)
                .reduce((s, c) => s + (c.estimatedMinutes || 0), 0)
            : 0;

          const showQuickReplies =
            idx === lastLeadMsgIndex &&
            !isRunning &&
            !isLeadThinking &&
            Array.isArray(msg.quickReplies) &&
            msg.quickReplies.length > 0;

          return (
            <div key={msg.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-[#3B5BDB]/10 border border-[#3B5BDB]/20 flex items-center justify-center text-[#3B5BDB] shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3" strokeWidth={1.75} />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  {msg.text && (
                    <div
                      dir="auto"
                      className="inline-block max-w-[95%] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* Plan Card */}
                  {plan && (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4
                            dir="auto"
                            className="text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                          >
                            {plan.title}
                          </h4>
                          <p
                            dir="auto"
                            className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed"
                          >
                            {plan.summary}
                          </p>
                        </div>
                        <Badge
                          status={
                            plan.status === 'completed'
                              ? 'completed'
                              : plan.status === 'running' || plan.status === 'approved'
                              ? 'running'
                              : 'stopped'
                          }
                        >
                          {plan.status}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {plan.checks.map((chk, chkIdx) => {
                          const isFree = FREE_CHECK_IDS.has(chk.id);
                          const displayReqs = isFree ? 0 : chk.estimatedRequests;
                          return (
                            <div
                              key={`${chk.id}_${chkIdx}`}
                              className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-1.5"
                            >
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={chk.enabled}
                                  disabled={plan.status !== 'pending'}
                                  onChange={() => togglePlanCheck(msg.plan!, chkIdx)}
                                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-[#3B5BDB] focus:ring-[#3B5BDB]"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                      {chk.title}
                                    </span>
                                    <span className="text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400">
                                      {displayReqs === 0
                                        ? '0 Gemini reqs (free)'
                                        : `~${displayReqs} reqs`}{' '}
                                      · ~{chk.estimatedMinutes}m
                                    </span>
                                  </div>
                                  <p
                                    dir="auto"
                                    className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5"
                                  >
                                    {chk.why}
                                  </p>
                                </div>
                              </label>

                              {/* Editable goal for explore / forms / personas */}
                              {chk.enabled &&
                                (chk.id === 'explore' ||
                                  chk.id === 'forms' ||
                                  chk.id === 'personas') && (
                                  <input
                                    type="text"
                                    disabled={plan.status !== 'pending'}
                                    value={chk.goal || ''}
                                    placeholder="Goal for this check..."
                                    onChange={(e) =>
                                      updateCheckGoal(msg.plan!, chkIdx, e.target.value)
                                    }
                                    className="w-full px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#3B5BDB]"
                                  />
                                )}

                              {/* Persona selector chips */}
                              {chk.enabled && chk.id === 'personas' && (
                                <div className="pt-1 flex flex-wrap gap-1">
                                  {STUDIO_PERSONAS.map((persona) => {
                                    const active = (chk.personaIds || []).includes(persona.id);
                                    return (
                                      <button
                                        key={persona.id}
                                        type="button"
                                        disabled={plan.status !== 'pending'}
                                        onClick={() =>
                                          togglePersonaInPlan(msg.plan!, chkIdx, persona.id)
                                        }
                                        className={`px-2 py-0.5 rounded border text-[10.5px] transition-colors ${
                                          active
                                            ? 'border-[#3B5BDB] bg-[#3B5BDB]/10 text-[#3B5BDB] dark:text-blue-300 font-medium'
                                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                                        }`}
                                      >
                                        {persona.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {plan.notCovered && plan.notCovered.length > 0 && (
                        <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mb-0.5">
                            Not covered in this run:
                          </span>
                          <ul className="list-disc list-inside space-y-0.5">
                            {plan.notCovered.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          Est: ~{totalReqs} Gemini reqs · ~{Math.max(1, Math.round(totalMins))} min
                        </span>

                        {plan.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onRequestPlanChange(plan)}
                              icon={<Edit3 className="w-3 h-3" strokeWidth={1.5} />}
                            >
                              Change
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              disabled={!plan.checks.some((c) => c.enabled)}
                              onClick={() => onApprovePlan(plan)}
                              icon={<Play className="w-3 h-3 fill-white" strokeWidth={1.5} />}
                            >
                              Approve and start
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Reply Chips */}
                  {showQuickReplies && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {msg.quickReplies!.slice(0, 4).map((qr) => (
                        <button
                          key={qr}
                          type="button"
                          onClick={() => onSendMessage(qr)}
                          className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-[#3B5BDB] hover:text-[#3B5BDB] transition-colors"
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Active Interactive Question Card */}
        {activeQuestion && !activeQuestion.answered && (
          <div className="rounded-xl border border-[#3B5BDB]/40 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {activeQuestion.kind === 'destructive' ? (
                  <ShieldAlert className="w-4 h-4 text-[#CA8A04] shrink-0 mt-0.5" strokeWidth={1.5} />
                ) : activeQuestion.kind === 'credentials' ? (
                  <KeyRound className="w-4 h-4 text-[#3B5BDB] shrink-0 mt-0.5" strokeWidth={1.5} />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#3B5BDB] shrink-0 mt-0.5" strokeWidth={1.5} />
                )}
                <p
                  dir="auto"
                  className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed"
                >
                  {activeQuestion.question}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                {questionRemainingSec}s
              </span>
            </div>

            {activeQuestion.kind === 'credentials' ? (
              <div className="space-y-2">
                {vaultAccounts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {vaultAccounts.map((acct) => (
                      <Button
                        key={acct.id}
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onAnswerQuestion({ accountId: acct.id })}
                        icon={<Check className="w-3 h-3 text-[#16A34A]" strokeWidth={1.5} />}
                      >
                        Use {acct.label} ({acct.email})
                      </Button>
                    ))}
                  </div>
                )}

                {!showAddAccount ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddAccount(true)}
                      icon={<Plus className="w-3 h-3" strokeWidth={1.5} />}
                    >
                      Add test account to vault
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onAnswerQuestion({ answer: 'Continue without login' })}
                    >
                      Skip login
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleAddInlineVaultAccount}
                    className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2"
                  >
                    <p className="text-[10.5px] text-zinc-500">
                      Saved locally in vault only. Never sent to AI chat.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        placeholder="Label"
                        value={acctLabel}
                        onChange={(e) => setAcctLabel(e.target.value)}
                        className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Email"
                        value={acctEmail}
                        onChange={(e) => setAcctEmail(e.target.value)}
                        className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-xs"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={acctPassword}
                        onChange={(e) => setAcctPassword(e.target.value)}
                        className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddAccount(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" variant="primary">
                        Save & Use
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : activeQuestion.options && activeQuestion.options.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeQuestion.options.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    size="sm"
                    variant={opt === 'Allow once' ? 'primary' : 'secondary'}
                    onClick={() => onAnswerQuestion({ answer: opt })}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && questionText.trim()) {
                      onAnswerQuestion({ answer: questionText.trim() });
                      setQuestionText('');
                    }
                  }}
                  placeholder="Type your answer..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={!questionText.trim()}
                  onClick={() => {
                    onAnswerQuestion({ answer: questionText.trim() });
                    setQuestionText('');
                  }}
                >
                  Reply
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Quota Wait Banner */}
        {quotaWaitMessage && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-800 dark:text-amber-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" strokeWidth={1.5} />
            <span>{quotaWaitMessage}</span>
          </div>
        )}

        {/* Typing Indicator */}
        {isLeadThinking && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#3B5BDB]/10 border border-[#3B5BDB]/20 flex items-center justify-center text-[#3B5BDB] shrink-0">
              <Sparkles className="w-3 h-3" strokeWidth={1.75} />
            </div>
            <div className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center gap-1.5 text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 motion-safe:animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 motion-safe:animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 motion-safe:animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Jump to latest button */}
      {showJumpToLatest && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-16 right-4 z-20 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-md text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <ArrowDown className="w-3.5 h-3.5 text-[#3B5BDB]" strokeWidth={1.75} />
          <span>Jump to latest</span>
        </button>
      )}

      {/* Message Input Box */}
      <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasGeminiKey}
            placeholder={
              isRunning
                ? 'Steer the agent on the next step (Enter sends)...'
                : 'Message TestPilot Lead (Enter sends, Shift+Enter newline)...'
            }
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] resize-none max-h-28"
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!input.trim() || !hasGeminiKey || (!isRunning && isLeadThinking)}
            onClick={handleSend}
            aria-label="Send message"
            icon={<Send className="w-3.5 h-3.5" strokeWidth={1.75} />}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
