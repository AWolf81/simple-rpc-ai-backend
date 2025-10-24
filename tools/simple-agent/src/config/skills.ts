import { join } from 'path';

type SkillSource =
  | { type: 'builtin'; name: string }
  | { type: 'local'; path: string };

/**
 * Central registry of default skills that Simple Agent loads.
 * Add new built-in or local skills here to make them available everywhere.
 */
export function getDefaultSkillSources(projectRoot: string): SkillSource[] {
  return [
    // Built-in core skills
    { type: 'builtin', name: 'file-handling' },
    { type: 'builtin', name: 'git-commit-helper' },
    { type: 'builtin', name: 'script-caller' },

    // Example/local skills bundled with the repo
    { type: 'local', path: join(projectRoot, 'examples/03-agents-basic/custom-skills/hello-world') }
  ];
}
