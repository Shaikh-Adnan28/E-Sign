// src/lib/storage/types.ts

export interface StorageProvider {
  /** Upload a file buffer to the given storage key/path. Returns void. */
  upload(buffer: Buffer, storageKey: string): Promise<void>;
  /** Download a file as Buffer given its storage key. */
  download(storageKey: string): Promise<Buffer>;
  /** Delete a stored file by its key. */
  delete(storageKey: string): Promise<void>;
  /** Check if a file exists in storage. */
  exists(storageKey: string): Promise<boolean>;
}
