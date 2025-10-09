/**
 * MCP Server Security Scanner
 *
 * Analyzes MCP server packages for security risks before installation/use.
 * Supports both PyPI (Python) and npm (Node.js) packages.
 *
 * Security Levels:
 * - GREEN: Minimal risk, safe to use
 * - YELLOW: Suspicious patterns found, manual review recommended
 * - RED: High-risk patterns found, use with extreme caution
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Official Anthropic MCP servers (downgrade RED → YELLOW for these)
const OFFICIAL_SERVERS = [
  'mcp-server-time',
  'mcp-server-filesystem',
  'mcp-server-openai',
  '@modelcontextprotocol/server-brave-search',
  '@modelcontextprotocol/server-everything',
  '@modelcontextprotocol/server-fetch',
  '@modelcontextprotocol/server-filesystem',
  '@modelcontextprotocol/server-github',
  '@modelcontextprotocol/server-gitlab',
  '@modelcontextprotocol/server-google-maps',
  '@modelcontextprotocol/server-memory',
  '@modelcontextprotocol/server-postgres',
  '@modelcontextprotocol/server-puppeteer',
  '@modelcontextprotocol/server-sequential-thinking',
  '@modelcontextprotocol/server-slack',
  '@modelcontextprotocol/server-sqlite'
];

// High-risk patterns for Python
const PY_RED_PATTERNS = [
  { pattern: /exec\s*\(/g, description: 'Dynamic code execution (exec)' },
  { pattern: /eval\s*\(/g, description: 'Dynamic code evaluation (eval)' },
  { pattern: /subprocess\.(run|call|Popen|check_output)/g, description: 'Subprocess execution' },
  { pattern: /base64\.b64decode/g, description: 'Base64 decoding (potential obfuscation)' },
  { pattern: /os\.system\s*\(/g, description: 'OS command execution' },
  { pattern: /socket\.(connect|bind)/g, description: 'Network socket operations' },
  { pattern: /requests\.(get|post|put|delete|patch)/g, description: 'HTTP requests' },
  { pattern: /__import__\s*\(/g, description: 'Dynamic module import' },
  { pattern: /compile\s*\(/g, description: 'Code compilation' }
];

// Suspicious patterns for Python
const PY_YELLOW_PATTERNS = [
  { pattern: /importlib/g, description: 'Dynamic imports (importlib)' },
  { pattern: /open\s*\([^)]*['"]w/g, description: 'File write operations' },
  { pattern: /pickle\.(load|loads)/g, description: 'Pickle deserialization' },
  { pattern: /marshal\.loads/g, description: 'Marshal deserialization' },
  { pattern: /ctypes/g, description: 'Low-level C type operations' }
];

// High-risk patterns for JavaScript/TypeScript
const JS_RED_PATTERNS = [
  { pattern: /eval\s*\(/g, description: 'Dynamic code evaluation (eval)' },
  { pattern: /Function\s*\(/g, description: 'Dynamic function creation' },
  { pattern: /child_process\.(exec|spawn|fork)/g, description: 'Child process execution' },
  { pattern: /require\s*\(['"]https?:/g, description: 'Remote module loading' },
  { pattern: /new\s+Function\s*\(/g, description: 'Dynamic function constructor' },
  { pattern: /vm\.(runInContext|runInNewContext|runInThisContext)/g, description: 'VM context execution' },
  { pattern: /\.(system|exec)\s*\(/g, description: 'System command execution' }
];

// Suspicious patterns for JavaScript/TypeScript
const JS_YELLOW_PATTERNS = [
  { pattern: /fs\.(writeFile|write|appendFile)/g, description: 'File write operations' },
  { pattern: /process\.env/g, description: 'Environment variable access' },
  { pattern: /fetch\s*\(/g, description: 'HTTP fetch requests' },
  { pattern: /axios\.(get|post|put|delete)/g, description: 'HTTP axios requests' },
  { pattern: /localStorage\.(setItem|getItem)/g, description: 'Browser localStorage access' },
  { pattern: /document\.(cookie|write)/g, description: 'Browser document manipulation' }
];

export interface PackageMetadata {
  name: string;
  version?: string;
  homepage?: string;
  repository?: string;
  author?: string;
  releaseDate?: string;
  downloadUrl?: string;
  language: 'python' | 'javascript';
}

export interface SecurityMatch {
  pattern: string;
  description: string;
  line?: number;
  file?: string;
}

export interface SecurityScanResult {
  level: 'GREEN' | 'YELLOW' | 'RED';
  reasons: string[];
  redFlags: SecurityMatch[];
  yellowFlags: SecurityMatch[];
  metadata: PackageMetadata;
  scannedFiles: number;
  timestamp: Date;
  extractionPath?: string;  // Path to extracted source code for browsing
}

export interface MCPServerSecurityConfig {
  name: string;
  command: string;
  args: string[];
}

/**
 * Scan file content for security patterns
 */
