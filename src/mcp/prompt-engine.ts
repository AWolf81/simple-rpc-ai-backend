/**
 * Simple template engine for MCP prompts
 * Supports {{variable}} substitution and basic conditionals
 */

export class PromptTemplateEngine {
  /**
   * Process template string with given arguments
   */
  static processTemplate(template: string, args: Record<string, any> = {}): string {
    let processed = template;

    // Replace simple variables {{variable}}
    processed = processed.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return args[varName] !== undefined ? String(args[varName]) : `[${varName}]`;
    });

    // Handle {{#if variable}} conditionals
    processed = processed.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, varName, content) => {
      return args[varName] && args[varName] !== 'false' ? content : '';
    });

    // Handle {{#eq variable "value"}} conditionals
    processed = processed.replace(/\{\{#eq\s+(\w+)\s+"([^"]+)"\}\}(.*?)\{\{\/eq\}\}/gs, (match, varName, value, content) => {
      return args[varName] === value ? content : '';
    });

    // Clean up any remaining template syntax
    processed = processed.replace(/\{\{[^}]*\}\}/g, '');

    return processed.trim();
  }

  /**
   * Validate that all required arguments are provided
   */
  static validateArguments(
    templateArgs: Array<{ name: string; required?: boolean }>,
    providedArgs: Record<string, any>
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    for (const arg of templateArgs) {
      if (arg.required && (providedArgs[arg.name] === undefined || providedArgs[arg.name] === null)) {
        missing.push(arg.name);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}