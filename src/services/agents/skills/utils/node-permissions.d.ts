/**
 * Determine the appropriate permission flags for the current Node.js runtime.
 *
 * Node 22 introduced the experimental permission model guarded by
 * `--experimental-permission` plus `--allow-*` flags.
 *
 * Beginning with Node 23.5 / Node 24, the stable `--permission` flag was added
 * but the experimental flag remains supported. To maximise compatibility we
 * return both when the stable variant is available.
 */
export declare function getNodePermissionFlags(): string[] | null;
