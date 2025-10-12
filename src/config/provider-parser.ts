/**
 * Provider Configuration Parser and Validator
 *
 * Handles runtime parsing and validation of provider configurations,
 * supporting both simple string form and extended object form.
 */

import type { BuiltInProvider, ProviderConfig } from '../rpc-ai-server.js';
import { logger } from '../utils/logger.js';

export interface ParsedProvider {
  name: string;
  apiKey?: string;
  defaultModel?: string;
  systemPrompts?: Record<string, string>;
  modelRestrictions?: {
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
  };
  type?: BuiltInProvider;
  baseUrl?: string;
  apiKeyHeader?: string;
  apiKeyPrefix?: string;
  isCustom: boolean;
  isByok: boolean;
}

export interface ProviderParseResult {
  providers: ParsedProvider[];
  errors: string[];
  warnings: string[];
}

/**
 * Environment variable mapping for built-in providers
 */
const PROVIDER_ENV_VARS: Record<string, string> = {
  'anthropic': 'ANTHROPIC_API_KEY',
  'openai': 'OPENAI_API_KEY',
  'google': 'GOOGLE_API_KEY',
  'openrouter': 'OPENROUTER_API_KEY',
  'huggingface': 'HUGGINGFACE_API_KEY'
};

/**
 * Built-in provider names
 */
const BUILT_IN_PROVIDERS: Set<string> = new Set([
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'huggingface'
]);

/**
 * Parse a single provider configuration (string or object)
 */
function parseProvider(
  input: string | ProviderConfig,
  isByok: boolean = false
): { provider: ParsedProvider | null; error?: string; warning?: string } {
  // Handle null/undefined/invalid input
  if (!input) {
    return {
      provider: null,
      error: `Invalid provider configuration: ${JSON.stringify(input)}`
    };
  }

  // Simple string form
  if (typeof input === 'string') {
    const name = input.toLowerCase();
    const envVar = PROVIDER_ENV_VARS[name];
    const apiKey = envVar ? process.env[envVar] : undefined;

    const provider: ParsedProvider = {
      name,
      apiKey,
      isCustom: !BUILT_IN_PROVIDERS.has(name),
      isByok
    };

    // Warn if built-in provider has no API key
    if (BUILT_IN_PROVIDERS.has(name) && !apiKey) {
      return {
        provider,
        warning: `Provider '${name}' has no API key. Set ${envVar} environment variable.`
      };
    }

    return { provider };
  }

  // Extended object form
  if (typeof input === 'object' && input.name) {
    const name = input.name.toLowerCase();
    const isBuiltIn = BUILT_IN_PROVIDERS.has(name);

    // Determine API key source
    let apiKey = input.apiKey;
    if (!apiKey && isBuiltIn) {
      const envVar = PROVIDER_ENV_VARS[name];
      apiKey = envVar ? process.env[envVar] : undefined;
    }

    const provider: ParsedProvider = {
      name,
      apiKey,
      defaultModel: input.defaultModel,
      systemPrompts: input.systemPrompts,
      modelRestrictions: input.modelRestrictions,
      type: input.type,
      baseUrl: input.baseUrl,
      apiKeyHeader: input.apiKeyHeader,
      apiKeyPrefix: input.apiKeyPrefix,
      isCustom: !isBuiltIn || !!input.type || !!input.baseUrl,
      isByok
    };

    // Validation for custom providers
    if (provider.isCustom) {
      if (!input.type && !isBuiltIn) {
        return {
          provider: null,
          error: `Custom provider '${name}' must specify 'type' (e.g., 'openai', 'anthropic', 'google')`
        };
      }
      if (input.baseUrl && !input.type && !isBuiltIn) {
        return {
          provider: null,
          error: `Custom provider '${name}' with 'baseUrl' must specify 'type'`
        };
      }
    }

    // Warn if no API key
    if (!apiKey) {
      const envVar = PROVIDER_ENV_VARS[name];
      return {
        provider,
        warning: envVar
          ? `Provider '${name}' has no API key. Set ${envVar} environment variable or provide 'apiKey' in config.`
          : `Provider '${name}' has no API key. Provide 'apiKey' in config.`
      };
    }

    return { provider };
  }

  return {
    provider: null,
    error: `Invalid provider configuration: ${JSON.stringify(input)}`
  };
}

