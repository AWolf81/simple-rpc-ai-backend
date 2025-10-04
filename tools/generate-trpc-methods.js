#!/usr/bin/env node

/**
 * Generate trpc-methods.json from tRPC router
 * 
 * This script extracts all tRPC procedures and their metadata
 * to generate a JSON file that can be used by the dev panel.
 */

import { writeFileSync, mkdirSync, readdirSync, existsSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load RC configuration file if present
const isInDist = dirname(fileURLToPath(import.meta.url)).includes('/dist/tools');
const rcConfigPath = isInDist
  ? '../config/rc-loader.js'  // From dist/tools/ -> dist/config/
  : '../dist/config/rc-loader.js';  // From tools/ -> dist/config/

try {
  const { loadRCConfig, applyToEnv } = await import(rcConfigPath);
  const rcConfig = loadRCConfig();
  applyToEnv(rcConfig);
} catch (error) {
  // RC config is optional - silently ignore if not available
}

// Configure base URL for generated endpoints
const baseUrl = `http://localhost:${process.env.AI_SERVER_PORT || 8000}`;

// Helper function to get source location
function getSource() {
  const stack = new Error().stack?.split('\n');
  // Stack: [0] Error, [1] getSource, [2] zWithSource, [3] YOUR SCHEMA DEFINITION
  const callerLine = stack?.[3];
  const match = callerLine?.match(/(.*?):(\d+):/);
  return match ? { filePath: match[1], lineNumber: parseInt(match[2]) } : null;
}

function zWithSource(schema, filePath, lineNumber) {
  const enhanced = schema;
  enhanced._source = { filePath, lineNumber };
  return enhanced;
}

console.log('🔨 Generating tRPC methods documentation...');

// Check if we're in the source tree (has src/trpc/routers)
const isInSourceTree = existsSync('src/trpc/routers');

async function extractTRPCMethods() {
  try {
    // Import the router configuration after TypeScript compilation
    // If running from dist/tools/, go up one level. If from tools/, go up one then into dist
    const isInDist = dirname(fileURLToPath(import.meta.url)).includes('/dist/tools');
    const configPath = isInDist
      ? '../trpc/router-config.js'  // From dist/tools/ -> dist/trpc/
      : '../dist/trpc/router-config.js';  // From tools/ -> dist/trpc/

    const { createRouterForGeneration, loadTRPCGenerationConfig } = await import(configPath);

    // Load base configuration from environment variables
    let config = loadTRPCGenerationConfig();

    // If a custom server file is specified, extract its actual config
    const customServerPath = process.env.TRPC_GEN_CUSTOM_ROUTERS;
    if (customServerPath) {
      try {
        // Resolve path from current working directory
        const resolvedPath = customServerPath.startsWith('/') || customServerPath.startsWith('file://')
          ? customServerPath
          : resolve(process.cwd(), customServerPath);

        const serverModule = await import(resolvedPath);

        // Try to extract server config if available (look for createRpcAiServer call)
        // Read the file to parse the config (since it's not exported)
        const serverFileContent = readFileSync(resolvedPath, 'utf8');

        // Extract MCP config from the file content
        const mcpEnabledMatch = serverFileContent.match(/mcp:\s*\{[^}]*enabled:\s*(true|false)/);
        if (mcpEnabledMatch) {
          const mcpEnabled = mcpEnabledMatch[1] === 'true';
          console.log(`📄 Extracted from ${customServerPath}: mcp.enabled = ${mcpEnabled}`);

          // Override config with actual server settings
          config = {
            ...config,
            mcp: {
              ...config.mcp,
              enabled: mcpEnabled,
              includeInGeneration: mcpEnabled
            }
          };
        }
      } catch (error) {
        console.warn(`⚠️  Could not extract config from ${customServerPath}, using environment config:`, error.message);
      }
    }

    // Create router with configuration filtering
    const router = await createRouterForGeneration(config);
    const methods = {};

    // Store configuration for later use in MCP filtering
    const generationConfig = config;
    
    // Extract procedures from router
    // Use the flattened procedures object for nested routers
    if (router._def && router._def.procedures) {
      const procedures = router._def.procedures;
      
      for (const [procedureName, procedure] of Object.entries(procedures)) {
        methods[procedureName] = extractProcedureInfo(procedure, procedureName);
      }
    }
    
    function inferSourceFile(procedurePath) {
      // Dynamically discover source files from filesystem
      const namespace = procedurePath.split('.')[0];
      
      // First try to find a router file for this namespace
      const routersDir = 'src/trpc/routers';
      if (existsSync(routersDir)) {
        try {
          const files = readdirSync(routersDir);
          const routerFile = files.find(file => 
            file.toLowerCase() === `${namespace.toLowerCase()}.ts` ||
            file.toLowerCase() === `${namespace.toLowerCase()}.js`
          );
          
          if (routerFile) {
            return join(routersDir, routerFile);
          }
          
          // Also check if there's a directory with the namespace name that contains an index.ts
          if (existsSync(join(routersDir, namespace))) {
            const namespaceDir = join(routersDir, namespace);
            const indexPath = join(namespaceDir, 'index.ts');
            if (existsSync(indexPath)) {
              return indexPath;
            }
          }
        } catch (e) {
          // Ignore filesystem errors
        }
      }
      
      // Fallback to root file
      return 'src/trpc/root.ts';
    }
    
    function findProcedureLineNumber(sourceFile, procedureName) {
      // Extract the actual procedure name (last part after the dot)
      const procName = procedureName.split('.').pop();
      const namespace = procedureName.split('.')[0];
      
      // First, try to find the actual procedure file for this namespace
      // Procedures are typically defined in src/trpc/routers/{namespace}/index.ts or similar
      const specificFile = findSpecificProcedureFile(namespace, procName);
      
      if (specificFile) {
        const lineNum = findProcedureLineNumberInFile(specificFile, procName);
        if (lineNum) {
          return lineNum;
        }
      }
      
      // If not found in specific file, check the main source file
      try {
        const content = readFileSync(sourceFile, 'utf8');
        const lines = content.split('\n');
        
        // Look for the procedure definition in the file
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Look for patterns like: procName: procedure(...), or procName: router.query(...), etc.
          if (line.includes(`${procName}:`) || 
              line.includes(`${procName}:`) || 
              line.includes(`.${procName}:`) || 
              line.trim().startsWith(`${procName}:`)) {
            // Return 1-based line number (VSCode uses 1-based indexing)
            return i + 1;
          }
        }
      } catch (e) {
        // Only log if we're in the source tree
        if (isInSourceTree) {
          console.log(`Could not find line number for ${procedureName} in ${sourceFile}:`, e.message);
        }
      }
      
      return null; // Line not found
    }
    
    function findSpecificProcedureFile(namespace, procName) {
      // Look for the procedure in more specific files
      const namespaceDir = `src/trpc/routers/${namespace}`;
      
      if (existsSync(namespaceDir)) {
        try {
          // Check the main index file first
          const mainFile = join(namespaceDir, 'index.ts');
          if (existsSync(mainFile) && fileIncludesProcedure(mainFile, procName)) {
            return mainFile;
          }
          
          // Also check for other common files (like methods/, procedures/, etc.)
          const files = readdirSync(namespaceDir, { withFileTypes: true });
          for (const file of files) {
            const fullPath = join(namespaceDir, file.name);
            
            if (file.isDirectory()) {
              // If it's a subdirectory, check files inside it
              const subDirFiles = readdirSync(fullPath);
              for (const subFile of subDirFiles) {
                if (subFile.endsWith('.ts') || subFile.endsWith('.js')) {
                  const subFilePath = join(fullPath, subFile);
                  if (fileIncludesProcedure(subFilePath, procName)) {
                    return subFilePath;
                  }
                }
              }
            } else if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
              // If it's a regular TS/JS file
              if (fileIncludesProcedure(fullPath, procName)) {
                return fullPath;
              }
            }
          }
        } catch (e) {
          // Ignore filesystem errors
        }
      }
      
      // Check in nested subdirectories (e.g., src/trpc/routers/ai/methods/, etc.)
      const commonSubdirs = ['methods', 'procedures', 'endpoints', 'handlers'];
      for (const subdir of commonSubdirs) {
        const searchPath = `src/trpc/routers/${namespace}/${subdir}`;
        if (existsSync(searchPath)) {
          try {
            const files = readdirSync(searchPath);
            for (const file of files) {
              if (file.endsWith('.ts') || file.endsWith('.js')) {
                const fullPath = join(searchPath, file);
                if (fileIncludesProcedure(fullPath, procName)) {
                  return fullPath;
                }
              }
            }
          } catch (e) {
            // Ignore filesystem errors
          }
        }
      }
      
      return null;
    }
    
    function fileIncludesProcedure(filePath, procName) {
      try {
        const content = readFileSync(filePath, 'utf8');
        return content.includes(procName);
      } catch (e) {
        return false;
      }
    }
    
    function findProcedureLineNumberInFile(filePath, procName) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Look for procedure definition patterns
          if (line.includes(`${procName}:`) || 
              line.trim().startsWith(`${procName}:`) || 
              line.includes(`${procName}(`) || 
              line.includes(`const ${procName}`) ||
              line.includes(`export const ${procName}`)) {
            return i + 1; // 1-based line number
          }
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    function findSchemaLineNumber(sourceFile, procedureName, schemaType) {
      // Extract the actual procedure name (last part after the dot)
      const procName = procedureName.split('.').pop();
      const namespace = procedureName.split('.')[0];
      
      // First, try to find the actual procedure file for this namespace
      const specificFile = findSpecificProcedureFile(namespace, procName);
      
      // Use the file where the procedure is most likely defined
      const fileToSearch = specificFile || sourceFile;
      
      try {
        const content = readFileSync(fileToSearch, 'utf8');
        const lines = content.split('\n');
        
        // Find the procedure definition first
        let procedureStartLine = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes(`${procName}:`) && line.includes('Procedure')) {
            procedureStartLine = i;
            break;
          }
        }
        
        if (procedureStartLine === -1) {
          return null; // Procedure not found
        }
        
        // Search for the schemaType (.input or .output) in the next 15 lines after the procedure start
        const searchEnd = Math.min(procedureStartLine + 15, lines.length);
        
        for (let i = procedureStartLine; i < searchEnd; i++) {
          const line = lines[i];
          // Look for patterns like: .input( or .output( - very simple substring matching
          if (line.includes(`.${schemaType}(`)) {
            return i + 1; // 1-based line number
          }
        }
      } catch (e) {
        // Only log if we're in the source tree
        if (isInSourceTree) {
          console.log(`Could not find ${schemaType} line number for ${procedureName} in ${fileToSearch}:`, e.message);
        }
      }
      
      return null; // Line not found
    }
    
    function checkIfProcedureRequiresAuth(def) {
      // Check if the procedure has any authentication requirements in its middleware
      if (def.middlewares && Array.isArray(def.middlewares)) {
        // Look through the middleware chain for authentication checks
        for (const middleware of def.middlewares) {
          // Check if the middleware is a function that contains authentication logic
          if (typeof middleware === 'function') {
            const middlewareSource = middleware.toString();
            // Look for authentication-related patterns in the middleware
            if (
              // Look for ctx.user checks which indicate protected procedures
              middlewareSource.includes('ctx.user') &&
              (middlewareSource.includes('UNAUTHORIZED') || middlewareSource.includes('Authentication required'))
            ) {
              return true;
            }
          }
        }
      }

      // For procedures with resolvers, also check the resolver function itself
      // This handles cases like admin procedures that use publicProcedure but have
      // auth checks inside the resolver function
      if (def.resolver && typeof def.resolver === 'function') {
        const resolverSource = def.resolver.toString();

        // Look for admin/user authentication checks inside resolver
        if (
          resolverSource.includes('ctx.user') &&
          (resolverSource.includes('FORBIDDEN') || resolverSource.includes('Admin privileges required'))
        ) {
          return true;
        }

        // Enhanced auth detection for patterns in ai.generateText and similar procedures
        if (resolverSource.includes('ctx.user')) {
          // Look for user access patterns that indicate authentication handling
          const authPatterns = [
            // Direct user access patterns
            'const { user } = ctx',
            'ctx.user?.userId',
            'user?.userId',
            'userId = user?.userId',

            // Authentication requirement patterns
            'API key required',
            'apiKey required',
            'Please provide your AI provider API key',
            'BAD_REQUEST.*API key',

            // User-specific execution paths
            'if (userId &&',
            'if (user &&',
            'userType === ',
            'getUserStatus',
            'ensureUserAccount',

            // Payment/auth related errors
            'PAYMENT_REQUIRED',
            'Insufficient token balance',
            'token balance',
            'subscription',

            // BYOK patterns that still require some form of user identification
            'Authenticated BYOK user',
            'byok.*user',
            'user.*byok'
          ];

          for (const pattern of authPatterns) {
            if (resolverSource.match(new RegExp(pattern, 'i'))) {
              return true;
            }
          }

          // Check for branching logic based on user presence
          // This catches procedures that handle both auth and unauth cases
          if (
            resolverSource.includes('if (userId') ||
            resolverSource.includes('if (user') ||
            resolverSource.includes('} else if (userId') ||
            resolverSource.includes('} else if (user')
          ) {
            return true;
          }
        }
      }

      // Additional checks could be implemented here:
      // - Check for specific meta properties that indicate auth requirement
      // - Check for naming patterns (though this is less reliable)

      // By default, assume procedures don't require authentication
      // unless explicitly detected from the middleware chain or resolver
      return false;
    }
    
    function extractProcedureInfo(procedure, path) {
      const def = procedure._def;
      const sourceFile = inferSourceFile(path);
      const lineNumber = findProcedureLineNumber(sourceFile, path);
      
      // Extract source info from schema if available (from zWithSource)
      const inputSchema = def.inputs?.[0] || null;
      const outputSchema = def.output || null;
      
      const inputSource = inputSchema?._source || null;
      const outputSource = outputSchema?._source || null;
      
      // Find specific line numbers for input and output schemas
      const inputLineNumber = inputSource?.lineNumber || findSchemaLineNumber(sourceFile, path, 'input');
      const outputLineNumber = outputSource?.lineNumber || findSchemaLineNumber(sourceFile, path, 'output');
      
      // Determine if this procedure requires authentication
      const requiresAuth = checkIfProcedureRequiresAuth(def);
      
      const info = {
        path,
        type: def.type || 'unknown',
        description: null,
        summary: null,
        tags: [],
        input: null,
        output: null,
        meta: def.meta || null,
        requiresAuth: requiresAuth,
        sourceFile: inputSource?.filePath || outputSource?.filePath || sourceFile,
        lineNumber: lineNumber,
        inputLineNumber: inputLineNumber,
        outputLineNumber: outputLineNumber
      };
      
      // Extract OpenAPI metadata if present
      if (def.meta?.openapi) {
        const openapi = def.meta.openapi;
        info.method = openapi.method;
        info.path = openapi.path;
        info.summary = openapi.summary;
        info.description = openapi.description;
        info.tags = openapi.tags || [];
      }
      
      // Extract input schema info
      if (def.inputs && def.inputs.length > 0) {
        const inputSchema = def.inputs[0];
        info.input = extractZodSchemaInfo(inputSchema);
      }
      
      // Extract output schema info
      if (def.output) {
        info.output = extractZodSchemaInfo(def.output);
      }
      
      return info;
    }
    
    function extractZodSchemaInfo(schema) {
      if (!schema || !schema._def) {
        return { type: 'unknown' };
      }

      const def = schema._def;
      const info = {
        type: def.typeName || 'unknown',
        description: def.description || null,
        _source: schema._source || null  // Preserve source info if available
      };

      // Extract constraints based on schema type
      extractSchemaConstraints(schema, info);

      // Extract shape for objects
      if (def.typeName === 'ZodObject' && def.shape) {
        try {
          const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
          info.properties = {};

          for (const [key, propSchema] of Object.entries(shape)) {
            info.properties[key] = extractZodSchemaInfo(propSchema);
          }
        } catch (e) {
          // Ignore shape extraction errors
        }
      }

      // Extract other useful info
      if (def.innerType) {
        info.innerType = extractZodSchemaInfo(def.innerType);
      }

      return info;
    }

    function extractSchemaConstraints(schema, info) {
      const def = schema._def;

      // Handle different Zod types and their constraints
      switch (def.typeName) {
        case 'ZodString':
          info.jsType = 'string';
          if (def.checks) {
            for (const check of def.checks) {
              if (check.kind === 'min') info.minLength = check.value;
              if (check.kind === 'max') info.maxLength = check.value;
              if (check.kind === 'email') info.format = 'email';
              if (check.kind === 'url') info.format = 'url';
              if (check.kind === 'regex') info.pattern = check.regex.source;
            }
          }
          break;

        case 'ZodNumber':
          info.jsType = 'number';
          if (def.checks) {
            for (const check of def.checks) {
              if (check.kind === 'min') info.minimum = check.value;
              if (check.kind === 'max') info.maximum = check.value;
              if (check.kind === 'int') {
                info.jsType = 'integer';
                info.type = 'integer';
              }
            }
          }
          break;

        case 'ZodBoolean':
          info.jsType = 'boolean';
          break;

        case 'ZodArray':
          info.jsType = 'array';
          if (def.minLength) info.minItems = def.minLength.value;
          if (def.maxLength) info.maxItems = def.maxLength.value;
          if (def.type) info.items = extractZodSchemaInfo(def.type);
          break;

        case 'ZodObject':
          info.jsType = 'object';
          break;

        case 'ZodEnum':
          info.jsType = 'enum';
          if (def.values) info.enum = def.values;
          break;

        case 'ZodLiteral':
          info.jsType = 'literal';
          info.const = def.value;
          break;

        case 'ZodUnion':
          info.jsType = 'union';
          if (def.options) {
            info.oneOf = def.options.map(opt => extractZodSchemaInfo(opt));
          }
          break;

        case 'ZodDefault':
          try {
            info.default = def.defaultValue();
          } catch (e) {
            // If default value can't be computed, mark it as having a default
            info.hasDefault = true;
          }
          if (def.innerType) {
            const innerInfo = extractZodSchemaInfo(def.innerType);
            Object.assign(info, innerInfo);
          }
          break;

        case 'ZodOptional':
          info.optional = true;
          if (def.innerType) {
            const innerInfo = extractZodSchemaInfo(def.innerType);
            Object.assign(info, innerInfo);
          }
          break;

        case 'ZodNullable':
          info.nullable = true;
          if (def.innerType) {
            const innerInfo = extractZodSchemaInfo(def.innerType);
            Object.assign(info, innerInfo);
          }
          break;

        case 'ZodVoid':
          info.jsType = 'void';
          break;

        case 'ZodAny':
          info.jsType = 'any';
          break;

        case 'ZodUnknown':
          info.jsType = 'unknown';
          break;
      }
    }

    // Filter out MCP namespace if MCP is disabled
    const includeMCPMethods = generationConfig.mcp?.enabled && generationConfig.mcp?.includeInGeneration;

    if (!includeMCPMethods) {
      // Remove all mcp.* procedures
      const mcpProcedureNames = Object.keys(methods).filter(name => name.startsWith('mcp.'));
      mcpProcedureNames.forEach(name => delete methods[name]);
      console.log(`🚫 MCP disabled - filtered out ${mcpProcedureNames.length} mcp.* procedures`);
    }

    const mcpMethods = {};
    const mcpToolIndex = {};
    const includeAITools = generationConfig.mcp?.ai?.enabled && generationConfig.mcp?.ai?.includeAIToolsInGeneration;

    // Log namespace whitelist if configured
    if (generationConfig.namespaceWhitelist && generationConfig.namespaceWhitelist.length > 0) {
      console.log(`🔍 Namespace whitelist active: [${generationConfig.namespaceWhitelist.join(', ')}]`);
    }

    const mcpProcedures = includeMCPMethods
      ? Object.entries(methods).filter(([name, method]) => {
          if (!method.meta?.mcp) return false;

          // If AI tools are disabled, exclude AI-powered MCP tools
          if (!includeAITools && method.meta.mcp.requiresAI) {
            return false;
          }

          // Apply namespace whitelist filtering
          if (generationConfig.namespaceWhitelist && generationConfig.namespaceWhitelist.length > 0) {
            const namespace = name.includes('.') ? name.split('.')[0] : name;
            if (!generationConfig.namespaceWhitelist.includes(namespace)) {
              console.log(`🚫 Tool ${name} filtered out: namespace "${namespace}" not in whitelist [${generationConfig.namespaceWhitelist.join(', ')}]`);
              return false;
            }
          }

          return true;
        })
      : [];
    
    for (const [name, method] of mcpProcedures) {
      const mcpMeta = method.meta.mcp;
      const procedureName = name;
      const httpMethod = method.type === 'mutation' ? 'POST' : 'GET';
      const toolName = (mcpMeta?.toolName || mcpMeta?.name || procedureName.split('.').pop() || procedureName).trim();

      if (!toolName) {
        console.error(`❌ MCP tool detected without a valid name: ${procedureName}`);
        throw new Error(`MCP tool '${procedureName}' does not specify a tool name`);
      }

      if (mcpToolIndex[toolName]) {
        const conflictWith = mcpToolIndex[toolName];
        console.error(`❌ Duplicate MCP tool name detected: '${toolName}' used by both '${conflictWith}' and '${procedureName}'`);
        throw new Error(`Duplicate MCP tool name '${toolName}' detected in procedures '${conflictWith}' and '${procedureName}'. Tool names must be unique.`);
      }

      mcpToolIndex[toolName] = procedureName;
      
      mcpMethods[name] = {
        toolName,
        procedure: procedureName,
        title: mcpMeta.title || mcpMeta.name || mcpMeta.description || `Tool ${name}`,
        description: mcpMeta.description,
        category: mcpMeta.category || 'general',
        type: method.type,
        calling: {
          mcp: {
            endpoint: `${baseUrl}/mcp`,
            method: 'tools/call',
            example: {
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: generateExampleArgs(method.input)
              }
            }
          },
          trpc: {
            endpoint: `${baseUrl}/trpc/${procedureName}`,
            method: httpMethod,
            example: httpMethod === 'GET' 
              ? `curl -X GET "${baseUrl}/trpc/${procedureName}?batch=1&input=%7B%220%22%3A%7B%22json%22%3A${encodeURIComponent(JSON.stringify(generateExampleArgs(method.input)))}%7D%7D"`
              : `curl -X POST "${baseUrl}/trpc/${procedureName}?batch=1" -H "Content-Type: application/json" -d '[{"0":{"json":${JSON.stringify(generateExampleArgs(method.input))}}}]'`
          },
          jsonRpc: {
            endpoint: `${baseUrl}/rpc`,
            method: procedureName,
            example: {
              jsonrpc: '2.0',
              id: 1,
              method: procedureName,
              params: generateExampleArgs(method.input)
            }
          }
        }
      };
    }
    
    function generateExampleArgs(inputSchema) {
      if (!inputSchema || !inputSchema.properties) {
        return {};
      }
      
      const args = {};
      
      function getBaseType(schema) {
        if (!schema) return null;
        
        // Recursively unwrap nested types (ZodDefault -> ZodOptional -> ZodString)
        if (schema.innerType) {
          return getBaseType(schema.innerType);
        }
        
        return schema.type;
      }
      
      for (const [key, prop] of Object.entries(inputSchema.properties)) {
        const baseType = getBaseType(prop);
        
        switch (baseType) {
          case 'ZodString':
            if (key === 'name') args[key] = 'World';
            else if (key === 'message') args[key] = 'Hello MCP';
            else if (key === 'language') args[key] = 'en';
            else args[key] = 'example';
            break;
          case 'ZodBoolean':
            args[key] = key === 'uppercase';
            break;
          case 'ZodNumber':
            args[key] = key === 'repeat' ? 2 : 42;
            break;
          default:
            // Fallback based on field names
            if (key === 'name') args[key] = 'World';
            else if (key === 'message') args[key] = 'Hello MCP';
            else if (key === 'language') args[key] = 'en';
            else if (key === 'uppercase') args[key] = true;
            else if (key === 'repeat') args[key] = 2;
            else args[key] = 'example';
        }
      }
      return args;
    }

    // Note: We include all base procedures in the build (ai, mcp, system, etc.)
    // Consumers can choose which routers to enable at server runtime via config
    // This ensures the package distribution has all features available

    const documentation = {
      generated: new Date().toISOString(),
      version: '1.0.0',
      description: 'tRPC procedure documentation extracted from router',
      configuration: {
        ai: {
          enabled: generationConfig.ai?.enabled ?? false,
          includedInGeneration: generationConfig.ai?.includeInGeneration ?? false
        },
        mcp: {
          enabled: generationConfig.mcp?.enabled ?? false,
          includedInGeneration: generationConfig.mcp?.includeInGeneration ?? false,
          ai: {
            enabled: generationConfig.mcp?.ai?.enabled ?? false,
            includedInGeneration: generationConfig.mcp?.ai?.includeAIToolsInGeneration ?? false
          }
        }
      },
      procedures: methods,
      mcp: {
        available: Object.keys(mcpMethods).length > 0,
        enabled: includeMCPMethods,
        methods: mcpMethods,
        endpoint: `${baseUrl}/mcp`,
        toolIndex: mcpToolIndex,
        protocolVersion: '2024-11-05'
      },
      stats: {
        totalProcedures: Object.keys(methods).length,
        queries: Object.values(methods).filter(m => m.type === 'query').length,
        mutations: Object.values(methods).filter(m => m.type === 'mutation').length,
        subscriptions: Object.values(methods).filter(m => m.type === 'subscription').length,
        mcpMethods: Object.keys(mcpMethods).length,
        uniqueMcpTools: Object.keys(mcpToolIndex).length
      }
    };
    
    return documentation;
    
  } catch (error) {
    console.error('❌ Failed to extract tRPC methods:', error.message);
    console.error('Stack:', error.stack);
    
    // Return minimal fallback structure
    return {
      generated: new Date().toISOString(),
      version: '1.0.0',
      description: 'Failed to extract tRPC methods - fallback structure',
      error: error.message,
      configuration: {
        ai: {
          enabled: false,
          includedInGeneration: false
        },
        mcp: {
          enabled: false,
          includedInGeneration: false,
          ai: {
            enabled: false,
            includedInGeneration: false
          }
        }
      },
      procedures: {},
      stats: {
        totalProcedures: 0,
        queries: 0,
        mutations: 0,
        subscriptions: 0
      }
    };
  }
}

