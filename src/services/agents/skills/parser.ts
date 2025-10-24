/**
 * SKILL.md Parser
 *
 * Parses SKILL.md files with YAML frontmatter and markdown content.
 * Implements progressive disclosure by separating metadata from instructions.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { SkillMetadata, SkillScript } from './types';
import { logger } from '../../../utils/logger';

/**
 * Parse result from SKILL.md
 */
export interface ParsedSkill {
  metadata: SkillMetadata;
  instructions: string;
  rawFrontmatter: string;
  rawContent: string;
}

/**
 * Parse SKILL.md file
 */
export async function parseSkillFile(skillPath: string): Promise<ParsedSkill> {
  const content = await fs.readFile(skillPath, 'utf-8');
  return parseSkillContent(content);
}

/**
 * Parse SKILL.md content string
 */
export function parseSkillContent(content: string): ParsedSkill {
  // Match YAML frontmatter (--- ... ---)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error('Invalid SKILL.md format: missing YAML frontmatter (--- ... ---)');
  }

  const [, rawFrontmatter, instructions] = frontmatterMatch;

  // Parse YAML frontmatter
  const metadata = parseYamlFrontmatter(rawFrontmatter);

  // Validate required fields
  validateMetadata(metadata);

  return {
    metadata,
    instructions: instructions.trim(),
    rawFrontmatter,
    rawContent: content
  };
}

/**
 * Parse YAML frontmatter into metadata object
 */
export function parseYamlFrontmatter(yamlContent: string): SkillMetadata {
  try {
    const parsed = yaml.load(yamlContent);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('YAML frontmatter must be an object');
    }

    return parsed as SkillMetadata;
  } catch (error) {
    throw new Error(`Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse YAML value (handle strings, numbers, booleans, arrays)
 */
function parseValue(value: string): any {
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Null/undefined
  if (value === 'null' || value === '~') return null;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value.includes('.') ? parseFloat(value) : parseInt(value, 10);
  }

  // Array (inline format: [item1, item2])
  if (value.startsWith('[') && value.endsWith(']')) {
    const items = value.slice(1, -1).split(',').map(s => s.trim());
    return items.map(parseValue);
  }

  // String
  return value;
}

/**
 * Validate required metadata fields
 */
function validateMetadata(metadata: SkillMetadata): void {
  const errors: string[] = [];

  // Required: name
  if (!metadata.name || typeof metadata.name !== 'string') {
    errors.push('Missing required field: name');
  } else if (metadata.name.length > 64) {
    errors.push('name must be 64 characters or less');
  }

  // Required: description
  if (!metadata.description || typeof metadata.description !== 'string') {
    errors.push('Missing required field: description');
  } else if (metadata.description.length > 1024) {
    errors.push('description must be 1024 characters or less');
  }

  // Optional but validated: scripts
  if (metadata.scripts) {
    if (!Array.isArray(metadata.scripts)) {
      errors.push('scripts must be an array');
    } else {
      metadata.scripts.forEach((script, idx) => {
        if (!script.path) {
          errors.push(`scripts[${idx}] missing required field: path`);
        }
        if (!script.runtime) {
          errors.push(`scripts[${idx}] missing required field: runtime`);
        }
        if (script.runtime && !['python', 'typescript', 'javascript', 'shell'].includes(script.runtime)) {
          errors.push(`scripts[${idx}] invalid runtime: ${script.runtime} (must be python, typescript, javascript, or shell)`);
        }
        if (script.args !== undefined) {
          if (!Array.isArray(script.args)) {
            errors.push(`scripts[${idx}].args must be an array when provided`);
          } else {
            script.args.forEach((arg: any, argIdx: number) => {
              if (!arg || typeof arg !== 'object') {
                errors.push(`scripts[${idx}].args[${argIdx}] must be an object`);
                return;
              }
              if (!arg.name || typeof arg.name !== 'string') {
                errors.push(`scripts[${idx}].args[${argIdx}] missing required field: name`);
              }
              if (arg.type && !['string', 'number', 'boolean'].includes(arg.type)) {
                errors.push(`scripts[${idx}].args[${argIdx}] has invalid type: ${arg.type}`);
              }
            });
          }
        }
      });
    }
  }

  // Optional but validated: allowedPaths
  if (metadata.allowedPaths && !Array.isArray(metadata.allowedPaths)) {
    errors.push('allowedPaths must be an array');
  }

  // Optional but validated: capabilities
  if (metadata.capabilities && !Array.isArray(metadata.capabilities)) {
    errors.push('capabilities must be an array');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid SKILL.md metadata:\n${errors.join('\n')}`);
  }
}

