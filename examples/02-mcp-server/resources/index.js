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
 * Setup custom resources
 */
export function setupCustomResources() {
  // Package info resource
  mcpResourceRegistry.registerResource({
    id: 'package-info',
    name: 'Package Information',
    description: 'Detailed information about this npm package',
    mimeType: 'application/json',
    category: 'project',
    requireAuth: false
  });

  mcpResourceRegistry.registerProvider('package-info', {
    generateContent: async (_resourceId, _context) => {
      try {
        // Use the secure file reader to get package.json
        const packageContent = await defaultRootManager.readFile('project-root', 'package.json');
        const packageData = JSON.parse(packageContent);

        return JSON.stringify({
          name: packageData.name,
          version: packageData.version,
          description: packageData.description,
          author: packageData.author,
          license: packageData.license,
          dependencies: Object.keys(packageData.dependencies || {}).length,
          devDependencies: Object.keys(packageData.devDependencies || {}).length,
          scripts: Object.keys(packageData.scripts || {}),
          engines: packageData.engines,
          repository: packageData.repository,
          keywords: packageData.keywords,
          generatedAt: new Date().toISOString()
        }, null, 2);
      } catch (error) {
        return JSON.stringify({
          error: `Failed to read package info: ${error.message}`,
          generatedAt: new Date().toISOString()
        }, null, 2);
      }
    }
  });
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