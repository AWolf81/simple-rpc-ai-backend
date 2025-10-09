/**
 * Resource Registry Configuration
 *
 * This module sets up MCP resources using the flexible resource registry system
 */

import {
  mcpResourceRegistry,
  defaultRootManager,
  FileReaderHelpers,
  TemplateRegistry,
  createTemplate
} from 'simple-rpc-ai-backend';
import path from 'path';

/**
 * Setup file reader resources with rootManager integration
 */
export function setupFileReaderResources(currentDir = process.cwd()) {
  // Configure root folders for secure file access - go up to project root
  const projectRoot = path.resolve(currentDir, '../..');
  const examplesDir = path.join(projectRoot, 'examples');
  const srcDir = path.join(projectRoot, 'src');

  // Add root folders to the default root manager
  try {
    defaultRootManager.addRoot('project-root', {
      name: 'Project Root',
      path: projectRoot,
      description: 'Main project directory with package.json, README, etc.',
      readOnly: true
    });

    defaultRootManager.addRoot('examples', {
      name: 'Examples Directory',
      path: examplesDir,
      description: 'Example servers and configurations',
      readOnly: true
    });

    defaultRootManager.addRoot('source', {
      name: 'Source Code',
      path: srcDir,
      description: 'TypeScript source code',
      readOnly: true
    });

    console.log('✅ Root folders configured successfully');
  } catch (error) {
    console.warn('⚠️ Some root folders may already exist:', error.message);
  }

  // Register global filesystem resources using rootsManager
  mcpResourceRegistry.registerGlobalResources(defaultRootManager);
}

/**
 * Setup Template Engine resources with file readers
 */
export function setupTemplateEngineResources() {
  // Create Template Engine file readers
  const textFileReader = FileReaderHelpers.textFileReader(defaultRootManager, 'text-file-reader');
  const codeFileReader = FileReaderHelpers.codeFileReader(defaultRootManager, 'code-file-reader');
  const configFileReader = FileReaderHelpers.configFileReader(defaultRootManager, 'config-file-reader');
  const directoryBrowser = FileReaderHelpers.directoryBrowser(defaultRootManager, 'directory-browser');

  // Example: Custom Template Engine resource with parameters
  const companyHandbook = createTemplate('company-handbook-example')
    .name('Company Handbook (Example)')
    .description('Example company handbook with department-specific content and multiple formats')
    .enumParameter('department', ['engineering', 'product', 'design'], 'Department section')
    .enumParameter('version', ['latest', 'stable'], 'Handbook version')
    .enumParameter('format', ['md', 'xml', 'json'], 'Output format')
    .markdown(async (params) => {
      const { department, version } = params;
      const content = generateExampleHandbookContent(department, version);
      return { content };
    })
    .xml(async (params) => {
      const { department, version } = params;
      const content = generateExampleHandbookContent(department, version);
      return {
        content: convertContentToXML(content, department, version)
      };
    })
    .json(async (params) => {
      const { department, version } = params;
      return {
        content: JSON.stringify({
          department,
          version,
          title: `${department.charAt(0).toUpperCase() + department.slice(1)} Department Handbook`,
          sections: [
            { title: 'Overview', content: 'Department overview and mission' },
            { title: 'Guidelines', content: 'Best practices and standards' },
            { title: 'Processes', content: 'Workflow and procedures' }
          ],
          lastUpdated: new Date().toISOString(),
          generatedBy: 'Template Engine Example'
        }, null, 2)
      };
    });

  // Register all Template Engine resources
  const templateRegistry = new TemplateRegistry()
    .registerMany(
      textFileReader,
      codeFileReader,
      configFileReader,
      directoryBrowser,
      companyHandbook
    );

  // Apply to MCP resource registry
  templateRegistry.applyTo(mcpResourceRegistry);

  console.log('🎯 Template Engine resources configured successfully');
}

/**
 * Generate example handbook content for different departments
 */
