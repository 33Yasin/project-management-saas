type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'session',
  'cookie',
  'secret',
  'authorization',
]);

/**
 * Recursively redacts sensitive keys from objects before logging
 */
export function sanitizeMeta(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMeta);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeMeta(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

class Logger {
  private isTest = process.env.NODE_ENV === 'test';
  private isProduction = process.env.NODE_ENV === 'production';

  private output(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (this.isTest) return;

    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? sanitizeMeta(meta) : undefined;

    if (this.isProduction) {
      // Structured JSON for production log aggregation
      const payload: Record<string, unknown> = {
        timestamp,
        level,
        message,
        ...(sanitizedMeta && typeof sanitizedMeta === 'object' ? sanitizedMeta : {}),
      };
      if (level === 'error') {
        console.error(JSON.stringify(payload));
      } else if (level === 'warn') {
        console.warn(JSON.stringify(payload));
      } else {
        console.log(JSON.stringify(payload));
      }
    } else {
      // Readable format for development
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      if (level === 'error') {
        console.error(`${prefix} ${message}`, sanitizedMeta || '');
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`, sanitizedMeta || '');
      } else {
        console.log(`${prefix} ${message}`, sanitizedMeta || '');
      }
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.output('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.output('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.output('error', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.output('debug', message, meta);
  }
}

export const logger = new Logger();
