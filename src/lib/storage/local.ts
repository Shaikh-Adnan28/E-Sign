// src/lib/storage/local.ts

import { promises as fs } from "fs";
import path from "path";
import { StorageProvider } from "./types";

/**
 * Local filesystem implementation of StorageProvider.
 * All files are stored under a base directory (configurable via env).
 * The storageKey is treated as a relative path inside the base directory.
 */
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string) {
    // Resolve to an absolute path for safety.
    this.basePath = path.resolve(basePath);
  }

  private resolveKey(storageKey: string): string {
    // Prevent path traversal – ensure the resolved path stays within basePath.
    const resolved = path.resolve(this.basePath, storageKey);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error("Invalid storage key – path traversal detected");
    }
    return resolved;
  }

  async upload(buffer: Buffer, storageKey: string): Promise<void> {
    const filePath = this.resolveKey(storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async download(storageKey: string): Promise<Buffer> {
    const filePath = this.resolveKey(storageKey);
    return await fs.readFile(filePath);
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.resolveKey(storageKey);
    await fs.unlink(filePath).catch(() => {}); // ignore if missing
  }

  async exists(storageKey: string): Promise<boolean> {
    const filePath = this.resolveKey(storageKey);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
