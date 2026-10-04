import express from 'express';
import cors from 'cors';
import prisma from './lib/db/prisma';
import { sessionMiddleware } from './lib/session/session';
import authRouter from './modules/auth/auth.routes';
import workspacesRouter from './modules/workspaces/workspaces.routes';
import { errorHandler } from './middleware/error-handler';

const app = express();

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

// Centralized error handler
app.use(errorHandler);

export default app;
