/**
 * SKILL.md Parser
 *
 * Parses SKILL.md files with YAML frontmatter and markdown content.
 * Implements progressive disclosure by separating metadata from instructions.
 */
import { SkillMetadata } from './types';
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
export declare function parseSkillFile(skillPath: string): Promise<ParsedSkill>;
/**
 * Parse SKILL.md content string
 */
export declare function parseSkillContent(content: string): ParsedSkill;
/**
 * Parse YAML frontmatter into metadata object
 */
export declare function parseYamlFrontmatter(yamlContent: string): SkillMetadata;
/**
 * Count tokens in text (simple approximation: ~4 chars per token)
 */
export declare function estimateTokens(text: string): number;
/**
 * Validate skill structure and token limits
 */
export declare function validateSkillStructure(parsed: ParsedSkill, config: {
    maxLevel1Tokens: number;
    maxLevel2Tokens: number;
}): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
/**
 * Load and parse skill directory
 */
export declare function loadSkillDirectory(basePath: string): Promise<{
    parsed: ParsedSkill;
    resourcePaths: {
        references: string[];
        scripts: string[];
        commands: string[];
        templates: string[];
        examples: string[];
        other: string[];
    };
}>;
/**
 * Extract skill ID from path or name
 */
export declare function extractSkillId(skillPath: string, metadata: SkillMetadata): string;
