'use client';

import React, { useState } from 'react';
import { X, Sliders, RotateCcw, Check } from 'lucide-react';
import {
  DEFAULT_AUDIT_DEVICE_PRESETS,
  DEFAULT_STUDIO_SETTINGS,
  getStudioSettings,
  saveStudioSettings,
} from '@/lib/studio/store';
import { StudioSettings } from '@/lib/studio/types';
import { Button } from '@/components/ui/Button';

interface StudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: (settings: StudioSettings) => void;
}

export function StudioSettingsModal({
  isOpen,
  onClose,
  onChanged,
}: StudioSettingsModalProps) {
  const [draft, setDraft] = useState<StudioSettings>(() => getStudioSettings());
  const [savedFlash, setSavedFlash] = useState(false);

  if (!isOpen) return null;

  const toggleDevice = (id: string) => {
    setDraft((prev) => {
      const exists = prev.selectedDevices.includes(id);
      const next = exists
        ? prev.selectedDevices.filter((d) => d !== id)
        : [...prev.selectedDevices, id];
      return { ...prev, selectedDevices: next };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: StudioSettings = {
      minDelayMs: Math.max(0, Number(draft.minDelayMs) || 0),
      maxStepsPerGoal: Math.max(1, Number(draft.maxStepsPerGoal) || 25),
      personaSteps: Math.max(1, Number(draft.personaSteps) || 20),
      pauseOnError: !!draft.pauseOnError,
      allowDestructive: !!draft.allowDestructive,
      freshStartPerPersona: !!draft.freshStartPerPersona,
      maxLinks: Math.max(1, Number(draft.maxLinks) || 15),
      selectedDevices:
        draft.selectedDevices.length > 0
          ? draft.selectedDevices
          : [...DEFAULT_STUDIO_SETTINGS.selectedDevices],
    };
    saveStudioSettings(cleaned);
    onChanged?.(cleaned);
    setSavedFlash(true);
    setTimeout(() => {
      setSavedFlash(false);
      onClose();
    }, 350);
  };

  const handleResetDefaults = () => {
    setDraft({ ...DEFAULT_STUDIO_SETTINGS });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Studio settings"
        className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#3B5BDB]" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Studio Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Studio settings"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Personal Studio runner defaults. All limits are editable with no hard caps.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label htmlFor="st-min-delay" className="font-medium text-zinc-800 dark:text-zinc-200 block">
                Min delay between Gemini calls (ms)
              </label>
              <input
                id="st-min-delay"
                type="number"
                min={0}
                step={100}
                value={draft.minDelayMs}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, minDelayMs: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="st-max-steps" className="font-medium text-zinc-800 dark:text-zinc-200 block">
                Max steps per goal
              </label>
              <input
                id="st-max-steps"
                type="number"
                min={1}
                value={draft.maxStepsPerGoal}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    maxStepsPerGoal: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="st-persona-steps" className="font-medium text-zinc-800 dark:text-zinc-200 block">
                Steps per virtual user (persona)
              </label>
              <input
                id="st-persona-steps"
                type="number"
                min={1}
                value={draft.personaSteps}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    personaSteps: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="st-max-links" className="font-medium text-zinc-800 dark:text-zinc-200 block">
                Max same-origin links to check
              </label>
              <input
                id="st-max-links"
                type="number"
                min={1}
                value={draft.maxLinks}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, maxLinks: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.pauseOnError}
                onChange={(e) => setDraft((p) => ({ ...p, pauseOnError: e.target.checked }))}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-[#3B5BDB] focus:ring-[#3B5BDB]"
              />
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                  Pause on error
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Automatically pause the agent when a console, network, or action error occurs.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.freshStartPerPersona}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, freshStartPerPersona: e.target.checked }))
                }
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-[#3B5BDB] focus:ring-[#3B5BDB]"
              />
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                  Fresh start per persona
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Clear app storage and reload before each virtual user begins.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.allowDestructive}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, allowDestructive: e.target.checked }))
                }
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-[#3B5BDB] focus:ring-[#3B5BDB]"
              />
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                  Allow destructive actions automatically
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Skip confirmation cards when clicking buttons marked as delete/danger.
                </span>
              </div>
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <span className="font-medium text-zinc-800 dark:text-zinc-200 block">
              Devices included in layout audit
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DEFAULT_AUDIT_DEVICE_PRESETS.map((dev) => (
                <label
                  key={dev.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={draft.selectedDevices.includes(dev.id)}
                    onChange={() => toggleDevice(dev.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-[#3B5BDB] focus:ring-[#3B5BDB]"
                  />
                  <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                    {dev.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              icon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              Reset defaults
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={savedFlash ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : undefined}
              >
                {savedFlash ? 'Saved' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
