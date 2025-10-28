import { spawnSync } from 'child_process';
import path from 'path';
import { existsSync, lstatSync, realpathSync } from 'fs';
let bwrapChecked = false;
let bwrapAvailable = false;
function ensureBwrapAvailable() {
    if (bwrapChecked) {
        return bwrapAvailable;
    }
    bwrapChecked = true;
    if (process.platform !== 'linux') {
        bwrapAvailable = false;
        return bwrapAvailable;
    }
    try {
        const result = spawnSync('bwrap', ['--version'], { stdio: 'ignore' });
        bwrapAvailable = result.status === 0;
    }
    catch (error) {
        bwrapAvailable = false;
    }
    return bwrapAvailable;
}
const DEFAULT_RO_DIRS = [
    '/usr',
    '/usr/local',
    '/bin',
    '/sbin',
    '/lib',
    '/lib64',
    '/etc'
];
const DEFAULT_RO_FILES = ['/etc/hosts', '/etc/resolv.conf', '/etc/nsswitch.conf'];
const DEFAULT_OPTIONAL_RO_DIRS = ['/run/systemd/resolve'];
export function wrapCommandWithBwrap(command, args, options = {}) {
    if (!ensureBwrapAvailable()) {
        return { command, args };
    }
    const bwrapArgs = ['--unshare-user', '--unshare-pid', '--clearenv', '--die-with-parent'];
    const createdDirs = new Set();
    const boundTargets = new Set();
    const allowNetwork = options.allowNetwork === true;
    if (!allowNetwork) {
        bwrapArgs.push('--unshare-net');
    }
    const envSource = options.env ?? process.env;
    const envEntries = Object.entries(envSource).filter(([, value]) => value !== undefined);
    const seenEnv = new Set();
    for (const [key, rawValue] of envEntries) {
        if (!key)
            continue;
        if (seenEnv.has(key))
            continue;
        seenEnv.add(key);
        const value = String(rawValue);
        bwrapArgs.push('--setenv', key, value);
    }
    if (!seenEnv.has('PATH')) {
        bwrapArgs.push('--setenv', 'PATH', '/usr/bin:/bin');
    }
    if (!seenEnv.has('HOME')) {
        bwrapArgs.push('--setenv', 'HOME', options.cwd ? path.resolve(options.cwd) : '/workspace');
    }
    const ensureDir = (target) => {
        if (!target) {
            return;
        }
        const resolvedTarget = path.resolve(target);
        if (resolvedTarget === '/' || resolvedTarget === '.' || createdDirs.has(resolvedTarget) || boundTargets.has(resolvedTarget)) {
            return;
        }
        const parent = path.dirname(resolvedTarget);
        if (parent && parent !== resolvedTarget) {
            ensureDir(parent);
        }
        bwrapArgs.push('--dir', resolvedTarget);
        createdDirs.add(resolvedTarget);
    };
    const addRoBind = (source, target = source) => {
        const resolvedSource = path.resolve(source);
        if (!existsSync(resolvedSource)) {
            return;
        }
        const resolvedTarget = path.resolve(target);
        if (boundTargets.has(resolvedTarget)) {
            return;
        }
        try {
            const stat = lstatSync(resolvedSource);
            if (stat.isSymbolicLink()) {
                const realTarget = realpathSync(resolvedSource);
                if (realTarget && realTarget !== resolvedSource) {
                    addRoBind(realTarget, resolvedTarget);
                }
                return;
            }
        }
        catch {
            return;
        }
        ensureDir(path.dirname(resolvedTarget));
        bwrapArgs.push('--ro-bind', resolvedSource, resolvedTarget);
        boundTargets.add(resolvedTarget);
    };
    const addRwBind = (source, target = source) => {
        const resolvedSource = path.resolve(source);
        if (!existsSync(resolvedSource)) {
            return;
        }
        const resolvedTarget = path.resolve(target);
        if (boundTargets.has(resolvedTarget)) {
            return;
        }
        ensureDir(path.dirname(resolvedTarget));
        bwrapArgs.push('--bind', resolvedSource, resolvedTarget);
        boundTargets.add(resolvedTarget);
    };
    DEFAULT_RO_DIRS.forEach(dir => addRoBind(dir));
    DEFAULT_OPTIONAL_RO_DIRS.forEach(dir => addRoBind(dir));
    DEFAULT_RO_FILES.forEach(file => addRoBind(file));
    const pathEnv = envSource?.PATH || (typeof process.env.PATH === 'string' ? process.env.PATH : '');
    if (pathEnv) {
        const pathEntries = pathEnv.split(path.delimiter);
        for (const entry of pathEntries) {
            if (!entry) {
                continue;
            }
            addRoBind(entry);
        }
    }
    bwrapArgs.push('--tmpfs', '/tmp');
    bwrapArgs.push('--dir', '/var');
    bwrapArgs.push('--proc', '/proc');
    bwrapArgs.push('--dev', '/dev');
    const writable = new Set();
    if (options.writablePaths) {
        for (const entry of options.writablePaths) {
            if (entry) {
                writable.add(path.resolve(entry));
            }
        }
    }
    if (options.cwd) {
        writable.add(path.resolve(options.cwd));
    }
    for (const entry of writable) {
        addRwBind(entry);
    }
    const readOnly = new Set();
    if (options.readOnlyPaths) {
        for (const entry of options.readOnlyPaths) {
            if (entry && !writable.has(path.resolve(entry))) {
                readOnly.add(path.resolve(entry));
            }
        }
    }
    for (const entry of readOnly) {
        addRoBind(entry);
    }
    if (options.cwd) {
        bwrapArgs.push('--chdir', path.resolve(options.cwd));
    }
    bwrapArgs.push('--', command, ...args);
    return {
        command: 'bwrap',
        args: bwrapArgs
    };
}
