export type StudioSeverity = 'critical' | 'high' | 'medium' | 'low';

export type StudioCheckId =
  | 'explore'
  | 'smoke'
  | 'forms'
  | 'devices'
  | 'a11y'
  | 'perf'
  | 'seo'
  | 'links'
  | 'personas'
  | 'regression';

export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface StudioVaultAccount {
  id: string;
  label: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface StudioSettings {
  minDelayMs: number;
  maxStepsPerGoal: number;
  personaSteps: number;
  pauseOnError: boolean;
  allowDestructive: boolean;
  freshStartPerPersona: boolean;
  maxLinks: number;
  selectedDevices: string[];
}

export type BridgeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'disconnected';

export type StageActivityStatus =
  | 'Connected'
  | 'Thinking'
  | 'Acting'
  | 'Waiting for you'
  | 'Paused'
  | 'Connecting'
  | 'Disconnected';

export interface SnapshotElement {
  i: number;
  tag: string;
  role: string;
  name: string;
  inView: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  type?: string;
  value?: string;
  href?: string;
  disabled?: boolean;
  checked?: boolean;
  invalid?: boolean;
  required?: boolean;
  options?: string[];
  danger?: boolean;
}

export interface BridgeSnapshot {
  url: string;
  title: string;
  lang?: string;
  viewport: {
    w: number;
    h: number;
    scrollY: number;
    scrollH: number;
    dpr?: number;
  };
  elements: SnapshotElement[];
  totalInteractive: number;
  shown: number;
  headings: string[];
  visibleAlerts: string[];
  dialogs: string[];
  forms?: unknown;
  focused?: string | null;
  text?: string;
}

export interface BridgeEvidence {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: string[];
  brokenResources: string[];
  longTasks: number;
  cls: number;
  lcp: number;
  fcp: number;
  pendingRequests: number;
}

export interface LayoutIssue {
  rule: string;
  severity: StudioSeverity;
  detail: string;
  examples?: string[];
}

export interface A11yIssue {
  rule: string;
  severity: StudioSeverity;
  count: number;
  detail: string;
  examples?: string[];
}

export interface AuditLayoutResult {
  viewport: { w: number; h: number };
  docWidth: number;
  issues: LayoutIssue[];
}

export interface AuditA11yResult {
  issues: A11yIssue[];
}

export interface AuditSeoResult {
  title: string;
  description: string;
  issues: string[];
}

export interface AuditPerfResult {
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  fcpMs: number;
  lcpMs: number;
  cls: number;
  longTasks: number;
  requests: number;
  transferKB: number;
  oversizedImages: string[];
}

export interface AuditAllResult {
  layout?: AuditLayoutResult;
  a11y?: AuditA11yResult;
  seo?: AuditSeoResult;
  perf?: AuditPerfResult;
}

export interface DeviceAuditEntry {
  deviceId: string;
  deviceLabel: string;
  width: number;
  height: number;
  result: AuditLayoutResult;
  shotId?: string;
  counts: Record<StudioSeverity, number>;
}

export interface LinkCheckEntry {
  path: string;
  url: string;
  status: 'ok' | 'broken' | 'error';
  title?: string;
  reason?: string;
  consoleErrors: number;
  failedRequests: number;
}

export interface StudioAuditResults {
  devices?: DeviceAuditEntry[];
  a11y?: AuditA11yResult & { url: string };
  seo?: AuditSeoResult & { url: string };
  perf?: AuditPerfResult & { evidence?: BridgeEvidence; url: string };
  links?: {
    checkedCount: number;
    brokenCount: number;
    entries: LinkCheckEntry[];
  };
}

export type AgentActionType =
  | 'click'
  | 'type'
  | 'type_credential'
  | 'select'
  | 'check'
  | 'hover'
  | 'press'
  | 'scroll'
  | 'navigate'
  | 'back'
  | 'wait'
  | 'finish';

export interface AgentNextAction {
  type: AgentActionType;
  index?: number;
  text?: string;
  value?: string;
  checked?: boolean;
  key?: string;
  path?: string;
  dy?: number;
  to?: 'top' | 'bottom';
  field?: 'email' | 'password';
  account?: string;
  submit?: boolean;
}

export interface AgentIssueReport {
  title: string;
  severity: StudioSeverity;
  evidence: string;
  page: string;
}

export interface AgentAskPrompt {
  question: string;
  kind: 'text' | 'choice' | 'credentials';
  options?: string[];
}

export interface AgentDecision {
  caption: string;
  say: string;
  observation: string;
  issues: AgentIssueReport[];
  next: AgentNextAction;
  ask?: AgentAskPrompt | null;
}

export interface StudioStep {
  id: string;
  index: number;
  ts: string;
  goalId: string;
  personaId?: string;
  personaName?: string;
  caption: string;
  say: string;
  action: AgentNextAction;
  actionSummary: string;
  resultStatus: 'passed' | 'failed' | 'warning' | 'blocked';
  resultDetail: string;
  url: string;
  shotId?: string;
  evidenceDelta: {
    consoleErrors: string[];
    pageErrors: string[];
    failedRequests: string[];
    brokenResources: string[];
  };
}

export interface StudioFinding {
  id: string;
  sessionId: string;
  fingerprint: string;
  severity: StudioSeverity;
  title: string;
  page: string;
  source: 'agent' | 'covered' | 'audit_layout' | 'audit_a11y' | 'audit_seo' | 'audit_perf' | 'audit_links' | 'persona';
  whatHappened: string;
  whyItHappened: string;
  expectedVsActual: string;
  stepsToReproduce: string[];
  evidence: string;
  shotId?: string;
  fixPrompt?: string;
  createdAt: string;
}

export interface PlanCheckItem {
  id: StudioCheckId;
  title: string;
  why: string;
  enabled: boolean;
  goal?: string;
  personaIds?: string[];
  estimatedRequests: number;
  estimatedMinutes: number;
}

export interface StudioTestPlan {
  id: string;
  title: string;
  summary: string;
  notCovered: string[];
  checks: PlanCheckItem[];
  status: 'pending' | 'approved' | 'running' | 'completed' | 'revised';
}

export interface StudioQuestionCard {
  id: string;
  question: string;
  kind: 'text' | 'choice' | 'credentials' | 'destructive';
  options?: string[];
  dangerLabel?: string;
  answered?: boolean;
  answerText?: string;
  timedOut?: boolean;
}

export interface StudioChatMessage {
  id: string;
  ts: string;
  role: 'lead' | 'user' | 'system';
  text: string;
  quickReplies?: string[];
  plan?: StudioTestPlan;
  question?: StudioQuestionCard;
}

export interface PersonaDefinition {
  id: string;
  name: string;
  rules: string;
  preferredDeviceId: string;
  defaultGoal: string;
}

export interface PersonaFrictionPoint {
  what: string;
  where: string;
  severity: StudioSeverity;
}

export interface PersonaFeedbackResult {
  personaId: string;
  personaName: string;
  deviceLabel: string;
  goal: string;
  taskResult: 'success' | 'partial' | 'failed';
  summary: string;
  frictionPoints: PersonaFrictionPoint[];
  confusingMoments: string[];
  bugs: AgentIssueReport[];
  suggestions: string[];
  rating: number;
  wouldReturn: boolean;
  stepsTaken: number;
}

export interface PersonaAggregateCluster {
  theme: string;
  affectedCount: number;
  totalPersonas: number;
  label: string;
  severity: StudioSeverity;
}

export interface PersonaAggregateSummary {
  averageRating: number;
  clusters: PersonaAggregateCluster[];
  topThemes: string[];
}

export type StudioVerdict = 'Ready' | 'Ready with fixes' | 'Not ready';

export interface StudioScoreBreakdown {
  score: number;
  verdict: StudioVerdict;
  deductions: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    a11yHigh: number;
    layoutDevices: number;
    consoleAndNetwork: number;
    personaFailures: number;
    lowPersonaRating: number;
  };
  notTested: string[];
}