/**
 * Parse and validate provider configurations
 */
export function parseProviders(
  providers?: (string | ProviderConfig)[],
  serverProviders?: string[],
  byokProviders?: string[]
): ProviderParseResult {
  const result: ProviderParseResult = {
    providers: [],
    errors: [],
    warnings: []
  };

  // New unified API (providers array)
  if (providers && providers.length > 0) {
    logger.debug('Parsing unified provider configuration', { count: providers.length });

    for (const input of providers) {
      const { provider, error, warning } = parseProvider(input, false);

      if (error) {
        result.errors.push(error);
      } else if (provider) {
        result.providers.push(provider);
        if (warning) {
          result.warnings.push(warning);
        }
      }
    }
  }
  // Legacy API (serverProviders + byokProviders)
  else {
    // Parse server providers
    if (serverProviders && serverProviders.length > 0) {
      logger.debug('Parsing legacy serverProviders configuration', { count: serverProviders.length });

      for (const name of serverProviders) {
        const { provider, error, warning } = parseProvider(name, false);

        if (error) {
          result.errors.push(error);
        } else if (provider) {
          result.providers.push(provider);
          if (warning) {
            result.warnings.push(warning);
          }
        }
      }
    }

    // Parse BYOK providers
    if (byokProviders && byokProviders.length > 0) {
      logger.debug('Parsing legacy byokProviders configuration', { count: byokProviders.length });

      for (const name of byokProviders) {
        // Skip if already added as server provider
        if (result.providers.some(p => p.name === name)) {
          continue;
        }

        const { provider, error, warning } = parseProvider(name, true);

        if (error) {
          result.errors.push(error);
        } else if (provider) {
          result.providers.push(provider);
          if (warning) {
            result.warnings.push(warning);
          }
        }
      }
    }
  }

  // Validate uniqueness
  const names = new Set<string>();
  for (const provider of result.providers) {
    if (names.has(provider.name)) {
      result.errors.push(`Duplicate provider configuration: '${provider.name}'`);
    }
    names.add(provider.name);
  }

  logger.debug('Provider parsing complete', {
    providerCount: result.providers.length,
    errorCount: result.errors.length,
    warningCount: result.warnings.length
  });

  return result;
}

/**
 * Validate provider configuration at runtime
 */
export function validateProviderConfig(
  providerName: string,
  parsedProviders: ParsedProvider[]
): { valid: boolean; error?: string } {
  const provider = parsedProviders.find(p => p.name === providerName);

  if (!provider) {
    return {
      valid: false,
      error: `Provider '${providerName}' not found in configuration. Available: ${parsedProviders.map(p => p.name).join(', ')}`
    };
  }

  if (!provider.apiKey && !provider.isByok) {
    return {
      valid: false,
      error: `Provider '${providerName}' has no API key configured`
    };
  }

  return { valid: true };
}

/**
 * Get provider configuration by name
 */
export function getProviderConfig(
  providerName: string,
  parsedProviders: ParsedProvider[]
): ParsedProvider | undefined {
  return parsedProviders.find(p => p.name === providerName);
}

/**
 * Merge provider-specific and global configurations
 */
export function mergeProviderConfig(
  provider: ParsedProvider,
  globalSystemPrompts?: Record<string, string>,
  globalModelRestrictions?: Record<string, {
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
  }>
): ParsedProvider {
  return {
    ...provider,
    systemPrompts: {
      ...globalSystemPrompts,
      ...provider.systemPrompts
    },
    modelRestrictions: {
      ...globalModelRestrictions?.[provider.name],
      ...provider.modelRestrictions
    }
  };
}
