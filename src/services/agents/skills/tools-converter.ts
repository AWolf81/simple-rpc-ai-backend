/**
 * Skills Tool Converter
 *
 * Converts skill scripts into AI SDK tool format for natural language invocation
 */

import type { SkillManager } from './manager';
import type { Skill, SkillScript, SkillScriptArgument } from './types';
import { logger } from '../../../utils/logger';

export interface SkillTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any) => Promise<any>;
}

export class SkillsToolConverter {
  constructor(private skillManager: SkillManager) {}

  /**
   * Convert skill scripts to AI SDK tool format
   *
   * Each script becomes a callable tool that the AI can invoke
   */
  convertSkillsToTools(skillIds?: string[]): SkillTool[] {
    const skills = skillIds
      ? skillIds.map(id => this.skillManager.get(id)).filter(Boolean) as Skill[]
      : this.skillManager.getAll();

    const tools: SkillTool[] = [];
    const toolNames = new Set<string>();

    for (const skill of skills) {
      if (!skill.metadata.scripts || skill.metadata.scripts.length === 0) {
        continue;
      }

      // Convert each script to a tool
      for (const script of skill.metadata.scripts) {
        const baseName = this.generateToolName(skill.id, script.path);

        // Only register ONE tool per script to avoid duplicate tool_result blocks
        // Use underscores only (more compatible with AI SDKs)
        const toolName = baseName.replace(/-/g, '_');

        // Skip if already registered
        if (toolNames.has(toolName)) {
          logger.debug(`⏭️  Skipping duplicate tool: ${toolName}`);
          continue;
        }

        const scriptWithMeta = script as SkillScript;

        tools.push({
          name: toolName,
          description: `${skill.metadata.description} - ${script.description || 'Execute script'}`,
          inputSchema: this.generateParametersSchema(scriptWithMeta),
          execute: async (toolArgs: any) => {
            logger.debug(`🎯 Executing skill tool: ${toolName}`, { toolArgs });

        try {
          const { scriptArgs, stdin, cwd } = this.normalizeToolArguments(
            scriptWithMeta,
            toolArgs
          );

              logger.debug(`🔧 Parsed script args:`, { scriptArgs, stdin, cwd });

              const result = await this.skillManager.executeScript(skill.id, {
                scriptName: script.path,
                args: scriptArgs,
                stdin,
                cwd
              });

              // Return structured result
              return {
                success: result.exitCode === 0,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
              duration: result.duration
            };
          } catch (error) {
            logger.debug(`Skill tool execution failed: ${toolName}`, error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
          }
        });

        toolNames.add(toolName);
        logger.debug(`🛠️  Registered skill tool: ${toolName}`);
      }
    }

    logger.debug(`🔧 Converted ${tools.length} skill scripts to tools from ${skills.length} skills`);
    return tools;
  }

  /**
   * Generate a unique tool name from skill ID and script path
   */
  private generateToolName(skillId: string, scriptPath: string): string {
    const sanitize = (value: string) => value
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^-+|-+$/g, '')
      .replace(/^_+|_+$/g, '')
      .replace(/-{2,}/g, '-');

    const normalizedSkillId = sanitize(skillId);

    const scriptName = sanitize(
      scriptPath
        .replace(/^scripts\//, '')
        .replace(/\.(ts|js|py|sh)$/i, '')
    );

    return `${normalizedSkillId}_${scriptName}`;
  }

  /**
   * Generate JSON Schema for script parameters
   *
   * This creates a flexible schema that accepts:
   * - args: array of string arguments
   * - stdin: optional string input
   * - cwd: optional working directory
   */
  private generateParametersSchema(script: SkillScript): any {
    const argDefinitions = Array.isArray(script.args) ? script.args : [];

    return {
      type: 'object',
      properties: {
        ...this.generateArgumentProperties(argDefinitions),
        args: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Arguments to pass to the script'
        },
        stdin: {
          type: 'string',
          description: 'Standard input to pass to the script'
        },
        cwd: {
          type: 'string',
          description: 'Working directory for script execution'
        }
      },
      required: this.computeRequiredFields(argDefinitions)
    };
  }

  private generateArgumentProperties(args: SkillScriptArgument[]): Record<string, any> {
    const properties: Record<string, any> = {};

    for (const arg of args) {
      const propertySchema: Record<string, any> = {};
      const argType = arg.type || 'string';

      if (arg.multiple) {
        propertySchema.type = 'array';
        propertySchema.items = {
          type: argType === 'number' ? 'number' : argType === 'boolean' ? 'boolean' : 'string'
        };
      } else {
        propertySchema.type =
          argType === 'number' ? 'number' :
          argType === 'boolean' ? 'boolean' :
          'string';
      }

      if (arg.description) {
        propertySchema.description = arg.description;
      }

      if (arg.enum) {
        propertySchema.enum = arg.enum;
      }

      if (arg.default !== undefined) {
        propertySchema.default = arg.default;
      }

      properties[arg.name] = propertySchema;
    }

    return properties;
  }

  private computeRequiredFields(args: SkillScriptArgument[]): string[] {
    return args.filter(arg => arg.required).map(arg => arg.name);
  }

  private normalizeToolArguments(
    script: SkillScript,
    toolArgs: any
  ): { scriptArgs: string[]; stdin?: string; cwd?: string } {
    let scriptArgs: string[] = [];
    let stdin: string | undefined;
    let cwd: string | undefined;

    if (toolArgs && typeof toolArgs === 'object') {
      stdin = typeof toolArgs.stdin === 'string' ? toolArgs.stdin : undefined;
      cwd = typeof toolArgs.cwd === 'string' ? toolArgs.cwd : undefined;
    }

    const hasExplicitArgsArray =
      toolArgs &&
      typeof toolArgs === 'object' &&
      Array.isArray(toolArgs.args);

    if (hasExplicitArgsArray) {
      scriptArgs = (toolArgs.args as unknown[]).map(value => String(value));
    } else if (Array.isArray(script.args) && script.args.length > 0) {
      scriptArgs = this.buildArgsFromDefinitions(script.path, script.args, toolArgs);
    } else if (toolArgs && typeof toolArgs === 'object') {
      scriptArgs = Object.entries(toolArgs)
        .filter(([key, value]) =>
          value !== undefined &&
          value !== null &&
          key !== 'stdin' &&
          key !== 'cwd'
        )
        .map(([, value]) => String(value));
    } else if (toolArgs !== undefined && toolArgs !== null) {
      scriptArgs = [String(toolArgs)];
    }

    return { scriptArgs, stdin, cwd };
  }

  private buildArgsFromDefinitions(
    scriptPath: string,
    definitions: SkillScriptArgument[],
    toolArgs: any
  ): string[] {
    const args: string[] = [];
    const argSource = toolArgs && typeof toolArgs === 'object' ? toolArgs : {};

    for (const definition of definitions) {
      const rawValue = (argSource as Record<string, unknown>)[definition.name];
      const hasValue = rawValue !== undefined && rawValue !== null && rawValue !== '';

      if (!hasValue) {
        if (definition.required) {
          throw new Error(`Missing required argument '${definition.name}' for script ${scriptPath}`);
        }
        continue;
      }

      const values = this.normalizeArgumentValue(definition, rawValue);

      if (definition.type === 'boolean') {
        const truthy = values.some(value => this.toBoolean(value));
        if (truthy) {
          if (definition.flag) {
            args.push(definition.flag);
          } else {
            args.push('true');
          }
        } else if (!definition.flag) {
          args.push('false');
        }
        continue;
      }

      values.forEach(value => {
        if (definition.flag) {
          args.push(definition.flag);
        }
        args.push(value);
      });
    }

    return args;
  }

  private normalizeArgumentValue(
    definition: SkillScriptArgument,
    value: unknown
  ): string[] {
    if (definition.multiple) {
      const arrayValue = Array.isArray(value) ? value : [value];
      return arrayValue
        .filter(item => item !== undefined && item !== null)
        .map(item => this.validateEnum(definition, this.coerceValue(definition.type, item)));
    }

    return [this.validateEnum(definition, this.coerceValue(definition.type, value))];
  }

  private coerceValue(
    type: SkillScriptArgument['type'],
    value: unknown
  ): string {
    if (type === 'number') {
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(num)) {
        throw new Error(`Expected numeric value, received: ${value}`);
      }
      return String(num);
    }

    if (type === 'boolean') {
      return this.toBoolean(value) ? 'true' : 'false';
    }

    return String(value);
  }

  private validateEnum(
    definition: SkillScriptArgument,
    value: string
  ): string {
    if (definition.enum && definition.enum.length > 0) {
      const enumValues = definition.enum.map(entry => String(entry));
      if (!enumValues.includes(value)) {
        throw new Error(
          `Invalid value '${value}' for argument '${definition.name}'. Allowed values: ${enumValues.join(', ')}`
        );
      }
    }

    return value;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'y', 'on'].includes(value.toLowerCase());
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return Boolean(value);
  }
}
