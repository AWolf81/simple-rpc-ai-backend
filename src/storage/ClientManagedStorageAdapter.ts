/**
 * Client-Managed Storage Adapter
 * 
 * No server-side storage - API keys passed directly in requests
 * Perfect for VS Code secure storage integration
 */

import { StorageAdapter } from './StorageAdapter';
import * as winston from 'winston';

export class ClientManagedStorageAdapter implements StorageAdapter {
  private logger: winston.Logger;

  constructor(logger?: winston.Logger) {
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Client-managed storage initialized - no server-side storage');
  }

  async storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string> {
    throw new Error('Client-managed storage does not support server-side key storage. Keys must be passed in requests.');
  }

  async getApiKey(provider: string, userId?: string): Promise<string | null> {
    // Keys are not stored server-side
    return null;
  }

  async deleteApiKey(provider: string, userId?: string): Promise<boolean> {
    throw new Error('Client-managed storage does not support server-side key deletion.');
  }

  async listProviders(userId?: string): Promise<Array<{provider: string, hasKey: boolean}>> {
    // Return all providers as having no keys (client manages them)
    const providers = ['anthropic', 'openai', 'google', 'deepseek', 'openrouter'];
    
    return providers.map(provider => ({
      provider,
      hasKey: false // Always false as keys are client-managed
    }));
  }

  async rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string> {
    throw new Error('Client-managed storage does not support server-side key rotation. Client must handle key updates.');
  }

  async validateApiKey(provider: string, userId?: string): Promise<boolean> {
    // Cannot validate without the key
    return false;
  }

  async healthCheck(): Promise<{status: 'healthy' | 'unhealthy', details: any}> {
    return {
      status: 'healthy',
      details: {
        type: 'client_managed',
        message: 'No server-side storage - keys passed in requests',
        supportedProviders: ['anthropic', 'openai', 'google', 'deepseek', 'openrouter'],
      }
    };
  }

  getType(): 'client_managed' {
    return 'client_managed';
  }

  /**
   * Validate that an API key was provided in the request
   */
  static validateRequestApiKey(apiKey?: string): boolean {
    return !!(apiKey && apiKey.length > 0);
  }

  /**
   * Extract provider from API key format (basic validation)
   */
  static inferProvider(apiKey: string): string | null {
    if (apiKey.startsWith('sk-')) {
      return 'openai';
    }
    if (apiKey.startsWith('claude-')) {
      return 'anthropic';  
    }
    if (apiKey.startsWith('AI') || apiKey.toLowerCase().includes('gemini')) {
      return 'google';
    }
    
    // Could not infer provider
    return null;
  }

  /**
   * Validate API key format for known providers
   */
  static validateApiKeyFormat(provider: string, apiKey: string): boolean {
    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-') && apiKey.length >= 20;
      
      case 'anthropic':
        return (apiKey.startsWith('claude-') || apiKey.startsWith('sk-ant-')) && apiKey.length >= 20;
      
      case 'google':
        return apiKey.length >= 20; // More flexible for Google
      
      case 'deepseek':
        return apiKey.length >= 20;
      
      case 'openrouter':
        return apiKey.length >= 20;
      
      default:
        return apiKey.length >= 10; // Minimal validation for unknown providers
    }
  }
}