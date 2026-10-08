import fs from 'fs/promises';
import path from 'path';
import { IStorageService, StorageFile } from './storage.interface';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';

export class LocalStorageAdapter implements IStorageService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(baseDir || path.join(process.cwd(), 'uploads'));
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {
      // Ignore directory already exists errors
    }
  }

  private getSafePath(key: string): string {
    // Prevent directory traversal: only use basename of key and resolve relative to baseDir
    const safeKey = path.basename(key);
    const resolvedPath = path.resolve(this.baseDir, safeKey);

    if (!resolvedPath.startsWith(this.baseDir)) {
      throw AppError.badRequest('Invalid file key.', ErrorCode.VALIDATION_ERROR);
    }

    return resolvedPath;
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    await this.ensureDirectory();
    const filePath = this.getSafePath(key);
    await fs.writeFile(filePath, buffer);
  }

  async get(key: string): Promise<StorageFile | null> {
    const filePath = this.getSafePath(key);
    try {
      const buffer = await fs.readFile(filePath);
      return { buffer };
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getSafePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') {
        // Already deleted or never existed, safe to ignore
        return;
      }
      throw err;
    }
  }
}