function generateExampleHandbookContent(department, version) {
  const versionNote = version === 'latest' ? '(Latest - includes experimental guidelines)' : '(Stable - proven practices)';

  const departmentContent = {
    engineering: `# Engineering Department Handbook ${versionNote}

## Development Standards
- **Code Review**: All code must be reviewed by at least one senior engineer
- **Testing**: Minimum 80% test coverage required for all new features
- **Security**: Run security scans before deployment
- **Documentation**: All APIs must have OpenAPI documentation
- **Architecture**: Follow microservices patterns with proper logging

## Technical Guidelines
- Use TypeScript for all new JavaScript projects
- Follow RESTful API design principles
- Implement proper error handling and logging
- Write comprehensive unit and integration tests

${version === 'latest' ? `## Latest Updates
- New CI/CD pipeline integration
- Updated security policies
- Enhanced remote work guidelines
- Latest tool recommendations and best practices

*Note: This version includes experimental guidelines that may change.*` : `## Stable Practices
- Proven development workflows
- Thoroughly tested procedures
- Production-ready guidelines
- Time-tested methodologies

*Note: This version contains well-established, proven guidelines.*`}

---
*Generated on ${new Date().toLocaleDateString()} for ${department} department*
*Format: md | Version: ${version}*`,

    product: `# Product Department Handbook ${versionNote}

## Product Standards
- **Requirements**: All features must have detailed PRDs
- **User Research**: Conduct user interviews before major features
- **Analytics**: Track key metrics for all new features
- **A/B Testing**: Test major UX changes with controlled experiments
- **Release Planning**: Follow agile sprint methodology

## Product Process
- Define clear success metrics for every feature
- Create user journey maps for complex workflows
- Conduct regular customer feedback sessions
- Maintain a prioritized product backlog

${version === 'latest' ? `## Latest Updates
- New user research methodologies
- Updated analytics framework
- Enhanced A/B testing tools
- Latest product management best practices

*Note: This version includes cutting-edge product practices.*` : `## Stable Practices
- Proven product development workflows
- Thoroughly tested methodologies
- Production-ready processes
- Time-tested product strategies

*Note: This version contains established product practices.*`}

---
*Generated on ${new Date().toLocaleDateString()} for ${department} department*
*Format: md | Version: ${version}*`,

    design: `# Design Department Handbook ${versionNote}

## Design Standards
- **Design System**: Use company design tokens and components
- **Accessibility**: All designs must meet WCAG 2.1 AA standards
- **User Testing**: Conduct usability tests for new interfaces
- **Prototyping**: Create interactive prototypes for complex flows
- **Documentation**: Maintain design specifications in Figma

## Design Process
- Start with user research and problem definition
- Create wireframes before high-fidelity designs
- Test designs with real users before development
- Maintain consistency across all product touchpoints

${version === 'latest' ? `## Latest Updates
- New design system components
- Updated accessibility guidelines
- Enhanced prototyping tools
- Latest design methodologies

*Note: This version includes experimental design practices.*` : `## Stable Practices
- Proven design workflows
- Thoroughly tested procedures
- Production-ready guidelines
- Time-tested design methodologies

*Note: This version contains well-established design practices.*`}

---
*Generated on ${new Date().toLocaleDateString()} for ${department} department*
*Format: md | Version: ${version}*`
  };

  return departmentContent[department] || departmentContent.engineering;
}

/**
 * Convert markdown content to XML format
 */
