'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Check, Sparkles, ShieldAlert } from 'lucide-react';
import { RunnerSettings } from '@/types/runner';
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
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ geminiApiKey: geminiApiKey.trim() });
    setHasSaved(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

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
            . It is stored only in this browser and sent securely to the test service only to run your tests.
          </p>

          <div className="mt-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Do not test pages that show private personal data. Screenshots are stored for 7 days.
            </p>
          </div>
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
