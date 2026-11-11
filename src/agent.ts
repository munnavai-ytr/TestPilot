import { BrowserManager } from './browser';
import { decideNextAction, generateFinalBugReport } from './gemini';
import { uploadScreenshot, updateRunStepRow, finalizeRunRow } from './supabase';
import { calculateScore } from './scoring';
import { releaseRunLock } from './security';
import { config } from './config';
import {
  ActionDecision,
  Bug,
  BugSeverity,
  RunCredentials,
  RunRecord,
  RunStatus,
  Step,
  TestMode,
} from './types';

// Map of stopped run IDs to gracefully terminate background execution
const stopRequestedSet = new Set<string>();

export function requestRunStop(runId: string): boolean {
  stopRequestedSet.add(runId);
  return true;
}

export function isRunStopRequested(runId: string): boolean {
  return stopRequestedSet.has(runId);
}

export interface AgentRunParams {
  runId: string;
  url: string;
  command: string;
  mode: TestMode;
  credentials?: RunCredentials | null;
  geminiKey: string;
}

export class QaAgent {
  private runId: string;
  private url: string;
  private command: string;
  private mode: TestMode;
  private credentials?: RunCredentials | null;
  private geminiKey: string;
  private browserManager: BrowserManager;
  private maxSteps: number;
  private steps: Step[] = [];
  private rawIssues: Array<{
    title: string;
    severity: BugSeverity;
    evidence: string;
    pageUrl: string;
    screenshotUrl: string;
    stepIndex: number;
  }> = [];

  constructor(params: AgentRunParams) {
    this.runId = params.runId;
    this.url = params.url;
    this.command = params.command;
    this.mode = params.mode;
    this.credentials = params.credentials;
    this.geminiKey = params.geminiKey;
    this.browserManager = new BrowserManager();
    this.maxSteps = config.stepLimits[this.mode] || 15;
  }

