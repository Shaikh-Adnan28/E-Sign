// Storage abstraction for documents
// This file exports a singleton StorageProvider implementation based on the
// LOCAL_STORAGE_PATH environment variable. It defaults to the local "storage"
// directory and uses the LocalStorageProvider implementation.

import { LocalStorageProvider } from "./storage/local";
import { StorageProvider } from "./storage/types";

// Resolve the base storage directory from env or default.
const basePath = process.env.LOCAL_STORAGE_PATH ?? "storage";

// Export a ready‑to‑use provider instance.
export const storageProvider: StorageProvider = new LocalStorageProvider(basePath);