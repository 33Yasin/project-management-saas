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

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || '';

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const defaultHeaders: Record<string, string> = {};
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  if (body !== undefined) {
    config.body = isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, config);

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
