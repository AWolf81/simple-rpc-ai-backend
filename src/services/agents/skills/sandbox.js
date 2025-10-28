/**
 * Sandboxed Script Execution
 *
 * Executes skill scripts in isolated sandboxes with path, timeout, and memory restrictions.
 * Supports Python, TypeScript, JavaScript, and Shell runtimes.
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { getNodePermissionFlags } from './utils/node-permissions';
import { augmentSandboxForCommand, wrapSkillCommandWithBwrap } from './utils/process-wrapper';
/**
 * Default sandbox configuration
 */
const NODE_PERMISSION_FLAGS = getNodePermissionFlags();
export const DEFAULT_SANDBOX_CONFIG = {
    allowedPaths: [process.cwd(), '/tmp'],
    allowedReadPaths: [process.cwd(), '/tmp'],
    allowedWritePaths: [process.cwd(), '/tmp'],
    timeout: 30000, // 30 seconds
    maxMemory: 512 * 1024 * 1024, // 512MB
    networkAccess: false,
    allowedNetworkHosts: [],
    blockedNetworkHosts: [],
    allowedUnixSockets: [],
    allowChildProcesses: false,
    allowedEnvVars: ['PATH', 'HOME', 'USER', 'TMPDIR', 'TMP', 'PWD'],
    monitorViolations: false,
    enforceNodePermissions: Boolean(NODE_PERMISSION_FLAGS),
    environmentVars: {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || '',
        USER: process.env.USER || ''
    },
    projectRoot: process.cwd() // Use process.cwd as default, will be overridden by server config
};
/**
 * Script Sandbox Manager
 */
