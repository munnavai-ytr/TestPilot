'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  RotateCw,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Check,
  Copy,
  Cloud,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { DEVICE_PRESETS } from '@/lib/studio/store';
import { BridgeConnectionStatus, StageActivityStatus } from '@/lib/studio/types';
import { Button } from '@/components/ui/Button';
import { buildSdkInstallPrompt } from './StudioSetup';

interface StudioStageProps {
  iframeSrc: string;
  onIframeRef: (el: HTMLIFrameElement | null) => void;
  deviceId: string;
  width: number;
  height: number;
  onChangeDevice: (deviceId: string, width: number, height: number) => void;
  connectionStatus: BridgeConnectionStatus;
  activityStatus: StageActivityStatus;
  currentCaption?: string;
  onReload: () => void;
  onResetAppData: () => Promise<void>;
  onRetryConnection: () => void;
  onReconnect: () => void;
  onUseCloudMode: () => void;
}

export function StudioStage({
  iframeSrc,
  onIframeRef,
  deviceId,
  width,
  height,
  onChangeDevice,
  connectionStatus,
  activityStatus,
  currentCaption,
  onReload,
  onResetAppData,
  onRetryConnection,
  onReconnect,
  onUseCloudMode,
}: StudioStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({ w: 400, h: 400 });
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setBoxSize({
        w: Math.max(200, rect.width - 24),
        h: Math.max(160, rect.height - 24),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scaleX = boxSize.w / Math.max(1, width);
  const scaleY = boxSize.h / Math.max(1, height);
  const scale = Math.min(1, scaleX, scaleY);
  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://testpilot.app';

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildSdkInstallPrompt(origin));
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 1800);
    } catch {
      // ignore
    }
  };

  const handlePresetChange = (nextId: string) => {
    const preset = DEVICE_PRESETS.find((d) => d.id === nextId);
    if (!preset) return;
    onChangeDevice(nextId, preset.width, preset.height);
  };

  const handleRotate = () => {
    onChangeDevice('custom', height, width);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await onResetAppData();
    } finally {
      setIsResetting(false);
      setConfirmReset(false);
    }
  };

  const statusChipStyles: Record<StageActivityStatus, string> = {
    Connected:
      'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-[#16A34A] dark:text-emerald-400',
    Thinking:
      'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 text-[#3B5BDB] dark:text-blue-400',
    Acting:
      'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 text-[#3B5BDB] dark:text-blue-400',
    'Waiting for you':
      'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 text-[#CA8A04] dark:text-amber-400',
    Paused:
      'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
    Connecting:
      'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
    Disconnected:
      'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-[#DC2626] dark:text-red-400',
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-zinc-100/70 dark:bg-zinc-950">
      {/* Stage Controls Bar */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <select
            aria-label="Stage device preset"
            value={deviceId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-[11px] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] max-w-[165px]"
          >
            {DEVICE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {deviceId === 'custom' && (
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <input
                type="number"
                aria-label="Custom viewport width"
                min={240}
                max={2560}
                value={width}
                onChange={(e) => onChangeDevice('custom', Number(e.target.value) || 390, height)}
                className="w-14 px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
              <span className="text-zinc-400">x</span>
              <input
                type="number"
                aria-label="Custom viewport height"
                min={320}
                max={2560}
                value={height}
                onChange={(e) => onChangeDevice('custom', width, Number(e.target.value) || 844)}
                className="w-14 px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleRotate}
            title="Rotate viewport"
            aria-label="Rotate viewport"
            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={onReload}
            title="Reload app"
            aria-label="Reload app"
            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          {confirmReset ? (
            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md px-2 py-0.5">
              <span className="text-[11px] text-[#DC2626] dark:text-red-400">Clear storage?</span>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmReset}
                className="text-[11px] font-semibold text-[#DC2626] hover:underline px-1"
              >
                {isResetting ? '...' : 'Yes'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-[11px] text-zinc-500 hover:underline px-1"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              <span>Reset app data</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline tabular-nums">
            {width}x{height}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium ${statusChipStyles[activityStatus]}`}
          >
            {(activityStatus === 'Thinking' ||
              activityStatus === 'Acting' ||
              activityStatus === 'Connecting') && (
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} />
            )}
            <span>{activityStatus}</span>
          </span>
        </div>
      </div>

      {/* Reconnect Banner if ping failed twice */}
      {connectionStatus === 'disconnected' && (
        <div className="px-3 py-2 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-[#DC2626] dark:text-red-400">
            <WifiOff className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            <span>Connection to the app was lost. Run paused.</span>
          </div>
          <Button type="button" size="sm" variant="danger" onClick={onReconnect}>
            Reconnect
          </Button>
        </div>
      )}

      {/* Stage Viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-3"
      >
        {/* Caption Overlay Chip */}
        {currentCaption && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[90%] px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 shadow-sm text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate pointer-events-none">
            {currentCaption}
          </div>
        )}

        {/* Scaled Device Frame */}
        <div
          style={{
            width: `${scaledW}px`,
            height: `${scaledH}px`,
          }}
          className="relative shrink-0"
        >
          <div
            style={{
              width: `${width}px`,
              height: `${height}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
          >
            <iframe
              ref={onIframeRef}
              src={iframeSrc}
              title="TestPilot Studio App Stage"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              allow="clipboard-read; clipboard-write"
              className="w-full h-full border-0 bg-white"
            />
          </div>
        </div>

        {/* Connection Diagnostics Overlay Card (after 10s with no hello) */}
        {connectionStatus === 'failed' && (
          <div className="absolute inset-0 z-30 bg-zinc-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-md w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-lg space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-[#CA8A04]" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Waiting for TestPilot SDK connection
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    No handshake arrived from your app within 10 seconds. Check these 4 common causes:
                  </p>
                </div>
              </div>

              <ol className="space-y-1.5 text-[11.5px] text-zinc-700 dark:text-zinc-300 list-decimal list-inside bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <li>The SDK script tag is missing or loads after your app mounts.</li>
                <li>
                  The app forbids embedding (<code className="font-mono text-[10.5px]">X-Frame-Options</code> or{' '}
                  <code className="font-mono text-[10.5px]">CSP frame-ancestors</code>).
                </li>
                <li>Wrong URL or an http:// address was entered.</li>
                <li>The browser blocks third-party storage inside embedded frames.</li>
              </ol>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onRetryConnection}
                  icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  Retry
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyPrompt}
                  icon={
                    copiedPrompt ? (
                      <Check className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={1.5} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )
                  }
                >
                  {copiedPrompt ? 'Copied prompt' : 'Copy install prompt'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onUseCloudMode}
                  icon={<Cloud className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  Use Cloud mode instead
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
