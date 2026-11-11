import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { config, redactSecrets } from './config';
import {
  authenticateRunner,
  checkRateLimit,
  isRunnerBusy,
  acquireRunLock,
  releaseRunLock,
  validateSsrfUrl,
} from './security';
import {
  createRunRow,
  getRunRow,
  updateRunStepRow,
  reconcileRunningRunsOnStartup,
} from './supabase';
import { verifyGeminiKey } from './gemini';
import { QaAgent, requestRunStop } from './agent';
import { RunRecord, TestMode } from './types';

const app = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// CORS configuration
app.use(
  cors({
    origin: config.allowedOrigin === '*' ? true : config.allowedOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Gemini-Key'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'TestPilot Runner',
    status: 'online',
    busy: isRunnerBusy(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', busy: isRunnerBusy() });
});

// Protect all /api routes with Bearer token authentication
app.use('/api', authenticateRunner);

/**
 * POST /api/runs
 * Starts an autonomous QA run in the background.
 */
app.post('/api/runs', async (req: Request, res: Response): Promise<void> => {
  // 1. Validate X-Gemini-Key header
  const geminiKey = req.header('X-Gemini-Key');
  if (!geminiKey || !geminiKey.trim()) {
    res.status(400).json({
      error: {
        code: 'invalid_gemini_key',
        message: 'Missing or empty X-Gemini-Key header. Provide your Gemini API key.',
      },
    });
    return;
  }

  // 2. Validate request body
  const { url, command, mode, credentials } = req.body || {};

  if (!url || typeof url !== 'string') {
    res.status(400).json({
      error: {
        code: 'invalid_url',
        message: 'A valid website URL is required.',
      },
    });
    return;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    res.status(400).json({
      error: {
        code: 'invalid_url',
        message: 'URL must start with https:// or http://.',
      },
    });
    return;
  }

  // 3. Strict SSRF check on target URL
  const ssrfCheck = await validateSsrfUrl(url);
  if (!ssrfCheck.valid) {
    res.status(400).json({
      error: {
        code: 'invalid_url',
        message: 'This URL cannot be tested. Use a public https address.',
      },
    });
    return;
  }

  if (!command || typeof command !== 'string' || !command.trim()) {
    res.status(400).json({
      error: {
        code: 'invalid_request',
        message: 'A plain-language command is required (e.g. "Test login and checkout").',
      },
    });
    return;
  }

  const validModes: TestMode[] = ['smoke', 'user_flow', 'full_qa'];
  const testMode: TestMode = validModes.includes(mode) ? mode : 'smoke';

  // 4. Rate limiting: 10 new runs per hour per IP
  const rawIp = req.headers['x-forwarded-for'];
  const clientIp =
    (Array.isArray(rawIp) ? rawIp[0] : rawIp)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many runs. Wait a minute and try again.',
      },
    });
    return;
  }

  // 5. Concurrency check: only ONE active run at a time
  if (isRunnerBusy()) {
    res.status(503).json({
      error: {
        code: 'runner_busy',
        message: 'The Runner is busy with another test. Try again soon.',
      },
    });
    return;
  }

  // 6. Gemini key pre-flight verification
  try {
    await verifyGeminiKey(geminiKey);
  } catch (verifyErr: any) {
    const statusCode = verifyErr?.status || 400;
    res.status(statusCode).json({
      error: {
        code: verifyErr?.code || 'invalid_gemini_key',
        message: verifyErr?.message || 'Your Gemini API key was rejected. Check it in Settings.',
      },
    });
    return;
  }

  // 7. Create Run record
  const runId = crypto.randomUUID();

  // Acquire concurrency lock
  if (!acquireRunLock(runId)) {
    res.status(503).json({
      error: {
        code: 'runner_busy',
        message: 'The Runner is busy with another test. Try again soon.',
      },
    });
    return;
  }

  try {
    const now = new Date().toISOString();
    const initialRun: RunRecord = {
      id: runId,
      url,
      command: command.trim(),
      mode: testMode,
      status: 'running',
      steps: [],
      bugs: [],
      score: 100,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    await createRunRow(initialRun);

    // 8. Start background agent test execution WITHOUT awaiting it!
    const agent = new QaAgent({
      runId: initialRun.id,
      url,
      command: command.trim(),
      mode: testMode,
      credentials: credentials || null,
      geminiKey,
    });

    // Execute in background
    agent.execute().catch((err: unknown) => {
      console.error(`[Background] Run ${runId} execution error:`, redactSecrets(String(err)));
      releaseRunLock(runId);
    });

    // 9. Respond immediately with runId
    res.status(200).json({ runId: initialRun.id });
  } catch (err: unknown) {
    releaseRunLock(runId);
    console.error('[Server] Failed to initialize run:', redactSecrets(String(err)));
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to initialize test run.',
      },
    });
  }
});

/**
 * GET /api/runs/:id
 * Polls run status, live steps, screenshots, bugs, and final score.
 */
app.get('/api/runs/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const run = await getRunRow(id);

    if (!run) {
      res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Run not found.',
        },
      });
      return;
    }

    res.json(run);
  } catch (err: unknown) {
    console.error(`[Server] Error fetching run ${id}:`, redactSecrets(String(err)));
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to retrieve run status.',
      },
    });
  }
});

/**
 * POST /api/runs/:id/stop
 * Requests graceful termination of an in-progress run.
 */
app.post('/api/runs/:id/stop', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const run = await getRunRow(id);
    if (!run) {
      res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Run not found.',
        },
      });
      return;
    }

    if (run.status === 'running') {
      requestRunStop(id);
      await updateRunStepRow(id, run.steps, 'stopped');
      releaseRunLock(id);
    }

    res.json({
      success: true,
      message: 'Run stop requested.',
    });
  } catch (err: unknown) {
    console.error(`[Server] Error stopping run ${id}:`, redactSecrets(String(err)));
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to stop run.',
      },
    });
  }
});

// Central error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Uncaught request error:', redactSecrets(String(err)));
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Internal server error occurred.',
    },
  });
});

// Start server
const PORT = config.port;

const server = app.listen(PORT, async () => {
  console.log(`[TestPilot Runner] Service started on port ${PORT}`);
  console.log(`[TestPilot Runner] Allowed origin: ${config.allowedOrigin}`);
  console.log(`[TestPilot Runner] Default Gemini model: ${config.geminiModel}`);

  // Reconcile any orphaned runs from unexpected container restart
  try {
    await reconcileRunningRunsOnStartup();
  } catch (err) {
    console.warn('[TestPilot Runner] Startup reconciliation skipped or notice:', redactSecrets(String(err)));
  }
});

export default app;
