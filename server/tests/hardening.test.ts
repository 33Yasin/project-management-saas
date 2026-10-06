import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import app from '../src/app';
import { sanitizeMeta, logger } from '../src/lib/logger';
import { AppError } from '../src/errors/app-error';
import { ErrorCode } from '../src/errors/error-codes';
import { errorHandler } from '../src/middleware/error-handler';

describe('Phase 9 — Hardening & Security Suite', () => {
  describe('Security Headers (Helmet)', () => {
    it('should set secure HTTP headers and hide x-powered-by', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('Sensitive Data Sanitization in Logging', () => {
    it('should redact sensitive keys (password, token, session, secret)', () => {
      const rawPayload = {
        email: 'user@example.com',
        password: 'SuperSecretPassword123!',
        passwordHash: '$argon2id$...',
        token: 'high-entropy-invitation-token',
        tokenHash: 'sha256hash...',
        session: { id: 'sid-123', cookie: { secure: true } },
        nested: {
          secret: 'api-secret-key',
          name: 'Public Name',
        },
      };

      const sanitized = sanitizeMeta(rawPayload) as any;

      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.passwordHash).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.tokenHash).toBe('[REDACTED]');
      expect(sanitized.session).toBe('[REDACTED]');
      expect(sanitized.nested.secret).toBe('[REDACTED]');
      expect(sanitized.nested.name).toBe('Public Name');
    });
  });

  describe('Rate Limiter Behavior & Standard 429 Response', () => {
    it('should return 429 with standard TOO_MANY_REQUESTS format when limit is exceeded', async () => {
      // Test isolated rate limiter to verify standard AppError handler format
      const testApp = express();
      testApp.use(express.json());

      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 2,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, _res, next) => {
          next(AppError.tooManyRequests('Custom rate limit exceeded message.'));
        },
      });

      testApp.get('/test-limit', testLimiter, (_req, res) => {
        res.json({ ok: true });
      });
      testApp.use(errorHandler);

      // Request 1: OK
      const res1 = await request(testApp).get('/test-limit');
      expect(res1.status).toBe(200);

      // Request 2: OK
      const res2 = await request(testApp).get('/test-limit');
      expect(res2.status).toBe(200);

      // Request 3: Rate Limited (429)
      const res3 = await request(testApp).get('/test-limit');
      expect(res3.status).toBe(429);
      expect(res3.body).toEqual({
        error: {
          code: ErrorCode.TOO_MANY_REQUESTS,
          message: 'Custom rate limit exceeded message.',
        },
      });
    });
  });

  describe('Unhandled Error Masking in Production', () => {
    it('should return standard 500 without leaking stack traces or internal errors', async () => {
      const testApp = express();
      testApp.get('/crash', () => {
        throw new Error('Database connection failed: secret credentials in error');
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/crash');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'An unexpected internal server error occurred.',
        },
      });
      // Ensure no stack traces or raw messages in the response body
      expect(res.body.error.stack).toBeUndefined();
      expect(res.text).not.toContain('secret credentials');
    });
  });
});
