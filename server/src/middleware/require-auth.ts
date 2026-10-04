import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return next(
      AppError.unauthenticated('Authentication required.', ErrorCode.AUTH_REQUIRED)
    );
  }
  next();
}