async function main() {
  const documentation = await extractTRPCMethods();
  
  // Ensure dist directory exists
  mkdirSync('dist', { recursive: true });
  
  // Write the methods file
  const outputPath = 'dist/trpc-methods.json';
  writeFileSync(outputPath, JSON.stringify(documentation, null, 2));
  
  console.log(`✅ Generated ${outputPath}`);
  console.log(`📊 Found ${documentation.stats.totalProcedures} procedures:`);
  console.log(`   - ${documentation.stats.queries} queries`);
  console.log(`   - ${documentation.stats.mutations} mutations`);
  console.log(`   - ${documentation.stats.subscriptions} subscriptions`);

  // Show configuration status
  if (documentation.configuration) {
    console.log(`⚙️  Generation Configuration:`);
    const aiEnabled = documentation.configuration.ai?.enabled ?? false;
    const mcpEnabled = documentation.configuration.mcp?.enabled ?? false;
    const mcpAiEnabled = documentation.configuration.mcp?.ai?.enabled ?? false;
    console.log(`   - AI: ${aiEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   - MCP: ${mcpEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    if (mcpEnabled) {
      console.log(`   - MCP AI Tools: ${mcpAiEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    }
  }

  if (documentation.mcp?.enabled && documentation.mcp.available) {
    console.log(`🔧 MCP Integration:`);
    console.log(`   - ${documentation.stats.mcpMethods} MCP tools available`);
    console.log(`   - Endpoint: ${documentation.mcp.endpoint}`);
    console.log(`   - Protocol: ${documentation.mcp.protocolVersion}`);

    if (documentation.stats.mcpMethods > 0) {
      console.log(`🛠️  Available MCP Tools:`);
      for (const [name, tool] of Object.entries(documentation.mcp.methods)) {
        const toolName = name.split('.').pop();
        console.log(`   📋 ${toolName}: ${tool.title}`);
        console.log(`      🔹 MCP: POST ${tool.calling.mcp.endpoint}`);
        console.log(`      🔹 tRPC: ${tool.calling.trpc.method} ${tool.calling.trpc.endpoint}`);
        console.log(`      🔹 JSON-RPC: POST ${tool.calling.jsonRpc.endpoint} (method: ${tool.calling.jsonRpc.method})`);
      }
    }
  } else if (documentation.configuration?.mcp?.enabled) {
    console.log(`🔧 MCP Integration: Enabled but no tools found (add .meta({ mcp: {...} }) to procedures)`);
  } else {
    console.log(`🔧 MCP Integration: ❌ Disabled in configuration`);
  }
  
  if (documentation.error) {
    console.error(`⚠️  Generation completed with error: ${documentation.error}`);
    process.exit(1);
  }

  // Force exit to prevent hanging due to async operations (ModelRegistry, etc.)
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
