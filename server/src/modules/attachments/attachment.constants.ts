export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function sanitizeFilename(filename: string): string {
  // Strip paths, control chars, and problematic shell/filesystem characters
  const base = filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return base.length > 0 ? base : 'unnamed_file';
}