export class ScriptSandbox {
    config;
    constructor(config = DEFAULT_SANDBOX_CONFIG) {
        this.config = config;
    }
    /**
     * Execute a script in sandboxed environment
     */
    async execute(request) {
        const startTime = Date.now();
        // Merge sandbox config
        let sandbox = { ...this.config, ...request.sandbox };
        // Read projectRoot from cwdFilePath if provided
        if (sandbox.cwdFilePath && !sandbox.projectRoot) {
            try {
                if (existsSync(sandbox.cwdFilePath)) {
                    sandbox.projectRoot = readFileSync(sandbox.cwdFilePath, 'utf-8').trim();
                    console.error(`📂 [SANDBOX] Read projectRoot from ${sandbox.cwdFilePath}: ${sandbox.projectRoot}`);
                }
            }
            catch (error) {
                console.error(`Failed to read cwdFilePath ${sandbox.cwdFilePath}:`, error);
            }
        }
        // Validate script path
        this.validateScriptPath(request.scriptPath, sandbox);
        // Validate working directory
        if (request.cwd) {
            this.validatePath(request.cwd, sandbox);
        }
        // Get runtime command
        const runtimeCmd = this.getRuntimeCommand(request.runtime, request.scriptPath);
        // Apply network allowances for specific tooling (e.g., registry access)
        sandbox = augmentSandboxForCommand(sandbox, runtimeCmd.command);
        // Prepare environment
        const env = this.prepareEnvironment(sandbox);
        // Execute script with proper working directory
        const effectiveCwd = request.cwd || sandbox.projectRoot || path.dirname(request.scriptPath);
        console.error(`📂 [SANDBOX] Executing script with cwd: ${effectiveCwd}`);
        const result = await this.executeProcess(runtimeCmd.command, runtimeCmd.args.concat(request.args || []), {
            cwd: effectiveCwd,
            env,
            timeout: sandbox.timeout,
            maxMemory: sandbox.maxMemory,
            stdin: request.stdin
        }, sandbox);
        return {
            ...result,
            duration: Date.now() - startTime
        };
    }
    /**
     * Get runtime command for script execution
     */
    getRuntimeCommand(runtime, scriptPath) {
        switch (runtime) {
            case 'python':
                return {
                    command: 'python3',
                    args: [scriptPath]
                };
            case 'typescript':
                // Use npx to find tsx from node_modules
                return {
                    command: 'npx',
                    args: ['tsx', scriptPath]
                };
            case 'javascript':
                return {
                    command: 'node',
                    args: [scriptPath]
                };
            case 'shell':
                return {
                    command: 'bash',
                    args: [scriptPath]
                };
            default:
                throw new Error(`Unsupported runtime: ${runtime}`);
        }
    }
    /**
     * Prepare sandboxed environment variables
     */
    prepareEnvironment(sandbox) {
        const env = {};
        const allowedEnvKeys = new Set((sandbox.allowedEnvVars && sandbox.allowedEnvVars.length > 0)
            ? sandbox.allowedEnvVars
            : Object.keys(sandbox.environmentVars || {}));
        for (const key of allowedEnvKeys) {
            if (sandbox.environmentVars && key in sandbox.environmentVars) {
                env[key] = sandbox.environmentVars[key];
            }
            else if (process.env[key] !== undefined) {
                env[key] = process.env[key];
            }
        }
        // Ensure essential defaults
        if (!env.PATH && process.env.PATH) {
            env.PATH = process.env.PATH;
        }
        if (!env.TMPDIR && process.env.TMPDIR) {
            env.TMPDIR = process.env.TMPDIR;
        }
        if (!env.TMP && process.env.TMP) {
            env.TMP = process.env.TMP;
        }
        // Block network access by unsetting proxy variables
        if (!sandbox.networkAccess) {
            delete env.HTTP_PROXY;
            delete env.HTTPS_PROXY;
            delete env.http_proxy;
            delete env.https_proxy;
            delete env.NO_PROXY;
            delete env.no_proxy;
        }
        // Set Python to ignore site packages (only stdlib)
        if (env.PYTHONPATH) {
            delete env.PYTHONPATH;
        }
        env.PYTHONNOUSERSITE = '1';
        env.PYTHONDONTWRITEBYTECODE = '1';
        // Set Node to production mode (minimal packages)
        env.NODE_ENV = 'production';
        // Add project root to environment - use configured value or find it synchronously
        if (sandbox.projectRoot) {
            env.PROJECT_ROOT = sandbox.projectRoot;
        }
        else {
            // If no project root provided, try to find it synchronously
            let currentDir = process.cwd();
            const pathModule = require('path');
            const fsModule = require('fs');
            // Traverse up the directory tree until we find package.json or reach root
            while (currentDir !== pathModule.dirname(currentDir)) {
                try {
                    const packageJsonPath = pathModule.join(currentDir, 'package.json');
                    fsModule.accessSync(packageJsonPath);
                    env.PROJECT_ROOT = currentDir;
                    break;
                }
                catch {
                    // package.json not found in this directory, go up one level
                    currentDir = pathModule.dirname(currentDir);
                }
            }
            // Fallback to current working directory if package.json not found
            if (!env.PROJECT_ROOT) {
                env.PROJECT_ROOT = process.cwd();
            }
        }
        // Security policy hints for guard scripts
        const delimiter = path.delimiter;
        env.AI_SANDBOX_DEFAULT_NET = sandbox.networkAccess || (sandbox.allowedNetworkHosts && sandbox.allowedNetworkHosts.length > 0)
            ? 'allow'
            : 'deny';
        env.AI_SANDBOX_ALLOW_NET = (sandbox.allowedNetworkHosts || []).join(',');
        env.AI_SANDBOX_DENY_NET = (sandbox.blockedNetworkHosts || []).join(',');
        env.AI_SANDBOX_ALLOW_UNIX_SOCKETS = (sandbox.allowedUnixSockets || []).join(',');
        env.AI_SANDBOX_ALLOW_CHILD_PROCESS = sandbox.allowChildProcesses ? '1' : '0';
        env.AI_SANDBOX_ALLOW_FS_READ = (sandbox.allowedReadPaths || sandbox.allowedPaths).join(delimiter);
        env.AI_SANDBOX_ALLOW_FS_WRITE = (sandbox.allowedWritePaths || sandbox.allowedPaths).join(delimiter);
        return env;
    }
    /**
     * Execute process with timeout and memory limits
     */
    executeProcess(command, args, options, sandbox) {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let memoryExceeded = false;
            const wrapped = wrapSkillCommandWithBwrap({
                command,
                args,
                cwd: options.cwd,
                env: options.env,
                sandbox
            });
            // Spawn process
            const child = spawn(wrapped.command, wrapped.args, {
                cwd: options.cwd,
                env: options.env,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            // Setup timeout
            const timeoutId = setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
                // Force kill after 5 seconds
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            }, options.timeout);
            // Monitor memory usage
            const memoryCheckInterval = setInterval(() => {
                if (child.pid) {
                    this.checkMemoryUsage(child.pid, options.maxMemory)
                        .then(exceeded => {
                        if (exceeded) {
                            memoryExceeded = true;
                            clearInterval(memoryCheckInterval);
                            child.kill('SIGTERM');
                        }
                    })
                        .catch(() => {
                        // Ignore errors checking memory
                    });
                }
            }, 1000);
            // Capture stdout
            child.stdout?.on('data', data => {
                stdout += data.toString();
                // Limit output size to 1MB
                if (stdout.length > 1024 * 1024) {
                    stdout = stdout.slice(0, 1024 * 1024) + '\n[Output truncated...]';
                    child.kill('SIGTERM');
                }
            });
            // Capture stderr
            child.stderr?.on('data', data => {
                stderr += data.toString();
                // Limit error output size to 1MB
                if (stderr.length > 1024 * 1024) {
                    stderr = stderr.slice(0, 1024 * 1024) + '\n[Error output truncated...]';
                    child.kill('SIGTERM');
                }
            });
            // Send stdin if provided
            if (options.stdin && child.stdin) {
                child.stdin.write(options.stdin);
                child.stdin.end();
            }
            // Handle exit
            child.on('exit', (code, signal) => {
                clearTimeout(timeoutId);
                clearInterval(memoryCheckInterval);
                let error;
                if (timedOut) {
                    error = `Script timed out after ${options.timeout}ms`;
                }
                else if (memoryExceeded) {
                    error = `Script exceeded memory limit of ${Math.floor(options.maxMemory / 1024 / 1024)}MB`;
                }
                else if (signal) {
                    error = `Script terminated by signal: ${signal}`;
                }
                resolve({
                    exitCode: code ?? -1,
                    stdout,
                    stderr,
                    timedOut,
                    error
                });
            });
            // Handle errors
            child.on('error', err => {
                clearTimeout(timeoutId);
                clearInterval(memoryCheckInterval);
                reject(new Error(`Failed to execute script: ${err.message}`));
            });
        });
    }
    /**
     * Check process memory usage
     */
    async checkMemoryUsage(pid, maxMemory) {
        try {
            // Use ps command to check memory
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            // Get RSS (Resident Set Size) in KB
            const { stdout } = await execAsync(`ps -o rss= -p ${pid}`);
            const rssKB = parseInt(stdout.trim(), 10);
            if (isNaN(rssKB)) {
                return false;
            }
            const rssBytes = rssKB * 1024;
            return rssBytes > maxMemory;
        }
        catch {
            // Process may have exited or ps command failed
            return false;
        }
    }
    /**
     * Validate script path is within allowed directories
     */
    validateScriptPath(scriptPath, sandbox) {
        const absolutePath = path.resolve(scriptPath);
        // Check if path exists
        // Note: We can't use async here, but we'll validate during execution
        // Check for path traversal attempts
        if (scriptPath.includes('../') || scriptPath.includes('..\\')) {
            throw new Error('Path traversal detected: script path cannot contain "../" or "..\\"');
        }
        // Ensure the path is within allowed paths
        const isAllowed = sandbox.allowedPaths.some(allowedPath => {
            const normalizedAllowed = path.resolve(allowedPath);
            return absolutePath.startsWith(normalizedAllowed + path.sep) || absolutePath === normalizedAllowed;
        });
        if (!isAllowed) {
            throw new Error(`Script path "${scriptPath}" is not within allowed paths: ${sandbox.allowedPaths.join(', ')}`);
        }
    }
    /**
     * Validate path is within allowed paths
     */
    validatePath(targetPath, sandbox) {
        // Check for path traversal attempts
        if (targetPath.includes('../') || targetPath.includes('..\\')) {
            throw new Error('Path traversal detected: target path cannot contain "../" or "..\\"');
        }
        const absolutePath = path.resolve(targetPath);
        // Check if path is within allowed paths
        const isAllowed = sandbox.allowedPaths.some(allowedPath => {
            const normalizedAllowed = path.resolve(allowedPath);
            return absolutePath.startsWith(normalizedAllowed + path.sep) || absolutePath === normalizedAllowed;
        });
        if (!isAllowed) {
            throw new Error(`Path "${targetPath}" is not within allowed paths: ${sandbox.allowedPaths.join(', ')}`);
        }
    }
    /**
     * Validate script file contents for security issues
     */
    async validateScriptSecurity(scriptPath, runtime) {
        const issues = [];
        try {
            const content = await fs.readFile(scriptPath, 'utf-8');
            // Check for network access attempts
            const networkPatterns = [
                /http(s)?:\/\//i,
                /fetch\(/i,
                /axios\./i,
                /request\(/i,
                /urllib|requests/i, // Python
                /curl|wget/i // Shell
            ];
            for (const pattern of networkPatterns) {
                if (pattern.test(content)) {
                    issues.push(`Script contains network access pattern: ${pattern.source}`);
                }
            }
            // Check for file system access outside workspace
            const dangerousPatterns = [
                /rm\s+-rf\s+\//i, // Dangerous shell command
                /unlink|rmdir/i, // File deletion
                /eval\(/i, // Code execution
                /exec\(/i, // Process execution
                /subprocess/i, // Python subprocess
                /os\.system/i // Python os.system
            ];
            for (const pattern of dangerousPatterns) {
                if (pattern.test(content)) {
                    issues.push(`Script contains potentially dangerous pattern: ${pattern.source}`);
                }
            }
            // Runtime-specific checks
            switch (runtime) {
                case 'python':
                    // Check for dangerous Python imports
                    if (/import\s+(socket|urllib|requests|subprocess)/i.test(content)) {
                        issues.push('Script imports network or subprocess modules');
                    }
                    break;
                case 'shell':
                    // Check for curl, wget, etc.
                    if (/\b(curl|wget|nc|telnet|ssh|scp)\b/i.test(content)) {
                        issues.push('Script uses network tools');
                    }
                    break;
            }
            return {
                safe: issues.length === 0,
                issues
            };
        }
        catch (error) {
            return {
                safe: false,
                issues: [`Failed to read script: ${error}`]
            };
        }
    }
    /**
     * Get available runtimes on system
     */
    async getAvailableRuntimes() {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const checkRuntime = async (command) => {
            try {
                await execAsync(`which ${command}`);
                return true;
            }
            catch {
                return false;
            }
        };
        const [python, typescript, javascript, shell] = await Promise.all([
            checkRuntime('python3'),
            checkRuntime('tsx').then(async (tsx) => tsx || await checkRuntime('ts-node')),
            checkRuntime('node'),
            checkRuntime('bash')
        ]);
        return { python, typescript, javascript, shell };
    }
}
/**
 * Create a sandbox with custom configuration
 */
export function createSandbox(config) {
    return new ScriptSandbox({ ...DEFAULT_SANDBOX_CONFIG, ...config });
}
