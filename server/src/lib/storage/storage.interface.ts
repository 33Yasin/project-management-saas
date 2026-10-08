export interface StorageFile {
  buffer: Buffer;
  mimeType?: string;
}

export interface IStorageService {
  save(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<StorageFile | null>;
  delete(key: string): Promise<void>;
}
