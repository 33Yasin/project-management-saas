import { ErrorCode, ErrorCodeType } from './error-codes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodeType;
  public readonly fields?: Record<string, string[]>;

  constructor(
    statusCode: number,
    code: ErrorCodeType,
    message: string,
    fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code: ErrorCodeType = ErrorCode.VALIDATION_ERROR, fields?: Record<string, string[]>) {
    return new AppError(400, code, message, fields);
  }

  static unauthenticated(message = 'Authentication required.', code: ErrorCodeType = ErrorCode.AUTH_REQUIRED) {
    return new AppError(401, code, message);
  }

  static unauthorized(message = 'You do not have permission to perform this action.', code: ErrorCodeType = ErrorCode.WORKSPACE_ACCESS_DENIED) {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Resource not found.', code: ErrorCodeType = ErrorCode.PROJECT_NOT_FOUND) {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code: ErrorCodeType = ErrorCode.CONFLICT) {
    return new AppError(409, code, message);
  }

  static tooManyRequests(message = 'Too many requests. Please try again later.') {
    return new AppError(429, ErrorCode.TOO_MANY_REQUESTS, message);
  }

  static internal(message = 'An unexpected error occurred.') {
    return new AppError(500, ErrorCode.INTERNAL_SERVER_ERROR, message);
  }
}
