/**
 * Storage System Exports
 * 
 * Pluggable storage system for API keys and secrets
 */

// Interfaces and types
export { 
  StorageAdapter, 
  StorageType, 
  StorageConfig,
  VaultStorageConfig,
  FileStorageConfig, 
  ClientManagedStorageConfig 
} from './StorageAdapter.js';

// Storage adapters
// VaultStorageAdapter removed - using simplified storage
export { FileStorageAdapter } from './FileStorageAdapter.js';
export { ClientManagedStorageAdapter } from './ClientManagedStorageAdapter.js';

// Factory and utilities
export { StorageFactory } from './StorageFactory.js';