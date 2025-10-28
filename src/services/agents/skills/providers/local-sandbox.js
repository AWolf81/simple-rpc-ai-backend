/**
 * Local Sandbox Provider
 *
 * Executes scripts as local processes with security restrictions.
 * Best for development and testing. NOT recommended for production.
 *
 * Security features:
 * - Path validation (only allowed directories)
 * - Timeout limits
 * - Memory limits
 * - Process isolation
 */
import { spawn } from 'child_process';
import path from 'path';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { logger } from '../../../../utils/logger';
import { getNodePermissionFlags } from '../utils/node-permissions';
import { augmentSandboxForCommand, wrapSkillCommandWithBwrap } from '../utils/process-wrapper';
const PYTHON_GUARD_SOURCE = String.raw `import os
import builtins
import socket

_PATHSPLIT = os.pathsep

def _parse_paths(value):
    if not value:
        return []
    items = []
    for raw in value.split(_PATHSPLIT):
        raw = raw.strip()
        if not raw:
            continue
        items.append(os.path.realpath(os.path.expanduser(raw)))
    return items

_ALLOWED_READ = _parse_paths(os.environ.get('AI_SANDBOX_ALLOW_FS_READ', ''))
_ALLOWED_WRITE = _parse_paths(os.environ.get('AI_SANDBOX_ALLOW_FS_WRITE', ''))
_ALLOWED_UNIX = [p for p in (os.environ.get('AI_SANDBOX_ALLOW_UNIX_SOCKETS') or '').split(',') if p]
_DEFAULT_NET = os.environ.get('AI_SANDBOX_DEFAULT_NET', 'deny').lower()
_ALLOWED_NET = set(filter(None, (os.environ.get('AI_SANDBOX_ALLOW_NET') or '').lower().split(',')))
_DENIED_NET = set(filter(None, (os.environ.get('AI_SANDBOX_DENY_NET') or '').lower().split(',')))

def _is_path_allowed(target, allowlist):
    try:
        normalized = os.path.realpath(os.path.expanduser(os.fspath(target)))
    except TypeError:
        return True
    for allowed in allowlist:
        if normalized == allowed or normalized.startswith(allowed + os.sep):
            return True
    return False

_original_open = builtins.open

def _sandbox_open(file, mode='r', *args, **kwargs):
    if 'w' in mode or 'a' in mode or '+' in mode or 'x' in mode:
        if _ALLOWED_WRITE and not _is_path_allowed(file, _ALLOWED_WRITE):
            raise PermissionError(f'Write access to {file!r} denied by sandbox policy')
    else:
        if _ALLOWED_READ and not _is_path_allowed(file, _ALLOWED_READ):
            raise PermissionError(f'Read access to {file!r} denied by sandbox policy')
    return _original_open(file, mode, *args, **kwargs)

builtins.open = _sandbox_open

_original_socket_connect = socket.socket.connect

def _check_network(address):
    if isinstance(address, str):
        if not address:
            return
        if _ALLOWED_UNIX:
            normalized = os.path.realpath(address)
            for allowed in _ALLOWED_UNIX:
                if normalized == allowed or normalized.startswith(allowed + os.sep):
                    return
            raise PermissionError(f'Unix socket access to {address!r} denied by sandbox policy')
        elif _DEFAULT_NET == 'deny':
            raise PermissionError('Unix socket access denied by sandbox policy')
        return
    if not isinstance(address, tuple) or not address:
        return
    host = (address[0] or '').lower()
    port = address[1] if len(address) > 1 else None
    target = f'{host}:{port}' if port is not None else host
    if target in _DENIED_NET or host in _DENIED_NET:
        raise PermissionError(f'Network access to {target} denied by sandbox policy')
    if _ALLOWED_NET:
        if target not in _ALLOWED_NET and host not in _ALLOWED_NET:
            raise PermissionError(f'Network access to {target} denied by sandbox policy')
    elif _DEFAULT_NET == 'deny':
        raise PermissionError(f'Network access to {target} denied by sandbox policy')

def _guarded_connect(self, address):
    _check_network(address)
    return _original_socket_connect(self, address)

socket.socket.connect = _guarded_connect

if hasattr(socket, 'create_connection'):
    _original_create_conn = socket.create_connection
    def _guarded_create_connection(address, timeout=None, source_address=None):
        _check_network(address)
        return _original_create_conn(address, timeout=timeout, source_address=source_address)
    socket.create_connection = _guarded_create_connection
`;
export class LocalSandboxProvider {
    name = 'local';
    sessionType = 'ephemeral';
    config;
    initialized = false;
    pythonGuardPath;
    constructor(config) {
        const allowedPaths = config?.allowedPaths ?? ['/workspace', '/tmp'];
        const nodePermissionFlags = getNodePermissionFlags();
        const envVars = {
            PATH: config?.environmentVars?.PATH ?? process.env.PATH ?? '',
            HOME: config?.environmentVars?.HOME ?? process.env.HOME ?? '',
            USER: config?.environmentVars?.USER ?? process.env.USER ?? '',
            TMPDIR: config?.environmentVars?.TMPDIR ?? process.env.TMPDIR ?? process.env.TEMP ?? '',
            TMP: config?.environmentVars?.TMP ?? process.env.TMP ?? process.env.TEMP ?? '',
            PWD: process.cwd(),
            ...(config?.environmentVars ?? {})
        };
        const allowedEnvVars = config?.allowedEnvVars ?? Object.keys(envVars);
        this.config = {
            allowedPaths,
            allowedReadPaths: config?.allowedReadPaths ?? config?.allowedPaths ?? allowedPaths,
            allowedWritePaths: config?.allowedWritePaths ?? config?.allowedPaths ?? allowedPaths,
            timeout: config?.timeout ?? 30000,
            maxMemory: config?.maxMemory ?? 512 * 1024 * 1024,
            networkAccess: config?.networkAccess ?? false,
            allowedNetworkHosts: config?.allowedNetworkHosts ?? [],
            blockedNetworkHosts: config?.blockedNetworkHosts ?? [],
            allowedUnixSockets: config?.allowedUnixSockets ?? [],
            allowChildProcesses: config?.allowChildProcesses ?? false,
            allowedEnvVars,
            monitorViolations: config?.monitorViolations ?? false,
            environmentVars: envVars,
            enforceNodePermissions: config?.enforceNodePermissions ?? Boolean(nodePermissionFlags)
        };
    }
    async initialize(config) {
        this.config = this.resolveSandboxConfig(config);
        this.initialized = true;
        logger.debug('🏠 Local sandbox provider initialized');
    }
    async execute(request) {
        if (!this.initialized) {
            await this.initialize(this.config);
        }
        const startTime = Date.now();
        let sandbox = this.resolveSandboxConfig(request.sandbox);
        // Debug: Log sandbox config
        logger.debug(`🔍 Sandbox config:`, {
            cwdFilePath: sandbox.cwdFilePath,
            projectRoot: sandbox.projectRoot,
            requestCwd: request.cwd
        });
        // Validate script path
        this.validateScriptPath(request.scriptPath, sandbox);
        // Validate working directory
        if (request.cwd) {
            this.validatePath(request.cwd, sandbox);
        }
        // Get runtime command
        const runtimeCmd = this.getRuntimeCommand(request.runtime, request.scriptPath);
        sandbox = augmentSandboxForCommand(sandbox, runtimeCmd.command);
        const env = this.prepareEnvironment(sandbox);
        const combinedArgs = runtimeCmd.args.concat(request.args || []);
        const security = this.applyRuntimeSecurity({
            runtime: request.runtime,
            command: runtimeCmd.command,
            args: combinedArgs,
            env,
            sandbox
        });
        const monitor = sandbox.monitorViolations ? this.startViolationMonitor() : null;
        const effectiveCwd = request.cwd || sandbox.projectRoot || path.dirname(request.scriptPath);
        console.error(`📂 [CWD DEBUG] Executing script with cwd: ${effectiveCwd}`);
        console.error(`📂 [CWD DEBUG] sandbox.projectRoot: ${sandbox.projectRoot}`);
        console.error(`📂 [CWD DEBUG] sandbox.cwdFilePath: ${sandbox.cwdFilePath}`);
        logger.debug(`📂 Executing script with cwd: ${effectiveCwd}`);
        const result = await this.executeProcess(security.command, security.args, {
            cwd: effectiveCwd,
            env: security.env,
            timeout: sandbox.timeout,
            maxMemory: sandbox.maxMemory,
            stdin: request.stdin
        }, sandbox);
        if (security.warnings.length > 0) {
            result.securityWarnings = Array.from(new Set([...(result.securityWarnings || []), ...security.warnings]));
        }
        if (monitor) {
            const violationLogs = await monitor.stop();
            if (violationLogs.length > 0) {
                result.violationLogs = violationLogs;
                const violationText = `Sandbox violations detected:\n${violationLogs.join('\n')}`;
                result.stderr = result.stderr
                    ? `${result.stderr}\n${violationText}`
                    : violationText;
            }
        }
        return {
            ...result,
            duration: Date.now() - startTime
        };
    }
    async healthCheck() {
        return true; // Local sandbox is always healthy if process is running
    }
    async shutdown() {
        this.initialized = false;
        logger.debug('🏠 Local sandbox provider shut down');
    }
    resolveSandboxConfig(overrides) {
        const base = this.config;
        const allowedPaths = overrides?.allowedPaths ?? base.allowedPaths ?? ['/workspace', '/tmp'];
        const allowedReadPaths = overrides?.allowedReadPaths ?? overrides?.allowedPaths ?? base.allowedReadPaths ?? allowedPaths;
        const allowedWritePaths = overrides?.allowedWritePaths ?? overrides?.allowedPaths ?? base.allowedWritePaths ?? allowedPaths;
        const environmentVars = {
            ...(base.environmentVars ?? {}),
            ...(overrides?.environmentVars ?? {})
        };
        if (!environmentVars.PWD) {
            environmentVars.PWD = process.cwd();
        }
        // Read projectRoot from cwdFilePath if provided
        let projectRoot = overrides?.projectRoot ?? base.projectRoot;
        const cwdFilePath = overrides?.cwdFilePath ?? base.cwdFilePath;
        if (cwdFilePath && !projectRoot) {
            try {
                if (existsSync(cwdFilePath)) {
                    projectRoot = readFileSync(cwdFilePath, 'utf-8').trim();
                    logger.debug(`📂 Read projectRoot from ${cwdFilePath}: ${projectRoot}`);
                }
            }
            catch (error) {
                logger.warn(`Failed to read cwdFilePath ${cwdFilePath}:`, error);
            }
        }
        const nodePermissionFlags = getNodePermissionFlags();
        const allowedEnvVars = new Set(overrides?.allowedEnvVars ??
            base.allowedEnvVars ??
            Object.keys(environmentVars));
        Object.keys(environmentVars).forEach(key => allowedEnvVars.add(key));
        const dedupe = (values) => Array.from(new Set((values ?? []).filter(Boolean)));
        return {
            allowedPaths: dedupe(allowedPaths),
            allowedReadPaths: dedupe(allowedReadPaths),
            allowedWritePaths: dedupe(allowedWritePaths),
            cwdFilePath,
            timeout: overrides?.timeout ?? base.timeout,
            maxMemory: overrides?.maxMemory ?? base.maxMemory,
            networkAccess: overrides?.networkAccess ?? base.networkAccess ?? false,
            allowedNetworkHosts: dedupe(overrides?.allowedNetworkHosts ?? base.allowedNetworkHosts ?? []),
            blockedNetworkHosts: dedupe(overrides?.blockedNetworkHosts ?? base.blockedNetworkHosts ?? []),
            allowedUnixSockets: dedupe(overrides?.allowedUnixSockets ?? base.allowedUnixSockets ?? []),
            allowChildProcesses: overrides?.allowChildProcesses ?? base.allowChildProcesses ?? false,
            allowedEnvVars: Array.from(allowedEnvVars),
            monitorViolations: overrides?.monitorViolations ?? base.monitorViolations ?? false,
            environmentVars,
            enforceNodePermissions: overrides?.enforceNodePermissions ?? base.enforceNodePermissions ?? Boolean(nodePermissionFlags),
            projectRoot
        };
    }
    /**
     * Validate script path is within allowed directories
     */
    validateScriptPath(scriptPath, sandbox) {
        const absolutePath = path.resolve(scriptPath);
        const isAllowed = sandbox.allowedPaths?.some(allowedPath => {
            const absAllowed = path.resolve(allowedPath);
            return absolutePath.startsWith(absAllowed);
        });
        if (!isAllowed) {
            throw new Error(`Script path ${absolutePath} is outside allowed paths: ${sandbox.allowedPaths?.join(', ')}`);
        }
    }
    /**
     * Validate any path is within allowed directories
     */
    validatePath(pathToCheck, sandbox) {
        const absolutePath = path.resolve(pathToCheck);
        const isAllowed = sandbox.allowedPaths?.some(allowedPath => {
            const absAllowed = path.resolve(allowedPath);
            return absolutePath.startsWith(absAllowed);
        });
        if (!isAllowed) {
            throw new Error(`Path ${absolutePath} is outside allowed paths: ${sandbox.allowedPaths?.join(', ')}`);
        }
    }
    applyRuntimeSecurity(params) {
        const warnings = [];
        const env = { ...params.env };
        let command = params.command;
        let args = [...params.args];
        if (params.runtime === 'javascript') {
            const { flags, warnings: flagWarnings } = this.buildNodePermissionFlags(params.sandbox);
            warnings.push(...flagWarnings);
            if (args.length > 0) {
                const [script, ...rest] = args;
                args = [...flags, script, ...rest];
            }
            else {
                args = [...flags];
                warnings.push('Node runtime invoked without script path; permission flags applied without target.');
            }
        }
        else if (params.runtime === 'typescript') {
            const { flags, warnings: flagWarnings } = this.buildNodePermissionFlags(params.sandbox);
            warnings.push(...flagWarnings);
            if (flags.length > 0) {
                const existing = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : '';
                env.NODE_OPTIONS = `${existing}${flags.join(' ')}`.trim();
            }
        }
        else if (params.runtime === 'python') {
            const guardPath = this.ensurePythonGuard();
            env.PYTHONPATH = env.PYTHONPATH
                ? `${guardPath}${path.delimiter}${env.PYTHONPATH}`
                : guardPath;
            env.SIMPLE_AGENT_SANDBOX_GUARD = 'python';
        }
        else if (params.runtime === 'shell') {
            warnings.push('Shell runtime cannot fully enforce filesystem or network policies; rely on OS-level isolation.');
        }
        if (!params.sandbox.allowChildProcesses && params.runtime !== 'javascript' && params.runtime !== 'typescript') {
            warnings.push('Child process restrictions are not enforced for non-Node runtimes.');
        }
        return { command, args, env, warnings };
    }
    buildNodePermissionFlags(sandbox) {
        const warnings = [];
        if (!sandbox.enforceNodePermissions) {
            return { flags: [], warnings };
        }
        const permissionFlags = getNodePermissionFlags();
        if (!permissionFlags || permissionFlags.length === 0) {
            warnings.push(`Node ${process.versions.node} does not support permission flags; enforcement falls back to best-effort guards.`);
            return { flags: [], warnings };
        }
        const stablePermission = permissionFlags.includes('--permission');
        const flags = [...permissionFlags];
        const normalizePaths = (paths) => Array.from(new Set((paths ?? []).map(p => path.resolve(p))));
        const readPaths = normalizePaths(sandbox.allowedReadPaths || sandbox.allowedPaths);
        for (const readPath of readPaths) {
            if (stablePermission) {
                flags.push(`--permission=fs-read=${readPath}`);
            }
            else {
                flags.push(`--experimental-permission=fs-read=${readPath}`);
            }
            flags.push(`--allow-fs-read=${readPath}`);
        }
        const writePaths = normalizePaths(sandbox.allowedWritePaths || sandbox.allowedPaths);
        if (writePaths.length === 0) {
            warnings.push('Filesystem writes remain disabled (no allowed write paths configured).');
            if (stablePermission) {
                flags.push('--permission=fs-write=none');
            }
        }
        else {
            for (const writePath of writePaths) {
                if (stablePermission) {
                    flags.push(`--permission=fs-write=${writePath}`);
                }
                flags.push(`--allow-fs-write=${writePath}`);
            }
        }
        if (sandbox.allowChildProcesses) {
            if (stablePermission) {
                flags.push('--permission=child-process=*');
                flags.push('--permission=worker=*');
            }
            else {
                flags.push('--experimental-permission=child-process=*');
                flags.push('--experimental-permission=worker=*');
            }
            flags.push('--allow-child-process');
            flags.push('--allow-worker');
        }
        const allowedHosts = sandbox.allowedNetworkHosts ?? [];
        if (allowedHosts.length > 0) {
            for (const host of allowedHosts) {
                if (stablePermission) {
                    flags.push(`--permission=net=${host}`);
                }
                else {
                    flags.push(`--experimental-permission=net=${host}`);
                }
                flags.push(`--allow-net=${host}`);
            }
        }
        else if (!sandbox.networkAccess) {
            if (stablePermission) {
                flags.push('--permission=net=none');
            }
            else {
                flags.push('--experimental-permission=net=none');
            }
        }
        else if (sandbox.networkAccess) {
            warnings.push('Network access requested but no allowed hosts configured; network remains disabled.');
            if (stablePermission) {
                flags.push('--permission=net=none');
            }
            else {
                flags.push('--experimental-permission=net=none');
            }
        }
        return { flags, warnings };
    }
    ensurePythonGuard() {
        if (this.pythonGuardPath) {
            return this.pythonGuardPath;
        }
        try {
            const guardDir = mkdtempSync(path.join(tmpdir(), 'simple-agent-py-'));
            const guardPath = path.join(guardDir, 'sitecustomize.py');
            writeFileSync(guardPath, PYTHON_GUARD_SOURCE, { encoding: 'utf-8', mode: 0o600 });
            this.pythonGuardPath = guardPath;
            return guardPath;
        }
        catch (error) {
            logger.warn(`⚠️  Failed to prepare Python sandbox guard: ${error instanceof Error ? error.message : error}`);
            // Return empty string so that PYTHONPATH is unchanged
            this.pythonGuardPath = '';
            return '';
        }
    }
    startViolationMonitor() {
        if (process.platform !== 'darwin') {
            return null;
        }
        try {
            const monitor = spawn('log', ['stream', '--style', 'syslog', '--predicate', 'subsystem == "com.apple.security.sandbox"'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            const logs = [];
            monitor.stdout?.on('data', data => {
                const line = data.toString().trim();
                if (line)
                    logs.push(line);
            });
            monitor.stderr?.on('data', data => {
                const line = data.toString().trim();
                if (line)
                    logs.push(line);
            });
            return {
                stop: () => new Promise((resolve) => {
                    let settled = false;
                    const finalize = () => {
                        if (!settled) {
                            settled = true;
                            resolve(logs);
                        }
                    };
                    monitor.once('exit', finalize);
                    monitor.once('error', finalize);
                    monitor.kill('SIGTERM');
                    setTimeout(() => {
                        if (!settled) {
                            monitor.kill('SIGKILL');
                            finalize();
                        }
                    }, 500);
                })
            };
        }
        catch (error) {
            logger.warn(`⚠️  Failed to start sandbox violation monitor: ${error instanceof Error ? error.message : error}`);
            return null;
        }
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
     * Prepare environment variables
     */
    prepareEnvironment(sandbox) {
        const env = {};
        const allowedKeys = new Set(sandbox.allowedEnvVars && sandbox.allowedEnvVars.length > 0
            ? sandbox.allowedEnvVars
            : Object.keys(sandbox.environmentVars || {}));
        for (const key of allowedKeys) {
            if (sandbox.environmentVars && key in sandbox.environmentVars) {
                env[key] = sandbox.environmentVars[key];
            }
            else if (process.env[key] !== undefined) {
                env[key] = process.env[key];
            }
        }
        // Ensure minimal defaults
        if (!env.PATH && process.env.PATH)
            env.PATH = process.env.PATH;
        if (!env.TMPDIR && process.env.TMPDIR)
            env.TMPDIR = process.env.TMPDIR;
        if (!env.TMP && process.env.TMP)
            env.TMP = process.env.TMP;
        env.PWD = env.PWD || process.cwd();
        if (!sandbox.networkAccess && (!sandbox.allowedNetworkHosts || sandbox.allowedNetworkHosts.length === 0)) {
            delete env.HTTP_PROXY;
            delete env.HTTPS_PROXY;
            delete env.http_proxy;
            delete env.https_proxy;
            delete env.NO_PROXY;
            delete env.no_proxy;
        }
        env.PYTHONNOUSERSITE = '1';
        env.PYTHONDONTWRITEBYTECODE = '1';
        env.NODE_ENV = 'production';
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
        env.AI_SANDBOX_MONITOR = sandbox.monitorViolations ? '1' : '0';
        // Strip common secret env vars
        const secretKeys = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'ANTHROPIC_API_KEY',
            'OPENAI_API_KEY',
            'GOOGLE_API_KEY'
        ];
        for (const key of secretKeys) {
            if (key in env) {
                delete env[key];
            }
        }
        return env;
    }
    /**
     * Execute process with timeout and memory limits
     */
    async executeProcess(command, args, options, sandbox) {
        return new Promise((resolve) => {
            const wrapped = wrapSkillCommandWithBwrap({
                command,
                args,
                cwd: options.cwd,
                env: options.env,
                sandbox
            });
            const child = spawn(wrapped.command, wrapped.args, {
                cwd: options.cwd,
                env: options.env,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            // Set timeout
            const timeout = setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
                setTimeout(() => child.kill('SIGKILL'), 1000);
            }, options.timeout || 30000);
            // Capture output
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            // Send stdin if provided
            if (options.stdin && child.stdin) {
                child.stdin.write(options.stdin);
                child.stdin.end();
            }
            // Handle completion
            child.on('exit', (code /*, signal*/) => {
                clearTimeout(timeout);
                resolve({
                    exitCode: timedOut ? 124 : (code ?? 1),
                    stdout,
                    stderr: timedOut ? 'Script execution timed out' : stderr,
                    duration: 0, // Will be set by caller
                    timedOut
                });
            });
            // Handle errors
            child.on('error', (error) => {
                clearTimeout(timeout);
                resolve({
                    exitCode: 1,
                    stdout: '',
                    stderr: `Failed to execute script: ${error.message}`,
                    duration: 0,
                    timedOut: false
                });
            });
        });
    }
}
