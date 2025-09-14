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
  PostgreSQLStorageConfig,
  FileStorageConfig, 
  ClientManagedStorageConfig 
} from './StorageAdapter';

// Storage adapters
// VaultStorageAdapter removed - using simplified storage
export { FileStorageAdapter } from './FileStorageAdapter';
export { ClientManagedStorageAdapter } from './ClientManagedStorageAdapter';

// Factory and utilities
export { StorageFactory } from './StorageFactory';