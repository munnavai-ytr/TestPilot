'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle, Link2, Key, Sparkles, Activity } from 'lucide-react';
import { RunnerSettings } from '@/types/runner';
import { testRunnerConnection } from '@/lib/runner-api';
import { Drawer } from './ui/Drawer';
import { Button } from './ui/Button';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RunnerSettings;
  onSave: (newSettings: RunnerSettings) => void;
}

function SettingsDrawerContent({
  settings,
  onSave,
  onClose,
}: {
  settings: RunnerSettings;
  onSave: (newSettings: RunnerSettings) => void;
  onClose: () => void;
}) {
  const [runnerUrl, setRunnerUrl] = useState(settings.runnerUrl);
  const [accessToken, setAccessToken] = useState(settings.accessToken);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [showToken, setShowToken] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testRunnerConnection({ runnerUrl, accessToken, geminiApiKey });
      setTestResult(res);
    } catch {
      setTestResult({
        ok: false,
        message: 'Could not connect. Please check URL and network access.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ runnerUrl, accessToken, geminiApiKey });
    setHasSaved(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  return (
    <>
      <form id="settings-form" onSubmit={handleSave} className="space-y-5 text-xs">
        {/* Runner URL */}
        <div className="space-y-1.5">
          <label
            htmlFor="runner-url"
            className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-200"
          >
            <Link2 className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
            <span>Runner API URL</span>
            <span className="text-red-500">*</span>
          </label>
          <input
            id="runner-url"
            type="text"
            required
            placeholder="https://runner.example.com"
            value={runnerUrl}
            onChange={(e) => {
              setRunnerUrl(e.target.value);
              setTestResult(null);
            }}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all"
          />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            The base URL of your external Runner API hosting the headless QA agent.
          </p>
        </div>

        {/* Runner Access Token */}
        <div className="space-y-1.5">
          <label
            htmlFor="access-token"
            className="flex items-center justify-between font-medium text-zinc-900 dark:text-zinc-200"
          >
            <div className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
              <span>Runner Access Token</span>
              <span className="text-red-500">*</span>
            </div>
            <span className="text-[11px] text-zinc-400 font-normal">Required for runner</span>
          </label>

          <div className="relative">
            <input
              id="access-token"
              type={showToken ? 'text' : 'password'}
              placeholder="Bearer token secret"
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                setTestResult(null);
              }}
              className="w-full pl-3 pr-10 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? (
                <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Sent in the <code className="font-mono">Authorization: Bearer &lt;TOKEN&gt;</code> header.
          </p>
        </div>

        {/* Gemini API Key (BYOK) */}
        <div className="space-y-1.5">
          <label
            htmlFor="gemini-key"
            className="flex items-center justify-between font-medium text-zinc-900 dark:text-zinc-200"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#3B5BDB]" strokeWidth={1.5} />
              <span>Gemini API Key</span>
              <span className="text-red-500">*</span>
            </div>
            <span className="text-[11px] text-zinc-400 font-normal">BYOK</span>
          </label>

          <div className="relative">
            <input
              id="gemini-key"
              type={showGeminiKey ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={geminiApiKey}
              onChange={(e) => {
                setGeminiApiKey(e.target.value);
                setTestResult(null);
              }}
              className="w-full pl-3 pr-10 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowGeminiKey(!showGeminiKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label={showGeminiKey ? 'Hide key' : 'Show key'}
            >
              {showGeminiKey ? (
                <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Your own key. Create one for free in{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B5BDB] underline hover:text-[#324ec0]"
            >
              Google AI Studio
            </a>
            . It is stored only in this browser and sent to your Runner only to run your tests.
          </p>
        </div>

        {/* Test Connection Output */}
        {testResult && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              testResult.ok
                ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                : 'border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 text-red-800 dark:text-red-300'
            }`}
          >
            {testResult.ok ? (
              <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" strokeWidth={1.5} />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" strokeWidth={1.5} />
            )}
            <div className="flex-1">
              <span className="font-semibold block">
                {testResult.ok ? 'Connection Verified' : 'Connection Failed'}
              </span>
              <p className="mt-0.5 leading-relaxed">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Runner API Contract Reference */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 text-xs uppercase tracking-wider text-[11px]">
            API Contract Reference
          </h4>
          <div className="space-y-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-[#3B5BDB] font-semibold">POST</span>
              <span>/api/runs (Header: X-Gemini-Key)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#16A34A] font-semibold">GET</span>
              <span>/api/runs/:runId</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#EA580C] font-semibold">POST</span>
              <span>/api/runs/:runId/stop</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            All requests must include CORS headers (<code className="font-mono">Access-Control-Allow-Origin: *</code>) to allow direct browser client calls.
          </p>
        </div>
      </form>

      {/* Drawer footer content rendered below via portal / drawer */}
      <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleTestConnection}
          loading={isTesting}
          icon={<Activity className="w-3.5 h-3.5" strokeWidth={1.5} />}
        >
          Test Connection
        </Button>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            icon={hasSaved ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : undefined}
          >
            {hasSaved ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </>
  );
}

export function SettingsDrawer({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsDrawerProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Runner Settings"
      description="Configure your external QA execution runner API endpoint, token, and Gemini key."
    >
      {isOpen && (
        <SettingsDrawerContent
          settings={settings}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
}
