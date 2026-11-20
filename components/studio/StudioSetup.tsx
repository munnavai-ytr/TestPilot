'use client';

import React, { useState } from 'react';
import {
  FlaskConical,
  Globe,
  ShieldAlert,
  Copy,
  Check,
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Smartphone,
  Sliders,
  Sparkles,
  Settings,
  AlertCircle,
  ExternalLink,
  History,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  DEVICE_PRESETS,
  addRecentStudioUrl,
  createStudioId,
  getRecentStudioUrls,
  getStudioVault,
  removeRecentStudioUrl,
  saveStudioVault,
  validateStudioAppUrl,
} from '@/lib/studio/store';
import { StudioSession, StudioVaultAccount } from '@/lib/studio/types';
import { RunnerSettings } from '@/types/runner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface StudioSetupProps {
  settings: RunnerSettings;
  onOpenSettings: () => void;
  onOpenStudioSettings: () => void;
  onLaunchSession: (config: {
    appUrl: string;
    appOrigin: string;
    deviceId: string;
    width: number;
    height: number;
  }) => void;
  sessions: StudioSession[];
  isLoadingSessions: boolean;
  onOpenPastSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAllSessions: () => void;
  initialUrl?: string;
}

export function buildSdkScriptTag(origin: string): string {
  return `<script src="https://cdn.jsdelivr.net/gh/munnavai-ytr/testpilot-runner@main/sdk/testpilot-sdk.js" data-tp-origin="${origin}"></script>`;
}

export function buildSdkInstallPrompt(origin: string): string {
  const tag = buildSdkScriptTag(origin);
  return `Add this script tag as the very first element inside <head> of the app's root layout (or index.html). Do not change anything else: ${tag}`;
}

