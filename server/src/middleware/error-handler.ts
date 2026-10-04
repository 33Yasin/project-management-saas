import { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  // Log unexpected errors on server console, never expose raw DB/stack traces to production clients
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled Error:', err);
  }

  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected internal server error occurred.',
    },
  });
};