function convertContentToXML(content, department, version) {
  const lines = content.split('\n');
  const title = lines[0].replace('# ', '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<handbook department="${department}" version="${version}" generated="${new Date().toISOString()}">
  <title>${title}</title>
  <sections>
    <section name="overview">
      <content>Comprehensive ${department} department guidelines and best practices</content>
    </section>
    <section name="standards">
      <content>Quality standards and requirements for ${department} team</content>
    </section>
    <section name="processes">
      <content>Workflow and procedural guidelines for daily operations</content>
    </section>
  </sections>
  <metadata>
    <lastUpdated>${new Date().toISOString()}</lastUpdated>
    <generatedBy>Template Engine Example</generatedBy>
    <sourceFormat>markdown</sourceFormat>
  </metadata>
</handbook>`;
}

/**
 * Helper function to easily add workspace file resources
 * Uses relative paths from workspace root (e.g., 'README.md', 'package.json', 'src/config.json')
 *
 * @param {string} id - Unique resource identifier
 * @param {string} name - Display name
 * @param {string} filePath - Relative path from root (e.g., 'package.json', 'src/index.js')
 * @param {Object} options - Configuration options
 * @param {string} [options.rootId='project-root'] - Which root to read from
 * @param {string} [options.category='project'] - Resource category
 * @param {boolean} [options.requireAuth=false] - Require authentication
 *
 * Security: Defaults to 'project-root'. Custom roots via rootId option.
 */
function addWorkspaceFileResource(id, name, filePath, options = {}) {
  const {
    description = `${name} from project workspace`,
    category = 'project',
    requireAuth = false,
    mimeType = detectMimeType(filePath),
    rootId = 'project-root'  // Default to project-root
  } = options;

  // Clean up the file path - remove leading ./ if present
  const cleanPath = filePath.startsWith('./') ? filePath.substring(2) : filePath;

  registerFileResource(id, name, description, mimeType, category, requireAuth, (context) => {
    // Use specified rootId from options, or fallback to default
    const workspaceManager = context?.workspaceManager;

    if (workspaceManager) {
      return workspaceManager.readFile('projectRoot', cleanPath);
    } else {
      return defaultRootManager.readFile(rootId, cleanPath);
    }
  });
}

/**
 * Helper function to add file resources from absolute paths
 * Supports local paths and UNC network shares
 * Examples: '/home/user/file.txt', '//server/share/file.txt', '\\\\server\\share\\file.txt'
 */
function addFileResource(id, name, filePath, options = {}) {
  const {
    description = `${name} from ${filePath}`,
    category = 'files',
    requireAuth = false,
    mimeType = detectMimeType(filePath)
  } = options;

  registerFileResource(id, name, description, mimeType, category, requireAuth, async () => {
    return await readFromAbsolutePath(filePath);
  });
}

/**
 * Detect MIME type from file extension
 */
function detectMimeType(filePath) {
  if (filePath.endsWith('.md')) return 'text/markdown';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.xml')) return 'application/xml';
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js') || filePath.endsWith('.ts')) return 'text/javascript';
  if (filePath.endsWith('.py')) return 'text/x-python';
  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) return 'application/x-yaml';
  if (filePath.endsWith('.toml')) return 'application/toml';
  if (filePath.endsWith('.csv')) return 'text/csv';
  return 'text/plain';
}

/**
 * Common resource registration logic
 */
function registerFileResource(id, name, description, mimeType, category, requireAuth, contentReader) {
  mcpResourceRegistry.registerResource({
    id, name, description, mimeType, category, requireAuth
  });

  mcpResourceRegistry.registerProvider(id, {
    generateContent: async (_resourceId, context) => {
      try {
        return await contentReader(context);
      } catch (error) {
        const errorContent = mimeType === 'application/json'
          ? JSON.stringify({ error: `Failed to read ${name}: ${error.message}`, generatedAt: new Date().toISOString() }, null, 2)
          : `# Error Reading ${name}\n\n**Error**: ${error.message}\n\n*Generated at: ${new Date().toISOString()}*`;

        return errorContent;
      }
    }
  });
}

/**
 * Read file from workspace manager
 */
async function readFromWorkspace(context, fileName) {
  const workspaceManager = context?.workspaceManager;

  if (workspaceManager) {
    return await workspaceManager.readFile('projectRoot', fileName);
  } else {
    try {
      return await defaultRootManager.readFile('project-root', fileName);
    } catch (rootError) {
      throw new Error(`No workspace manager available and root manager failed: ${rootError.message}`);
    }
  }
}

