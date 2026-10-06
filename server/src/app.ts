import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import prisma from './lib/db/prisma';
import { sessionMiddleware } from './lib/session/session';
import { requestLogger } from './middleware/request-logger';
import { generalRateLimiter } from './middleware/rate-limiter';
import authRouter from './modules/auth/auth.routes';
import workspacesRouter from './modules/workspaces/workspaces.routes';
import { invitationsRouter } from './modules/invitations/invitations.routes';
import projectsRouter from './modules/projects/projects.routes';
import tasksRouter from './modules/tasks/tasks.routes';
import commentsRouter from './modules/comments/comments.routes';
import { errorHandler } from './middleware/error-handler';

const app = express();

// Trust first reverse proxy in production (for HTTPS secure cookies on Render/Railway/Fly/Nginx)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers (hides X-Powered-By, sets X-Content-Type-Options, HSTS, etc.)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// HTTP request logging (structured in prod, clean in dev, silent in test)
app.use(requestLogger);

// Global API rate limiting (DoS protection)
app.use('/api', generalRateLimiter);

// CORS — only allow requests from the client origin with credentials
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// Parse JSON request bodies
app.use(express.json());

// Session management (backed by PostgreSQL)
app.use(sessionMiddleware);

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: error instanceof Error ? error.message : 'Database check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Domain modules
app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/comments', commentsRouter);

// Serve frontend SPA in production if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized error handler
app.use(errorHandler);

export default app;
