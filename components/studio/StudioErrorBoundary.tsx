'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface StudioErrorBoundaryProps {
  children: React.ReactNode;
  onResetToCloud?: () => void;
}

interface StudioErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class StudioErrorBoundary extends React.Component<
  StudioErrorBoundaryProps,
  StudioErrorBoundaryState
> {
  constructor(props: StudioErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): StudioErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred in Studio.',
    };
  }

  handleRecover = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto">
          <Card className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#DC2626]" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Studio encountered a problem
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 break-words">
                  {this.state.message}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                  The rest of TestPilot is unaffected. You can reset Studio or switch to Cloud mode.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleRecover}
                icon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />}
              >
                Reload Studio
              </Button>
              {this.props.onResetToCloud && (
                <Button variant="outline" size="sm" onClick={this.props.onResetToCloud}>
                  Open Cloud Mode (New Test)
                </Button>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
