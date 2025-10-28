import type { SandboxConfig } from '../types';
export declare function augmentSandboxForCommand(sandbox: SandboxConfig, command: string): SandboxConfig;
interface WrapSkillCommandParams {
    command: string;
    args: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
    sandbox: SandboxConfig;
}
export declare function wrapSkillCommandWithBwrap({ command, args, cwd, env, sandbox }: WrapSkillCommandParams): {
    command: string;
    args: string[];
};
export {};