export interface StudioExecutiveSummary {
  goNoGoReasoning: string;
  top5Fixes: Array<{
    priority: number;
    title: string;
    reason: string;
    page: string;
  }>;
}

export interface StudioRegressionComparison {
  previousSessionId: string;
  previousDate: string;
  previousScore: number;
  scoreDelta: number;
  fixed: Array<{ fingerprint: string; title: string; severity: StudioSeverity; page: string }>;
  stillFailing: Array<{ fingerprint: string; title: string; severity: StudioSeverity; page: string }>;
  newFindings: Array<{ fingerprint: string; title: string; severity: StudioSeverity; page: string }>;
}

export type StudioSessionStatus = 'planning' | 'running' | 'paused' | 'completed' | 'stopped';

export interface StudioSession {
  id: string;
  appUrl: string;
  appOrigin: string;
  deviceId: string;
  deviceWidth: number;
  deviceHeight: number;
  createdAt: string;
  updatedAt: string;
  status: StudioSessionStatus;
  geminiRequestsUsed: number;
  messages: StudioChatMessage[];
  steps: StudioStep[];
  audits: StudioAuditResults;
  personaResults: PersonaFeedbackResult[];
  personaAggregate?: PersonaAggregateSummary | null;
  scoreBreakdown?: StudioScoreBreakdown | null;
  executiveSummary?: StudioExecutiveSummary | null;
  top5CombinedFixPrompt?: string;
  previousSessionId?: string | null;
  notTestedSelections: string[];
  stagingAcked?: boolean;
  screenshotUnavailableNotified?: boolean;
}
