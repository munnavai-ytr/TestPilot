'use client';

import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';
import { Button } from './ui/Button';

interface ScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshotUrl: string | null;
  title?: string;
}

export function ScreenshotModal({
  isOpen,
  onClose,
  screenshotUrl,
  title = 'Screenshot Viewer',
}: ScreenshotModalProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !screenshotUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = screenshotUrl;
    a.download = `testpilot-screenshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 max-w-6xl w-full max-h-[92vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-200 truncate max-w-md">
              {title}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              aria-label="Zoom out"
              icon={<ZoomOut className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScale(1)}
              aria-label="Reset zoom"
              icon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScale((s) => Math.min(3, s + 0.25))}
              aria-label="Zoom in"
              icon={<ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              Download
            </Button>
            <button
              onClick={onClose}
              aria-label="Close viewer"
              className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors ml-2"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-zinc-950/40">
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 150ms ease-out',
            }}
            className="flex items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt={title}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-auto object-contain rounded border border-zinc-800 shadow-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
