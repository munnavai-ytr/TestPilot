'use client';

import React from 'react';
import { PlusCircle, History, Settings, Sun, Moon, Radio, Terminal, Laptop } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RunnerSettings } from '@/types/runner';

export type NavScreen = 'new_test' | 'live_run' | 'report' | 'history';

interface SidebarProps {
  currentScreen: NavScreen;
  onNavigate: (screen: NavScreen) => void;
  onOpenSettings: () => void;
  hasActiveRun?: boolean;
  activeRunUrl?: string;
  settings: RunnerSettings;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
}

export function Sidebar({
  currentScreen,
  onNavigate,
  onOpenSettings,
  hasActiveRun = false,
  activeRunUrl,
  settings,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const isRunnerConfigured =
    !!settings.runnerUrl?.trim() &&
    !!settings.accessToken?.trim() &&
    !!settings.geminiApiKey?.trim();

  return (
    <>
      {/* Desktop Left Sidebar (slim, 230px, Linear/Vercel style) */}
      <aside className="hidden md:flex flex-col w-[230px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 h-screen sticky top-0 z-20">
        {/* Brand Wordmark Zone */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => onNavigate('new_test')}
            className="flex items-center gap-2 text-left group focus-visible:outline-none"
          >
            <div className="w-6 h-6 rounded bg-[#3B5BDB] flex items-center justify-center text-white shadow-xs">
              <Terminal className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-[#3B5BDB] transition-colors whitespace-nowrap">
              TestPilot
            </span>
          </button>

          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-zinc-50 dark:bg-zinc-800/60">
            QA
          </span>
        </div>

        {/* Primary Navigation */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto text-xs">
          <div className="px-2 pb-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Workspace
          </div>

          <button
            onClick={() => onNavigate('new_test')}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]',
              currentScreen === 'new_test'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            <PlusCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
            <span>New Test</span>
          </button>

          {hasActiveRun && (
            <button
              onClick={() => onNavigate('live_run')}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]',
                currentScreen === 'live_run'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-[#3B5BDB] dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-900/40'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              )}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Radio className="w-4 h-4 text-[#3B5BDB] animate-pulse shrink-0" strokeWidth={1.5} />
                <span className="truncate">Live Run</span>
              </div>
              <span className="text-[10px] font-mono px-1 rounded bg-[#3B5BDB] text-white">
                LIVE
              </span>
            </button>
          )}

          <button
            onClick={() => onNavigate('history')}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]',
              currentScreen === 'history'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            <History className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
            <span>History</span>
          </button>
        </div>

        {/* Runner Status & Bottom Actions */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
          {/* Runner Status Pill */}
          <button
            onClick={onOpenSettings}
            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  isRunnerConfigured ? 'bg-[#16A34A]' : 'bg-[#CA8A04]'
                )}
              />
              <span className="font-mono text-[11px] truncate text-zinc-700 dark:text-zinc-300">
                {isRunnerConfigured ? 'Runner Active' : 'Runner Unset'}
              </span>
            </div>
            <Settings className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
          </button>

          {/* Theme & Settings Buttons */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium text-[11px]"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Settings</span>
            </button>

            <button
              onClick={onToggleTheme}
              aria-label="Toggle dark/light theme"
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={`Theme: ${theme}`}
            >
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : theme === 'light' ? (
                <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Laptop className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-13 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#3B5BDB] flex items-center justify-center text-white">
            <Terminal className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            TestPilot
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {theme === 'dark' ? (
              <Moon className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <Sun className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white/95 dark:bg-zinc-900/95 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around px-2 backdrop-blur-xs">
        <button
          onClick={() => onNavigate('new_test')}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
            currentScreen === 'new_test'
              ? 'text-[#3B5BDB] dark:text-blue-400'
              : 'text-zinc-500 dark:text-zinc-400'
          )}
        >
          <PlusCircle className="w-4 h-4 mb-0.5" strokeWidth={1.5} />
          <span>New Test</span>
        </button>

        {hasActiveRun && (
          <button
            onClick={() => onNavigate('live_run')}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
              currentScreen === 'live_run'
                ? 'text-[#3B5BDB] dark:text-blue-400'
                : 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            <Radio className="w-4 h-4 mb-0.5 animate-pulse" strokeWidth={1.5} />
            <span>Live Run</span>
          </button>
        )}

        <button
          onClick={() => onNavigate('history')}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
            currentScreen === 'history'
              ? 'text-[#3B5BDB] dark:text-blue-400'
              : 'text-zinc-500 dark:text-zinc-400'
          )}
        >
          <History className="w-4 h-4 mb-0.5" strokeWidth={1.5} />
          <span>History</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
        >
          <Settings className="w-4 h-4 mb-0.5" strokeWidth={1.5} />
          <span>Settings</span>
        </button>
      </nav>
    </>
  );
}