  /**
   * Executes the autonomous QA test loop.
   */
  public async execute(): Promise<void> {
    const startTime = Date.now();
    let currentStatus: RunStatus = 'running';
    let runError: { code: string; message: string } | null = null;
    let finalBugs: Bug[] = [];

    try {
      // 1. Launch browser and isolated page
      await this.browserManager.init({ viewport: { width: 1280, height: 720 } });

      // 2. Initial navigation to target site
      const navStart = Date.now();
      let initialStepScreenshotUrl: string | null = null;
      try {
        await this.browserManager.navigate(this.url);
        const screenshotBuf = await this.browserManager.takeScreenshot();
        initialStepScreenshotUrl = await uploadScreenshot(this.runId, 1, screenshotBuf);

        this.steps.push({
          index: 1,
          action: `Opened ${this.url}`,
          status: 'passed',
          durationMs: Date.now() - navStart,
          screenshot: initialStepScreenshotUrl,
        });
      } catch (navErr: unknown) {
        this.steps.push({
          index: 1,
          action: `Failed to open ${this.url}`,
          status: 'failed',
          durationMs: Date.now() - navStart,
          screenshot: null,
        });
        throw new Error(`Initial page navigation failed: ${navErr instanceof Error ? navErr.message : String(navErr)}`);
      }

      // Sync initial step to DB
      await updateRunStepRow(this.runId, this.steps, currentStatus);

      // 3. Autonomous agent exploration loop
      let stepCounter = 1;
      let isMobileTested = false;

      while (stepCounter < this.maxSteps) {
        // Check timeout
        if (Date.now() - startTime > config.hardTimeLimitMs) {
          console.warn(`[Agent] Run ${this.runId} hit execution limit.`);
          break;
        }

        // Check if user requested stop
        if (isRunStopRequested(this.runId)) {
          currentStatus = 'stopped';
          console.log(`[Agent] Run ${this.runId} stopped by user request.`);
          break;
        }

        // In full_qa mode, test mobile responsiveness around step 6
        if (this.mode === 'full_qa' && stepCounter === 6 && !isMobileTested) {
          isMobileTested = true;
          await this.browserManager.setViewportSize(375, 667);
          await new Promise((r) => setTimeout(r, 600));
        } else if (isMobileTested && stepCounter === 10) {
          await this.browserManager.setViewportSize(1280, 720);
          await new Promise((r) => setTimeout(r, 600));
        }

        const stepStartTime = Date.now();

        // Capture current state screenshot & evidence
        const screenshotBuf = await this.browserManager.takeScreenshot();
        const screenshotBase64 = screenshotBuf.toString('base64');
        const evidence = await this.browserManager.getEvidenceSummary();
        const interactiveElements = await this.browserManager.extractInteractiveElements();
        const currentUrl = this.browserManager.getPage().url();

        // Ask Gemini for next action
        let decision: ActionDecision;
        try {
          decision = await decideNextAction({
            apiKey: this.geminiKey,
            command: this.command,
            mode: this.mode,
            currentUrl,
            stepsSoFar: this.steps,
            screenshotJpegBase64: screenshotBase64,
            elements: interactiveElements,
            evidence,
          });
        } catch (geminiErr: unknown) {
          console.error(`[Agent] Gemini decision error:`, geminiErr);
          break;
        }

        // Record any issues identified in this step
        if (decision.issues && decision.issues.length > 0) {
          for (const issue of decision.issues) {
            this.rawIssues.push({
              title: issue.title,
              severity: issue.severity,
              evidence: issue.evidence,
              pageUrl: currentUrl,
              screenshotUrl: this.steps[this.steps.length - 1]?.screenshot || '',
              stepIndex: stepCounter,
            });
          }
        }

        // If goal complete or finished
        if (decision.next.type === 'finish') {
          console.log(`[Agent] Exploration completed by decision: ${decision.observation}`);
          break;
        }

        // Execute chosen action
        const actionResult = await this.browserManager.executeAction(
          decision.next,
          this.credentials,
          interactiveElements
        );

        stepCounter++;
        const postScreenshotBuf = await this.browserManager.takeScreenshot();
        const postScreenshotUrl = await uploadScreenshot(this.runId, stepCounter, postScreenshotBuf);

        const stepStatus = actionResult.success
          ? 'passed'
          : decision.next.type === 'wait'
          ? 'warning'
          : 'failed';

        const stepObj: Step = {
          index: stepCounter,
          action: actionResult.description || decision.observation || `Step ${stepCounter}`,
          status: stepStatus,
          durationMs: Date.now() - stepStartTime,
          screenshot: postScreenshotUrl,
        };

        this.steps.push(stepObj);

        // Update database immediately after every step for live streaming
        await updateRunStepRow(this.runId, this.steps, currentStatus);
      }

      if (currentStatus !== 'stopped') {
        currentStatus = 'completed';
      }

      // 4. Synthesize final bug report from evidence and steps
      const finalEvidence = await this.browserManager.getEvidenceSummary();

      finalBugs = await generateFinalBugReport({
        apiKey: this.geminiKey,
        command: this.command,
        url: this.url,
        steps: this.steps,
        rawIssues: this.rawIssues,
        evidence: finalEvidence,
      });
    } catch (err: unknown) {
      console.error(`[Agent] Run ${this.runId} encountered error:`, err);
      if (currentStatus !== 'stopped') {
        currentStatus = 'failed';
      }
      runError = {
        code: 'run_failed',
        message: err instanceof Error ? err.message : 'An unexpected error occurred during test execution.',
      };
    } finally {
      // 5. Clean up browser
      await this.browserManager.close();

      // Clean up stop flag
      stopRequestedSet.delete(this.runId);

      // Release concurrency lock
      releaseRunLock(this.runId);

      // Calculate deterministic score
      const score = calculateScore(finalBugs);

      // Finalize run in Supabase
      await finalizeRunRow(this.runId, {
        status: currentStatus,
        steps: this.steps,
        bugs: finalBugs,
        score,
        error: runError,
      });
    }
  }
}
