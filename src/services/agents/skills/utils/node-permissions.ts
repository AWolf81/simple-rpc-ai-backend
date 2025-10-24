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
export function getNodePermissionFlags(): string[] | null {
  const [majorStr, minorStr] = process.versions.node.split('.');
  const major = Number.parseInt(majorStr || '0', 10);
  const minor = Number.parseInt(minorStr || '0', 10);

  if (Number.isNaN(major)) {
    return null;
  }

  if (major > 23 || (major === 23 && minor >= 5)) {
    return ['--permission'];
  }

  if (major === 22) {
    return ['--experimental-permission'];
  }

  return null;
}
