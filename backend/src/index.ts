import 'dotenv/config';
import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
  type ErrorRequestHandler,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import analyzeRouter from './routes/analyze';
import subscriptionRouter from './routes/subscription';
import adminRouter from './routes/admin';

const app: Application = express();
const PORT = Number(process.env.PORT) || 4000;

// ─── Security middleware ───────────────────────────────────────────────────────

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : '*';

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(morgan('combined'));

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Razorpay webhook needs raw body for HMAC signature verification

app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', analyzeRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/admin', adminRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Never leak stack traces in production.

const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error('[Error]', message, stack);

  // Never forward third-party service status codes (e.g. Razorpay 401) as-is —
  // a Razorpay credential failure is a server config error (500), not a client
  // auth failure (401). Only use the upstream statusCode for 4xx client errors
  // that originate from our own middleware (authMiddleware sets 401, routes set 400/404).
  const upstreamStatus = (err as any)?.statusCode;
  const statusCode =
    typeof upstreamStatus === 'number' && upstreamStatus >= 400 && upstreamStatus < 500
      ? upstreamStatus
      : 500;

  res.status(statusCode).json({
    error:
      process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
  });
};

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`CalSnap backend running on port ${PORT}`);
});

export default app;