function scanFileContent(
  content: string,
  filename: string,
  lang: 'python' | 'javascript'
): { red: SecurityMatch[]; yellow: SecurityMatch[] } {
  const redPatterns = lang === 'python' ? PY_RED_PATTERNS : JS_RED_PATTERNS;
  const yellowPatterns = lang === 'python' ? PY_YELLOW_PATTERNS : JS_YELLOW_PATTERNS;

  const red: SecurityMatch[] = [];
  const yellow: SecurityMatch[] = [];

  const lines = content.split('\n');

  for (const { pattern, description } of redPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        red.push({
          pattern: pattern.source,
          description,
          line: i + 1,
          file: filename
        });
      }
    }
  }

  for (const { pattern, description } of yellowPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        yellow.push({
          pattern: pattern.source,
          description,
          line: i + 1,
          file: filename
        });
      }
    }
  }

  return { red, yellow };
}

function resolvePackageName(config: MCPServerSecurityConfig): string | undefined {
  const args = config.args || [];
  const cmd = config.command.toLowerCase();

  if (cmd === 'npm' || cmd === 'npm-exec' || cmd === 'npx') {
    const execIndex = args.findIndex(arg => arg === 'exec');
    if (execIndex !== -1) {
      for (let i = execIndex + 1; i < args.length; i++) {
        const value = args[i];
        if (value === '--') {
          return args[i + 1];
        }
        if (!value.startsWith('-')) {
          return value;
        }
      }
      return undefined;
    }

    // npx path where package is the first argument
    if (args.length > 0) {
      return args[0];
    }
  }

  if (cmd === 'uvx' && args.length > 0) {
    return args[0];
  }

  return args.find(arg => !arg.startsWith('-'));
}

/**
 * Fetch package metadata from PyPI
 */
async function fetchPyPIMetadata(packageName: string): Promise<PackageMetadata> {
  const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);

  if (!response.ok) {
    throw new Error(`PyPI package not found: ${packageName}`);
  }

  const data = await response.json() as any;
  const info = data.info || {};
  const latestVersion = info.version;
  const releases = data.releases || {};
  const releaseFiles = releases[latestVersion] || [];

  // Find the source distribution (.tar.gz), not the wheel (.whl)
  // We need source code to scan, not compiled wheels
  const sdist = releaseFiles.find((f: any) =>
    f.packagetype === 'sdist' || f.filename?.endsWith('.tar.gz')
  );

  if (!sdist) {
    throw new Error(`No source distribution found for ${packageName} ${latestVersion}`);
  }

  return {
    name: packageName,
    version: latestVersion,
    homepage: info.home_page,
    repository: info.project_urls?.Source || info.project_url,
    author: info.author || info.maintainer,
    releaseDate: sdist.upload_time,
    downloadUrl: sdist.url,
    language: 'python'
  };
}

/**
 * Fetch package metadata from npm
 */
async function fetchNpmMetadata(packageName: string): Promise<PackageMetadata> {
  const response = await fetch(`https://registry.npmjs.org/${packageName}`);

  if (!response.ok) {
    throw new Error(`npm package not found: ${packageName}`);
  }

  const data = await response.json() as any;
  const latestVersion = data['dist-tags']?.latest;
  const versionData = data.versions?.[latestVersion] || {};

  return {
    name: packageName,
    version: latestVersion,
    homepage: versionData.homepage,
    repository: typeof versionData.repository === 'object'
      ? versionData.repository.url
      : versionData.repository,
    author: typeof versionData.author === 'object'
      ? versionData.author.name
      : versionData.author,
    releaseDate: data.time?.[latestVersion],
    downloadUrl: versionData.dist?.tarball,
    language: 'javascript'
  };
}

/**
 * Download and extract package for scanning
 * Returns: { scanPath: directory to scan, cleanupPath: directory to remove }
 */