/**
 * Protocol handlers registry for different file path types
 * Consumers can extend this to add SMB, SFTP, etc.
 */
const protocolHandlers = new Map();

/**
 * Register a custom protocol handler
 * @param {string} protocol - Protocol identifier (e.g., 'smb', 'sftp', 'ftp')
 * @param {Function} handler - Async function (filePath) => string content
 * @param {Function} matcher - Function (filePath) => boolean to detect if this handler should be used
 */
export function registerProtocolHandler(protocol, handler, matcher) {
  protocolHandlers.set(protocol, { handler, matcher });
}

/**
 * Read file from absolute path with extensible protocol support
 *
 * Built-in support:
 * - Local files: /home/user/file.txt
 * - UNC paths: //server/share/file.txt (Windows only)
 *
 * Extensible support (via registerProtocolHandler):
 * - SMB: registerProtocolHandler('smb', smbHandler, path => path.startsWith('smb://'))
 * - SFTP: registerProtocolHandler('sftp', sftpHandler, path => path.startsWith('sftp://'))
 * - FTP: registerProtocolHandler('ftp', ftpHandler, path => path.startsWith('ftp://'))
 */
async function readFromAbsolutePath(filePath) {
  const fs = await import('fs/promises');

  try {
    // Check for custom protocol handlers first
    for (const [protocol, { handler, matcher }] of protocolHandlers) {
      if (matcher(filePath)) {
        console.log(`📡 Using ${protocol} protocol handler for: ${filePath}`);
        return await handler(filePath);
      }
    }

    // Built-in protocol handling
    if (filePath.startsWith('//') || filePath.startsWith('\\\\')) {
      // UNC path (Windows network share)
      // Note: On Linux, UNC paths don't work directly - need to mount first
      if (process.platform !== 'win32') {
        throw new Error(`UNC paths not supported on ${process.platform}. Consider:\n` +
          `1. Mount the share: sudo mount -t cifs ${filePath.split('/').slice(0, 4).join('/')} /mnt/share\n` +
          `2. Or register SMB protocol handler: registerProtocolHandler('smb', smbHandler, matcher)`);
      }
      return await fs.readFile(filePath, 'utf8');
    } else {
      // Regular absolute path
      return await fs.readFile(filePath, 'utf8');
    }
  } catch (error) {
    throw new Error(`Failed to read file '${filePath}': ${error.message}`);
  }
}

/**
 * Setup custom resources
 *
 * Security Model:
 * - Resources only access roots explicitly configured via defaultRootManager.addRoot()
 * - Without a configured root, files are inaccessible (secure by default)
 * - All paths are relative to the configured root (no absolute paths allowed)
 * - Custom roots can be added for different projects (e.g., 'projectA', 'projectB')
 */
export function setupCustomResources() {
  // Simple workspace file resources - defaults to 'project-root'
  addWorkspaceFileResource('package-info', 'Package Information', 'package.json', {
    description: 'Detailed information about this npm package'
  });

  addWorkspaceFileResource('readme', 'Project README', 'README.md', {
    description: 'Main README.md file with project documentation',
    category: 'documentation'
  });

  addWorkspaceFileResource('claude-md', 'Claude Instructions', 'CLAUDE.md', {
    description: 'Claude Code instructions and project guidance',
    category: 'documentation'
  });

  // Example: Using a custom root (if configured via defaultRootManager.addRoot('examples', {...}))
  // addWorkspaceFileResource('examples-readme', 'Examples README', 'README.md', {
  //   description: 'README from examples directory',
  //   category: 'documentation',
  //   rootId: 'examples'  // Uses 'examples' root instead of default 'project-root'
  // });
}

/**
 * Initialize all resource configurations
 */
export function setupAllResources(currentDir = process.cwd()) {
  setupFileReaderResources(currentDir);
  setupTemplateEngineResources();
  setupCustomResources();

  console.log('📁 All resources configured successfully');
}