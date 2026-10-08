import { IStorageService } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';

export function createStorageService(): IStorageService {
  const driver = process.env.STORAGE_DRIVER || 'local';

  switch (driver) {
    case 'local':
    default:
      return new LocalStorageAdapter(process.env.STORAGE_LOCAL_DIR);
  }
}

export const storageService = createStorageService();