async function downloadAndExtract(
  downloadUrl: string,
  lang: 'python' | 'javascript'
): Promise<{ scanPath: string; cleanupPath: string }> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-scan-'));
  const archivePath = path.join(tmpDir, 'package.tar.gz');

  // Download package
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download package: ${response.statusText}`);
  }

  // Save to file
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(archivePath, buffer);

  // Extract archive using system tar command
  // Both PyPI and npm use standard tar.gz format
  // PyPI packages may have gzip metadata that causes warnings, but extraction still works
  try {
    execSync(`tar -xzf "${archivePath}" -C "${tmpDir}"`, { stdio: 'ignore' });
  } catch (error) {
    // Gzip warnings cause non-zero exit but extraction may still succeed
    // Check if any files were extracted
    const entries = fs.readdirSync(tmpDir).filter(f => f !== 'package.tar.gz' && f !== 'package.tar');
    if (entries.length === 0) {
      throw error;
    }
    // Files were extracted despite warnings, continue
  }

  // Find the actual extracted directory (packages create a subdirectory)
  const entries = fs.readdirSync(tmpDir);
  const packageDir = entries.find(entry => {
    const fullPath = path.join(tmpDir, entry);
    const stat = fs.statSync(fullPath);
    return stat.isDirectory() && entry !== 'package.tar.gz';
  });

  const scanPath = packageDir ? path.join(tmpDir, packageDir) : tmpDir;

  return { scanPath, cleanupPath: tmpDir };
}

/**
 * Recursively scan directory for security issues
 */
function scanDirectory(
  dir: string,
  lang: 'python' | 'javascript'
): { red: SecurityMatch[]; yellow: SecurityMatch[]; fileCount: number } {
  const red: SecurityMatch[] = [];
  const yellow: SecurityMatch[] = [];
  let fileCount = 0;

  const extensions = lang === 'python' ? ['.py'] : ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

  function walk(currentPath: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      // Silently skip directories that can't be read
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip common non-code directories
        // Note: We scan 'dist' and 'build' for published packages (contains compiled output)
        if (!['node_modules', '__pycache__', '.git', '.tox', '.venv', 'venv'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          fileCount++;
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relativePath = path.relative(dir, fullPath);
          const matches = scanFileContent(content, relativePath, lang);
          red.push(...matches.red);
          yellow.push(...matches.yellow);
        }
      }
    }
  }

  walk(dir);
  return { red, yellow, fileCount };
}

/**
 * Classify security level based on findings
 */
function classifySecurityLevel(
  metadata: PackageMetadata,
  redFlags: SecurityMatch[],
  yellowFlags: SecurityMatch[],
  isOfficial: boolean
): { level: 'GREEN' | 'YELLOW' | 'RED'; reasons: string[] } {
  const reasons: string[] = [];

  // Check metadata issues
  if (!metadata.homepage && !metadata.repository) {
    reasons.push('⚠️ No source code link available');
  }

  if (metadata.author && /unknown|anonymous/i.test(metadata.author)) {
    reasons.push('⚠️ Unknown or anonymous author');
  }

  if (metadata.releaseDate) {
    const releaseDate = new Date(metadata.releaseDate);
    const ageInDays = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 14) {
      reasons.push('⚠️ Very recent package (< 14 days old)');
    }
  }

  // Check code patterns
  if (redFlags.length > 0) {
    const uniqueDescriptions = [...new Set(redFlags.map(f => f.description))];
    reasons.push(`🚨 High-risk patterns found: ${uniqueDescriptions.join(', ')}`);
  }

  if (yellowFlags.length > 0) {
    const uniqueDescriptions = [...new Set(yellowFlags.map(f => f.description))];
    reasons.push(`⚠️ Suspicious patterns found: ${uniqueDescriptions.join(', ')}`);
  }

  // Determine level
  let level: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';

  if (redFlags.length > 0) {
    level = 'RED';
    if (isOfficial) {
      level = 'YELLOW';
      reasons.unshift('✓ Official MCP server - RED flags downgraded to YELLOW');
    }
  } else if (yellowFlags.length > 0 || reasons.length > 0) {
    level = 'YELLOW';
  } else {
    reasons.push('✓ No obvious security issues detected');
  }

  return { level, reasons };
}

/**
 * Scan an MCP server package for security issues
 */
export async function scanMCPServerPackage(
  packageName: string,
  command: 'uvx' | 'npx' | 'npm-exec'
): Promise<SecurityScanResult> {
  const isOfficial = OFFICIAL_SERVERS.includes(packageName);

  try {
    // Fetch metadata
    const metadata = command === 'uvx'
      ? await fetchPyPIMetadata(packageName)
      : await fetchNpmMetadata(packageName);

    if (!metadata.downloadUrl) {
      throw new Error('Package download URL not available');
    }

    // Download and scan
    const { scanPath, cleanupPath } = await downloadAndExtract(metadata.downloadUrl, metadata.language);
    const { red, yellow, fileCount } = scanDirectory(scanPath, metadata.language);

    // Don't cleanup - keep the extraction for browsing
    // User can manually clean up /tmp/mcp-scan-* directories if needed

    // Classify
    const { level, reasons } = classifySecurityLevel(metadata, red, yellow, isOfficial);

    return {
      level,
      reasons,
      redFlags: red,
      yellowFlags: yellow,
      metadata,
      scannedFiles: fileCount,
      timestamp: new Date(),
      extractionPath: scanPath  // Return path for browsing source code
    };
  } catch (error) {
    return {
      level: 'RED',
      reasons: [`❌ Failed to analyze package: ${error instanceof Error ? error.message : 'Unknown error'}`],
      redFlags: [],
      yellowFlags: [],
      metadata: {
        name: packageName,
        language: command === 'uvx' ? 'python' : 'javascript'
      },
      scannedFiles: 0,
      timestamp: new Date()
    };
  }
}

/**
 * Scan MCP server configuration (for Claude config format)
 */
export async function scanMCPServerConfig(
  serverConfig: MCPServerSecurityConfig
): Promise<SecurityScanResult> {
  const packageName = resolvePackageName(serverConfig);

  if (!packageName) {
    return {
      level: 'YELLOW',
      reasons: ['⚠️ Unable to determine package name from configuration'],
      redFlags: [],
      yellowFlags: [],
      metadata: {
        name: 'unknown',
        language: 'javascript'
      },
      scannedFiles: 0,
      timestamp: new Date()
    };
  }

  const command = serverConfig.command.toLowerCase();

  if (command === 'uvx') {
    return scanMCPServerPackage(packageName, 'uvx');
  } else if (command === 'npx') {
    return scanMCPServerPackage(packageName, 'npx');
  } else if (command === 'npm' || command === 'npm-exec') {
    return scanMCPServerPackage(packageName, 'npm-exec');
  } else if (command === 'docker') {
    // Docker scanning would require different approach
    return {
      level: 'YELLOW',
      reasons: ['⚠️ Docker container scanning not yet implemented', '⚠️ Manual review recommended'],
      redFlags: [],
      yellowFlags: [],
      metadata: {
        name: packageName,
        language: 'javascript' // Unknown for docker
      },
      scannedFiles: 0,
      timestamp: new Date()
    };
  } else {
    return {
      level: 'YELLOW',
      reasons: ['⚠️ Unsupported command type for automated scanning'],
      redFlags: [],
      yellowFlags: [],
      metadata: {
        name: packageName,
        language: 'javascript'
      },
      scannedFiles: 0,
      timestamp: new Date()
    };
  }
}

/**
 * Format scan result for console output
 */
export function formatScanResult(result: SecurityScanResult): string {
  const levelEmoji = {
    GREEN: '✅',
    YELLOW: '⚠️',
    RED: '🚨'
  };

  const lines: string[] = [];
  lines.push(`\n${levelEmoji[result.level]} Security Scan: ${result.level}`);
  lines.push(`Package: ${result.metadata.name} ${result.metadata.version || ''}`);
  lines.push(`Language: ${result.metadata.language}`);
  lines.push(`Files scanned: ${result.scannedFiles}`);
  lines.push('');

  for (const reason of result.reasons) {
    lines.push(`  ${reason}`);
  }

  if (result.redFlags.length > 0) {
    lines.push('\n🚨 High-Risk Issues:');
    for (const flag of result.redFlags.slice(0, 10)) {
      lines.push(`  ${flag.file}:${flag.line} - ${flag.description}`);
    }
    if (result.redFlags.length > 10) {
      lines.push(`  ... and ${result.redFlags.length - 10} more`);
    }
  }

  if (result.yellowFlags.length > 0 && result.level !== 'RED') {
    lines.push('\n⚠️ Suspicious Patterns:');
    for (const flag of result.yellowFlags.slice(0, 10)) {
      lines.push(`  ${flag.file}:${flag.line} - ${flag.description}`);
    }
    if (result.yellowFlags.length > 10) {
      lines.push(`  ... and ${result.yellowFlags.length - 10} more`);
    }
  }

  if (result.metadata.repository) {
    lines.push(`\nSource: ${result.metadata.repository}`);
  }

  return lines.join('\n');
}