export function StudioSetup({
  settings,
  onOpenSettings,
  onOpenStudioSettings,
  onLaunchSession,
  sessions,
  isLoadingSessions,
  onOpenPastSession,
  onDeleteSession,
  onClearAllSessions,
  initialUrl = '',
}: StudioSetupProps) {
  const [appUrl, setAppUrl] = useState(initialUrl);
  const [urlTouched, setUrlTouched] = useState(false);
  const [recentUrls, setRecentUrls] = useState<string[]>(() => getRecentStudioUrls());

  const [deviceId, setDeviceId] = useState<string>('iphone_14');
  const [customWidth, setCustomWidth] = useState<number>(390);
  const [customHeight, setCustomHeight] = useState<number>(844);
  const [stagingChecked, setStagingChecked] = useState<boolean>(false);

  // Vault state
  const [vault, setVault] = useState<StudioVaultAccount[]>(() => getStudioVault());
  const [showVault, setShowVault] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  // Copy states
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://testpilot.app';
  const scriptTag = buildSdkScriptTag(origin);
  const installPrompt = buildSdkInstallPrompt(origin);

  const urlCheck = validateStudioAppUrl(appUrl);
  const canLaunch = urlCheck.valid && stagingChecked;
  const hasGeminiKey = !!settings.geminiApiKey?.trim();

  const selectedPreset =
    DEVICE_PRESETS.find((d) => d.id === deviceId) || DEVICE_PRESETS[1];
  const resolvedWidth = deviceId === 'custom' ? Math.max(240, customWidth || 390) : selectedPreset.width;
  const resolvedHeight = deviceId === 'custom' ? Math.max(320, customHeight || 844) : selectedPreset.height;

  const handleCopy = async (text: string, which: 'script' | 'prompt') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'script') {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 1800);
      } else {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 1800);
      }
    } catch {
      // ignore clipboard errors
    }
  };

  const handleAddVaultAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() && !newPassword.trim()) return;
    const entry: StudioVaultAccount = {
      id: createStudioId('acct'),
      label: newLabel.trim() || newEmail.trim() || 'Test account',
      email: newEmail.trim(),
      password: newPassword,
      createdAt: new Date().toISOString(),
    };
    const updated = [entry, ...vault];
    setVault(updated);
    saveStudioVault(updated);
    setNewLabel('');
    setNewEmail('');
    setNewPassword('');
    setShowNewPassword(false);
  };

  const handleDeleteVaultAccount = (id: string) => {
    const updated = vault.filter((a) => a.id !== id);
    setVault(updated);
    saveStudioVault(updated);
  };

  const handleLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlTouched(true);
    if (!canLaunch || !urlCheck.normalized || !urlCheck.origin) return;
    const updatedRecent = addRecentStudioUrl(urlCheck.normalized);
    setRecentUrls(updatedRecent);
    onLaunchSession({
      appUrl: urlCheck.normalized,
      appOrigin: urlCheck.origin,
      deviceId,
      width: resolvedWidth,
      height: resolvedHeight,
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-7 px-4 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#3B5BDB]" strokeWidth={1.75} />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              TestPilot Studio
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Open your staging app inside an interactive browser stage with an AI Test Lead, automatic audits, virtual users, and readiness reports.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onOpenStudioSettings}
            icon={<Sliders className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Studio Settings
          </Button>
        </div>
      </div>

      {/* Gemini Key Reminder */}
      {!hasGeminiKey && (
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
            <Sparkles className="w-4 h-4 text-[#CA8A04] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-semibold">Gemini API key not configured</p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                You can open the stage and run free automatic audits anytime, or add your Gemini API key in Settings for AI Test Lead, autonomous exploration, and personas.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            icon={<Settings className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Open Settings
          </Button>
        </div>
      )}

      {/* Staging Safety Notice */}
      <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/70 flex items-start gap-2.5 text-xs">
        <ShieldAlert className="w-4 h-4 text-[#CA8A04] shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-[11.5px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Staging & test copies only:</strong>{' '}
          Studio drives your app like a real user and triggers clicks, form submissions, and virtual-user flows. Always test a staging or preview copy rather than live customer data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Launch Form */}
        <Card className="lg:col-span-7 p-5">
          <form onSubmit={handleLaunch} className="space-y-5 text-xs">
            {/* App URL */}
            <div className="space-y-1.5">
              <label
                htmlFor="studio-app-url"
                className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100"
              >
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                  App URL <span className="text-red-500">*</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-400">https:// only</span>
              </label>

              <input
                id="studio-app-url"
                type="url"
                placeholder="https://staging.your-app.com"
                value={appUrl}
                onChange={(e) => {
                  setAppUrl(e.target.value);
                  if (!urlTouched && e.target.value.length > 5) setUrlTouched(true);
                }}
                onBlur={() => setUrlTouched(true)}
                className={`w-full px-3 py-2.5 rounded-lg border font-mono text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] transition-all ${
                  urlTouched && !urlCheck.valid && appUrl.trim().length > 0
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              />

              {urlTouched && !urlCheck.valid && appUrl.trim().length > 0 && (
                <p
                  role="alert"
                  className="text-[11px] text-[#DC2626] dark:text-red-400 flex items-start gap-1.5 pt-0.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>{urlCheck.error}</span>
                </p>
              )}

              {/* Recent URLs */}
              {recentUrls.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                    Recent apps:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentUrls.map((recent) => (
                      <div
                        key={recent}
                        className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-[11px] font-mono max-w-full"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setAppUrl(recent);
                            setUrlTouched(true);
                          }}
                          className="px-2 py-1 text-zinc-700 dark:text-zinc-300 hover:text-[#3B5BDB] truncate max-w-[230px]"
                          title={recent}
                        >
                          {recent.replace(/^https:\/\//, '')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecentUrls(removeRecentStudioUrl(recent))}
                          aria-label={`Remove ${recent} from recent URLs`}
                          className="pr-1.5 pl-0.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          <X className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Device Preset */}
            <div className="space-y-2">
              <label
                htmlFor="studio-device"
                className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100"
              >
                <Smartphone className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                Device Viewport
              </label>

              <select
                id="studio-device"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
              >
                {DEVICE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>

              {deviceId === 'custom' && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label
                      htmlFor="studio-custom-w"
                      className="text-[11px] text-zinc-500 dark:text-zinc-400 block mb-1"
                    >
                      Width (px)
                    </label>
                    <input
                      id="studio-custom-w"
                      type="number"
                      min={240}
                      max={2560}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value) || 390)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="studio-custom-h"
                      className="text-[11px] text-zinc-500 dark:text-zinc-400 block mb-1"
                    >
                      Height (px)
                    </label>
                    <input
                      id="studio-custom-h"
                      type="number"
                      min={320}
                      max={2560}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value) || 844)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional Test Accounts Vault */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowVault((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Test accounts vault
                  </span>
                  <span className="text-[11px] text-zinc-400 font-normal">
                    ({vault.length} saved, optional)
                  </span>
                </div>
                <span className="text-[11px] text-[#3B5BDB] font-medium">
                  {showVault ? 'Hide' : 'Manage'}
                </span>
              </button>

              {showVault && (
                <div className="p-3.5 space-y-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Use test accounts only. Passwords are never sent to the AI or to any server.
                  </p>

                  {vault.length > 0 && (
                    <div className="space-y-2">
                      {vault.map((acct) => {
                        const revealed = !!revealedIds[acct.id];
                        return (
                          <div
                            key={acct.id}
                            className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {acct.label}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                                {acct.email}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-400">
                                {revealed ? acct.password : '••••••••'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedIds((p) => ({ ...p, [acct.id]: !p[acct.id] }))
                                }
                                aria-label={revealed ? 'Hide password' : 'Show password'}
                                className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                {revealed ? (
                                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVaultAccount(acct.id)}
                                aria-label={`Delete ${acct.label}`}
                                className="p-1.5 rounded text-zinc-400 hover:text-[#DC2626]"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add vault account inline fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Label (e.g. Member)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                    />
                    <input
                      type="text"
                      placeholder="test@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                    />
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                        ) : (
                          <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleAddVaultAccount}
                      disabled={!newEmail.trim() && !newPassword.trim()}
                      icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    >
                      Add to vault
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Required Staging Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 cursor-pointer">
              <input
                type="checkbox"
                checked={stagingChecked}
                onChange={(e) => setStagingChecked(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-[#3B5BDB] focus:ring-[#3B5BDB]"
              />
              <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                I am testing a staging or test copy, not real customer data
              </span>
            </label>

            {/* Submit */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {!urlCheck.valid
                  ? 'Enter a valid https:// app URL'
                  : !stagingChecked
                  ? 'Confirm the staging checkbox to continue'
                  : `${resolvedWidth}x${resolvedHeight} viewport ready`}
              </span>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!canLaunch}
                icon={<ArrowRight className="w-4 h-4" strokeWidth={1.75} />}
              >
                Open app in Studio
              </Button>
            </div>
          </form>
        </Card>

        {/* Right: Connect your app SDK Card */}
        <Card className="lg:col-span-5 p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Connect your app
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              The lightweight TestPilot SDK lets Studio inspect elements, highlight clicks, run audits, and isolate sessions using a pairing token.
            </p>
          </div>

          <ol className="space-y-2 text-[11.5px] text-zinc-700 dark:text-zinc-300 list-decimal list-inside">
            <li>Copy the script tag or AI builder install prompt below.</li>
            <li>
              Paste it as the very first element inside <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">&lt;head&gt;</code> of your staging app.
            </li>
            <li>Deploy or refresh your staging URL, then click &ldquo;Open app in Studio&rdquo;.</li>
          </ol>

          <pre className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-[10.5px] text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all">
            {scriptTag}
          </pre>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(scriptTag, 'script')}
              icon={
                copiedScript ? (
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.75} />
                ) : (
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                )
              }
              className="w-full justify-center"
            >
              {copiedScript ? 'Copied script tag' : 'Copy script tag'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy(installPrompt, 'prompt')}
              icon={
                copiedPrompt ? (
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.75} />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#3B5BDB]" strokeWidth={1.5} />
                )
              }
              className="w-full justify-center"
            >
              {copiedPrompt ? 'Copied install prompt' : 'Copy install prompt for my AI builder'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Studio Saved Sessions History */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Recent Studio Sessions
            </h2>
          </div>
          {sessions.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClearHistory ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-zinc-500 text-[11px]">Delete all?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setConfirmClearHistory(false);
                      onClearAllSessions();
                    }}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmClearHistory(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClearHistory(true)}
                  icon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}
        </div>

        {isLoadingSessions ? (
          <div className="space-y-2">
            <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
            <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
            No saved Studio sessions yet. Open an app above to start your first interactive QA session.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-3 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[280px]">
                      {s.appUrl}
                    </span>
                    <Badge
                      status={
                        s.status === 'completed'
                          ? 'completed'
                          : s.status === 'stopped'
                          ? 'stopped'
                          : 'running'
                      }
                    >
                      {s.status}
                    </Badge>
                    {s.scoreBreakdown && (
                      <Badge variant="neutral" className="font-mono">
                        {s.scoreBreakdown.score}/100 ({s.scoreBreakdown.verdict})
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-3 flex-wrap">
                    <span>{new Date(s.createdAt).toLocaleString()}</span>
                    <span>{s.steps.length} steps</span>
                    <span>{s.personaResults.length} personas</span>
                    <span>{s.geminiRequestsUsed} Gemini calls</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenPastSession(s.id)}
                    icon={<ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  >
                    Open
                  </Button>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(s.id)}
                    aria-label={`Delete session for ${s.appUrl}`}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-[#DC2626] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
