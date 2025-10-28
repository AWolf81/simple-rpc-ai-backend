import path from 'path';
import { accessSync, constants as fsConstants, existsSync, lstatSync } from 'fs';
import { wrapCommandWithBwrap } from '../../../../utils/bwrap-runner';
const REGISTRY_ALLOWANCES = {
    npx: ['registry.npmjs.org', 'registry.npmjs.org:443'],
    pnpm: ['registry.npmjs.org', 'registry.npmjs.org:443'],
    uvx: ['pypi.org', 'pypi.org:443', 'files.pythonhosted.org', 'files.pythonhosted.org:443']
};
const normalizeCommandName = (command) => path.basename(command).toLowerCase();
const normalizePaths = (paths) => {
    if (!paths) {
        return [];
    }
    const unique = new Set();
    for (const entry of paths) {
        if (!entry) {
            continue;
        }
        unique.add(path.resolve(entry));
    }
    return Array.from(unique);
};
const isWindows = process.platform === 'win32';
const isExecutable = (candidate) => {
    try {
        const stats = lstatSync(candidate);
        if (stats.isDirectory()) {
            return false;
        }
        if (!isWindows) {
            accessSync(candidate, fsConstants.X_OK);
        }
        return true;
    }
    catch {
        return false;
    }
};
const resolveCommandPath = (command, env, cwd) => {
    const extras = new Set();
    const recordPath = (target) => {
        const resolved = path.resolve(target);
        extras.add(resolved);
        const parent = path.dirname(resolved);
        if (parent && parent !== resolved) {
            extras.add(parent);
        }
    };
    const hasSeparator = command.includes(path.sep) || (isWindows && command.includes('\\'));
    if (hasSeparator) {
        const absolute = path.isAbsolute(command) ? command : path.resolve(cwd, command);
        if (isExecutable(absolute)) {
            recordPath(absolute);
            return { command: absolute, extraReadOnly: Array.from(extras) };
        }
        return { command, extraReadOnly: [] };
    }
    const pathEntries = (env.PATH || process.env.PATH || '')
        .split(path.delimiter)
        .filter(Boolean);
    for (const entry of pathEntries) {
        const candidateDir = path.resolve(entry);
        if (!existsSync(candidateDir)) {
            continue;
        }
        const candidate = path.join(candidateDir, command);
        if (isExecutable(candidate)) {
            recordPath(candidate);
            return { command: candidate, extraReadOnly: Array.from(extras) };
        }
    }
    return { command, extraReadOnly: [] };
};
export function augmentSandboxForCommand(sandbox, command) {
    const commandKey = normalizeCommandName(command);
    const hosts = REGISTRY_ALLOWANCES[commandKey];
    if (!hosts || hosts.length === 0) {
        return sandbox;
    }
    const allowedNetworkHosts = new Set(sandbox.allowedNetworkHosts ?? []);
    for (const host of hosts) {
        allowedNetworkHosts.add(host);
    }
    return {
        ...sandbox,
        networkAccess: true,
        allowedNetworkHosts: Array.from(allowedNetworkHosts)
    };
}
export function wrapSkillCommandWithBwrap({ command, args, cwd, env, sandbox }) {
    const writablePaths = normalizePaths(sandbox.allowedWritePaths ?? sandbox.allowedPaths);
    const writableSet = new Set(writablePaths);
    const readableSet = new Set(normalizePaths(sandbox.allowedReadPaths ?? sandbox.allowedPaths));
    const resolved = resolveCommandPath(command, env, cwd);
    for (const extra of resolved.extraReadOnly) {
        if (extra) {
            readableSet.add(path.resolve(extra));
        }
    }
    const readOnlyPaths = Array.from(readableSet).filter(entry => !writableSet.has(entry));
    return wrapCommandWithBwrap(resolved.command, args, {
        cwd,
        env,
        writablePaths,
        readOnlyPaths,
        allowNetwork: sandbox.networkAccess
    });
}
