export type TestMode = 'smoke' | 'user_flow' | 'full_qa';

export type StepStatus = 'running' | 'passed' | 'failed' | 'warning';

export type RunStatus = 'running' | 'completed' | 'failed' | 'stopped';

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Step {
  index?: number;
  action?: string;
  status?: StepStatus;
  durationMs?: number;
  screenshot?: string | null;
}

export interface Bug {
  id?: string;
  title?: string;
  severity?: BugSeverity;
  pageUrl?: string;
  screenshot?: string;
  whatHappened?: string;
  whyItHappened?: string;
  howToFix?: string;
}

export interface RunSummary {
  score?: number;
}

export interface RunDetails {
  status?: RunStatus;
  steps?: Step[];
  bugs?: Bug[];
  summary?: RunSummary;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

export interface RunnerSettings {
  geminiApiKey: string;
}

export interface StoredRun {
  runId: string;
  url: string;
  command: string;
  mode: TestMode;
  createdAt: string;
  lastKnownStatus: RunStatus;
  score?: number;
  bugCount: number;
  // Optional in-memory/client credentials for pre-fill if running again
  credentials?: {
    email?: string;
    password?: string;
  } | null;
  // In-memory details when loaded from runner API
  details?: RunDetails;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  isRateLimit?: boolean;
  isAuthError?: boolean;
  isNetworkError?: boolean;
  isNotFound?: boolean;
}
