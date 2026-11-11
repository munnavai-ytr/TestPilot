'use client';

import React, { useState } from 'react';
import { Play, Globe, Sparkles, ChevronDown, ChevronRight, Lock, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { ApiError, RunnerSettings, TestMode } from '@/types/runner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ErrorBanner';

interface NewTestScreenProps {
  settings: RunnerSettings;
  onOpenSettings: () => void;
  onSubmit: (data: {
    url: string;
    command: string;
    mode: TestMode;
    credentials?: { email?: string; password?: string } | null;
  }) => void;
  isLoading: boolean;
  error: ApiError | null;
  onClearError: () => void;
  initialValues?: {
    url?: string;
    command?: string;
    mode?: TestMode;
    credentials?: { email?: string; password?: string } | null;
  };
}

const EXAMPLE_COMMANDS = [
  'Test login, signup and checkout flow',
  'Verify all navigation links, search bar, and 404 handling',
  'Check responsive mobile layout, form validations, and contact submit',
];

export function NewTestScreen({
  settings,
  onOpenSettings,
  onSubmit,
  isLoading,
  error,
  onClearError,
  initialValues,
}: NewTestScreenProps) {
  const [url, setUrl] = useState(initialValues?.url || '');
  const [command, setCommand] = useState(initialValues?.command || '');
  const [mode, setMode] = useState<TestMode>(initialValues?.mode || 'smoke');
  const [showCredentials, setShowCredentials] = useState(
    !!(initialValues?.credentials?.email || initialValues?.credentials?.password)
  );
  const [email, setEmail] = useState(initialValues?.credentials?.email || '');
  const [password, setPassword] = useState(initialValues?.credentials?.password || '');
  const [urlTouched, setUrlTouched] = useState(false);

  const hasRunnerUrl = !!settings.runnerUrl?.trim();
  const hasToken = !!settings.accessToken?.trim();
  const hasGeminiKey = !!settings.geminiApiKey?.trim();
  const isFullyConfigured = hasRunnerUrl && hasToken && hasGeminiKey;

  const missingItems: string[] = [];
  if (!hasRunnerUrl) missingItems.push('Runner URL');
  if (!hasToken) missingItems.push('Runner Access Token');
  if (!hasGeminiKey) missingItems.push('Gemini API Key');

  // Validate URL (must start with https://)
  const isUrlValid = url.trim().startsWith('https://') && url.trim().length > 8;
  const isCommandValid = command.trim().length > 0;
  const canSubmit = isFullyConfigured && isUrlValid && isCommandValid && !isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onClearError();

    onSubmit({
      url: url.trim(),
      command: command.trim(),
      mode,
      credentials:
        showCredentials && (email || password)
          ? {
              email: email.trim(),
              password: password.trim(),
            }
          : null,
    });
  };

  const handleSelectExample = (example: string) => {
    setCommand(example);
  };

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 px-4 space-y-6">
      {/* Page Title & Context */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          New QA Test Run
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Instruct your external autonomous QA runner to inspect and validate user journeys in a live browser.
        </p>
      </div>

      {/* Runner URL, Token & Gemini Key Empty State */}
      {!isFullyConfigured && (
        <Card className="p-8 text-center border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-700">
            <Settings className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Connect your Runner in Settings to start testing
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            TestPilot sends test instructions directly to your external Runner API. Testing requires your{' '}
            <strong className="text-zinc-700 dark:text-zinc-300 font-medium">Runner URL</strong>,{' '}
            <strong className="text-zinc-700 dark:text-zinc-300 font-medium">Access Token</strong>, and a{' '}
            <strong className="text-zinc-700 dark:text-zinc-300 font-medium">Gemini API Key</strong> (BYOK).
          </p>
          <div className="mt-5">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onOpenSettings}
              icon={<Settings className="w-4 h-4" strokeWidth={1.5} />}
            >
              Open Settings
            </Button>
          </div>
        </Card>
      )}

      {/* Loading Banner with 60-second wake up notice */}
      {isLoading && (
        <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-[#3B5BDB] shrink-0" strokeWidth={1.5} />
          <div>
            <span className="font-semibold block">Initiating Browser Runner</span>
            <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
              Waking up the Runner, this can take up to a minute
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && !isLoading && (
        <ErrorBanner
          error={error}
          onRetry={canSubmit ? () => handleSubmit({ preventDefault: () => {} } as any) : undefined}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* Main Test Creation Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* Website URL */}
          <div className="space-y-1.5">
            <label
              htmlFor="website-url"
              className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-200"
            >
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                <span>Target Website URL</span>
                <span className="text-red-500">*</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Requires https://</span>
            </label>

            <div className="relative">
              <input
                id="website-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  onClearError();
                }}
                onBlur={() => setUrlTouched(true)}
                className={`w-full px-3 py-2.5 rounded-lg border font-mono text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] transition-all ${
                  urlTouched && !isUrlValid && url.length > 0
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              />
            </div>

            {urlTouched && url.length > 0 && !url.startsWith('https://') && (
              <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                <span>Website URL must start with https:// for secure browser testing.</span>
              </p>
            )}
          </div>

          {/* Plain-Language QA Command */}
          <div className="space-y-2">
            <label
              htmlFor="test-command"
              className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-200"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#3B5BDB]" strokeWidth={1.5} />
                <span>Testing Command</span>
                <span className="text-red-500">*</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-normal">Natural language instruction</span>
            </label>

            <textarea
              id="test-command"
              rows={3}
              placeholder="e.g. Test login, signup and checkout flow"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                onClearError();
              }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] transition-all resize-y font-mono"
            />

            {/* Example Command Chips */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block font-medium">
                Example commands:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_COMMANDS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleSelectExample(example)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Test Mode Segmented Control: Smoke / User Flow / Full QA */}
          <div className="space-y-2">
            <label className="block font-semibold text-zinc-900 dark:text-zinc-200">
              Test Mode
            </label>

            <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setMode('smoke')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-all ${
                  mode === 'smoke'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Smoke
              </button>

              <button
                type="button"
                onClick={() => setMode('user_flow')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-all ${
                  mode === 'user_flow'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                User Flow
              </button>

              <button
                type="button"
                onClick={() => setMode('full_qa')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-all ${
                  mode === 'full_qa'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Full QA
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {mode === 'smoke' && 'Smoke mode: rapid baseline sanity check of critical paths (~1-2 min).'}
              {mode === 'user_flow' && 'User Flow mode: deep traversal of sequential journeys & multi-step forms.'}
              {mode === 'full_qa' && 'Full QA mode: comprehensive exploration, edge case discovery & responsive validation.'}
            </p>
          </div>

          {/* Optional Test Credentials: Email + Password */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="w-full flex items-center justify-between p-3 bg-zinc-50/60 dark:bg-zinc-800/40 hover:bg-zinc-100/60 transition-colors text-left font-medium text-zinc-800 dark:text-zinc-200"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                <span>Add login details</span>
                <span className="text-[11px] text-zinc-400 font-normal">(Optional)</span>
              </div>
              {showCredentials ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
              )}
            </button>

            {showCredentials && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                <div className="space-y-1">
                  <label htmlFor="test-email" className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                    Test User Email / Username
                  </label>
                  <input
                    id="test-email"
                    type="text"
                    placeholder="qa-tester@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="test-password" className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                    Test Password
                  </label>
                  <input
                    id="test-password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Missing credentials short helper line (Mandatory Prompt Requirement) */}
          {!isFullyConfigured && (
            <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-between gap-3 text-[11px] text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#CA8A04] shrink-0" strokeWidth={1.5} />
                <span>
                  Missing: <strong className="font-semibold">{missingItems.join(', ')}</strong>. Configure in Settings to enable run.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onOpenSettings}
                icon={<Settings className="w-3 h-3" strokeWidth={1.5} />}
              >
                Settings
              </Button>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {!isFullyConfigured
                ? `Requires ${missingItems.join(' & ')} in Settings`
                : !isUrlValid
                ? 'Enter valid https:// URL'
                : !isCommandValid
                ? 'Provide QA instructions'
                : 'Ready to launch'}
            </span>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!canSubmit}
              loading={isLoading}
              icon={<Play className="w-4 h-4 fill-white shrink-0" strokeWidth={1.5} />}
            >
              Run Test
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
