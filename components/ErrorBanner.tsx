import React from 'react';
import { AlertCircle, RotateCcw, Settings, ShieldAlert, WifiOff, Clock } from 'lucide-react';
import { ApiError } from '@/types/runner';
import { Button } from './ui/Button';

interface ErrorBannerProps {
  error: ApiError | string | null;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  className?: string;
}

export function ErrorBanner({
  error,
  onRetry,
  onOpenSettings,
  className = '',
}: ErrorBannerProps) {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const isAuth = typeof error !== 'string' && error.isAuthError;
  const isRateLimit = typeof error !== 'string' && error.isRateLimit;
  const isNetwork = typeof error !== 'string' && error.isNetworkError;

  let Icon = AlertCircle;
  if (isAuth) Icon = ShieldAlert;
  else if (isRateLimit) Icon = Clock;
  else if (isNetwork) Icon = WifiOff;

  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 p-3.5 text-xs text-red-800 dark:text-red-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <span className="font-semibold block text-red-900 dark:text-red-200">
            {isAuth
              ? 'Authentication Required'
              : isRateLimit
              ? 'Runner Rate Limit'
              : isNetwork
              ? 'Connection Issue'
              : 'Runner API Error'}
          </span>
          <p className="mt-0.5 text-red-700 dark:text-red-300 leading-relaxed font-normal">
            {errorMessage}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {isAuth && onOpenSettings && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenSettings}
            icon={<Settings className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Settings
          </Button>
        )}
        {onRetry && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRetry}
            icon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
