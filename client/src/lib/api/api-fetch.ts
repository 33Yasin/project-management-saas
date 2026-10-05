import type { ApiErrorResponse } from '@/types/api';

export class ApiError extends Error {
  public code: string;
  public status: number;
  public fields?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const config: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, config);

  if (response.status === 204) {
    return {} as T;
  }

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (data && typeof data === 'object' && 'error' in data) {
      const err = (data as ApiErrorResponse).error;
      throw new ApiError(response.status, err.code, err.message, err.fields);
    }
    throw new ApiError(
      response.status,
      'UNKNOWN_ERROR',
      typeof data === 'string' && data ? data : response.statusText || 'An unexpected error occurred'
    );
  }

  return data as T;
}
