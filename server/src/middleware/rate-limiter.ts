import rateLimit from 'express-rate-limit';
import { AppError } from '../errors/app-error';

const isTest = process.env.NODE_ENV === 'test';

/**
 * General API rate limiter — baseline DoS protection for all endpoints.
 * 1000 requests per 15 minutes per IP.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(
      AppError.tooManyRequests(
        'Too many requests from this IP. Please try again after 15 minutes.'
      )
    );
  },
});

/**
 * Auth rate limiter — prevents brute-force credential stuffing on login and registration.
 * 15 attempts per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 15 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(
      AppError.tooManyRequests(
        'Too many authentication attempts. Please try again after 15 minutes.'
      )
    );
  },
});

/**
 * Invitation rate limiter — prevents invitation spam and token guessing.
 * 30 attempts per 15 minutes per IP in production.
 */
export const invitationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 30 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(
      AppError.tooManyRequests(
        'Too many invitation requests. Please try again after 15 minutes.'
      )
    );
  },
});
