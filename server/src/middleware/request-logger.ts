import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Skip during tests to keep test runs fast and quiet
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Skip frequent health checks from cluttering console
  if (req.path === '/api/health') {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const statusCode = res.statusCode;

    const meta = {
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
      ip,
    };

    const message = `${method} ${originalUrl} ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      logger.error(message, meta);
    } else if (statusCode >= 400) {
      logger.warn(message, meta);
    } else {
      logger.info(message, meta);
    }
  });

  next();
}
