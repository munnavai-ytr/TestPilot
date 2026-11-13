'use client';

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import { RunnerSettings } from '@/types/runner';
import { Drawer } from './ui/Drawer';
import { Button } from './ui/Button';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RunnerSettings;
  onSave: (newSettings: RunnerSettings) => void;
}

const EXCLUDED_MODEL_SUBSTRINGS = [
  'lite',
  'image',
  'tts',
  'live',
  'audio',
  'embedding',
  'imagen',
  'robotics',
  'computer-use',
  'native',
  'exp',
  '8b',
  'learnlm',
];

function parseModelVersion(id: string): { major: number; minor: number } {
  const match = id.match(/gemini-(\d+)(?:\.(\d+))?/i);
  if (!match) return { major: 0, minor: 0 };
  return {
    major: parseInt(match[1], 10) || 0,
    minor: match[2] ? parseInt(match[2], 10) || 0 : 0,
  };
}

function filterAndSortGeminiModels(rawModels: unknown[]): string[] {
  const ids: string[] = [];

  for (const item of rawModels) {
    if (!item || typeof item !== 'object') continue;
    const m = item as { name?: unknown; supportedGenerationMethods?: unknown };
    if (typeof m.name !== 'string' || !m.name.startsWith('models/gemini')) continue;
    if (
      !Array.isArray(m.supportedGenerationMethods) ||
      !m.supportedGenerationMethods.includes('generateContent')
    ) {
      continue;
    }

    const id = m.name.slice('models/'.length).trim();
    if (!id) continue;

    const lowerId = id.toLowerCase();
    const isExcluded = EXCLUDED_MODEL_SUBSTRINGS.some((sub) => lowerId.includes(sub));
    if (isExcluded) continue;

    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  ids.sort((a, b) => {
    const verA = parseModelVersion(a);
    const verB = parseModelVersion(b);

    if (verA.major !== verB.major) return verB.major - verA.major;
    if (verA.minor !== verB.minor) return verB.minor - verA.minor;

    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();

    const isPreviewA = lowerA.includes('preview');
    const isPreviewB = lowerB.includes('preview');
    if (isPreviewA !== isPreviewB) return isPreviewA ? 1 : -1;

    const isFlashA = lowerA.includes('flash');
    const isFlashB = lowerB.includes('flash');
    if (isFlashA !== isFlashB) return isFlashA ? -1 : 1;

    return a.localeCompare(b);
  });

  return ids;
}

function mapHttpStatusToTestError(status: number): string {
  if (status === 400 || status === 401 || status === 403) {
    return 'Your Gemini API key was rejected.';
  }
  if (status === 429) {
    return 'Your Gemini free quota is used up. Wait a while or use another key.';
  }
  if (status === 404) {
    return 'This model is not available for your key. Choose Auto or another model.';
  }
  return 'Your Gemini API key was rejected.';
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
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [model, setModel] = useState(settings.model || 'auto');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const handleTestKeyAndModel = async () => {
    const key = geminiApiKey.trim();
    if (!key || isTesting) return;

    setIsTesting(true);
    setTestResult(null);

    let filteredModels: string[] = [];

    try {
      // a) Fetch available Gemini models for this key
      const listRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        {
          method: 'GET',
          headers: {
            'x-goog-api-key': key,
          },
        }
      );

      if (!listRes.ok) {
        setTestResult({
          ok: false,
          message: mapHttpStatusToTestError(listRes.status),
        });
        return;
      }

      const listData = await listRes.json().catch(() => ({}));
      const rawModels = Array.isArray(listData?.models) ? listData.models : [];

      // b) Filter and sort
      filteredModels = filterAndSortGeminiModels(rawModels);

      // c) Populate extra options
      setAvailableModels(filteredModels);

      // Determine model to verify in step (d)
      const isAuto = model === 'auto';
      const targetModelId = isAuto ? filteredModels[0] : model;

      if (!targetModelId) {
        if (!isAuto) {
          setModel('auto');
        }
        setTestResult({
          ok: false,
          message: 'This model is not available for your key. Choose Auto or another model.',
        });
        return;
      }

      // d) Confirm model answers generateContent
      const genRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          targetModelId
        )}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 16 },
          }),
        }
      );

      const isModelInvalidated = model !== 'auto' && !filteredModels.includes(model);
      if (isModelInvalidated) {
        setModel('auto');
        if (settings.model === model) {
          onSave({ geminiApiKey: settings.geminiApiKey, model: 'auto' });
        }
      }

      if (!genRes.ok) {
        setTestResult({
          ok: false,
          message: mapHttpStatusToTestError(genRes.status),
        });
        return;
      }

      // Reset saved selection to Auto if not in filtered list after test
      if (isModelInvalidated) {
        setTestResult({
          ok: true,
          message: `Auto will use: ${filteredModels[0] || targetModelId}`,
        });
      } else {
        setTestResult({
          ok: true,
          message: isAuto
            ? `Auto will use: ${targetModelId}`
            : `Key works. Model: ${targetModelId}`,
        });
      }
    } catch {
      setTestResult({
        ok: false,
        message: 'Could not reach Google. Check your connection.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      geminiApiKey: geminiApiKey.trim(),
      model: model.trim() || 'auto',
    });
    setHasSaved(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  // Ensure a previously saved custom model renders in the select even before Test is clicked
  const selectOptions =
    model !== 'auto' && !availableModels.includes(model)
      ? [model, ...availableModels]
      : availableModels;

  return (
    <>
      <form id="settings-form" onSubmit={handleSave} className="space-y-5 text-xs">
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

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!geminiApiKey.trim() || isTesting}
              loading={isTesting}
              onClick={handleTestKeyAndModel}
            >
              Test
            </Button>
          </div>

          {/* Inline Test Result */}
          {testResult && (
            <div
              className={`mt-2 p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                testResult.ok
                  ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                  : 'border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 text-red-800 dark:text-red-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" strokeWidth={1.5} />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0 mt-0.5" strokeWidth={1.5} />
              )}
              <span className="leading-relaxed font-medium break-words">{testResult.message}</span>
            </div>
          )}

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed pt-0.5">
            Your own key. Create one for free in{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B5BDB] underline hover:text-[#324ec0]"
            >
              Google AI Studio
            </a>
            . It is stored only in this browser and sent securely to the test service only to run your tests.
          </p>

          <div className="mt-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Do not test pages that show private personal data. Screenshots are stored for 7 days.
            </p>
          </div>
        </div>

        {/* AI Model Select */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <label
            htmlFor="ai-model"
            className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-200"
          >
            <Cpu className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
            <span>AI model</span>
          </label>

          <select
            id="ai-model"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setTestResult(null);
            }}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all"
          >
            <option value="auto">Auto (recommended best model)</option>
            {selectOptions.map((modelId) => (
              <option key={modelId} value={modelId}>
                {modelId}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            TestPilot picks the best available Gemini Flash model for your key.
          </p>
        </div>
      </form>

      {/* Drawer footer */}
      <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
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
      title="Settings"
      description="Configure your Gemini API key for running autonomous QA tests."
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