/**
 * Count tokens in text (simple approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  // Simple approximation: average ~4 characters per token
  // This is conservative (actual tokens may be fewer)
  return Math.ceil(text.length / 4);
}

/**
 * Validate skill structure and token limits
 */
export function validateSkillStructure(
  parsed: ParsedSkill,
  config: { maxLevel1Tokens: number; maxLevel2Tokens: number }
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Level 1: Metadata token count
  const level1Tokens = estimateTokens(parsed.rawFrontmatter);
  if (level1Tokens > config.maxLevel1Tokens) {
    warnings.push(
      `Metadata exceeds recommended limit: ${level1Tokens} tokens (max: ${config.maxLevel1Tokens})`
    );
  }

  // Level 2: Instructions token count
  const level2Tokens = estimateTokens(parsed.instructions);
  if (level2Tokens > config.maxLevel2Tokens) {
    warnings.push(
      `Instructions exceed recommended limit: ${level2Tokens} tokens (max: ${config.maxLevel2Tokens})`
    );
    warnings.push(
      'Consider moving detailed content to references/ directory'
    );
  }

  // Metadata validation
  if (!parsed.metadata.name) {
    errors.push('Missing required field: name');
  }

  if (!parsed.metadata.description) {
    errors.push('Missing required field: description');
  }

  // Instructions validation
  if (!parsed.instructions || parsed.instructions.length === 0) {
    warnings.push('SKILL.md has no body content (instructions are empty)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Load and parse skill directory
 */
export async function loadSkillDirectory(basePath: string): Promise<{
  parsed: ParsedSkill;
  resourcePaths: {
    references: string[];
    scripts: string[];
    commands: string[];
    templates: string[];
    examples: string[];
    other: string[];
  };
}> {
  // Parse SKILL.md
  const skillMdPath = path.join(basePath, 'SKILL.md');
  const parsed = await parseSkillFile(skillMdPath);

  // Discover resource directories
  const resourcePaths = {
    references: await findFilesInDirectory(path.join(basePath, 'references')),
    scripts: await findFilesInDirectory(path.join(basePath, 'scripts')),
    commands: await findFilesInDirectory(path.join(basePath, 'commands')),
    templates: await findFilesInDirectory(path.join(basePath, 'templates')),
    examples: await findFilesInDirectory(path.join(basePath, 'examples')),
    other: [] as string[]
  };

  // Find any other files not in known directories
  try {
    const allFiles = await fs.readdir(basePath, { withFileTypes: true });
    for (const entry of allFiles) {
      if (entry.isFile() && entry.name !== 'SKILL.md') {
        resourcePaths.other.push(path.join(basePath, entry.name));
      }
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
    logger.debug(`Could not read skill directory: ${basePath}`);
  }

  return { parsed, resourcePaths };
}

/**
 * Find all files in a directory recursively
 */
async function findFilesInDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subFiles = await findFilesInDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
    logger.debug(`Could not read directory: ${dirPath}`);
  }

  return files;
}

/**
 * Extract skill ID from path or name
 */
export function extractSkillId(skillPath: string, metadata: SkillMetadata): string {
  // Use metadata name if available, otherwise derive from path
  const baseName = path.basename(skillPath);
  const id = metadata.name || baseName;

  // Normalize to lowercase with hyphens
  return id
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
