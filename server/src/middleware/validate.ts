import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.') || 'general';
          if (!fields[path]) {
            fields[path] = [];
          }
          fields[path].push(issue.message);
        }

        return next(
          AppError.badRequest('Request validation failed.', ErrorCode.VALIDATION_ERROR, fields)
        );
      }
      next(error);
    }
  };
}
