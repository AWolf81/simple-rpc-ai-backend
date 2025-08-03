import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Simple template engine for server-side rendering
 * Supports basic variable substitution and simple conditionals
 */
class TemplateEngine {
  constructor() {
    this.templatesDir = join(__dirname, 'templates');
  }

  /**
   * Render a template with data
   * @param {string} templateName - Name of template file (without .html)
   * @param {object} data - Data to inject into template
   * @param {object} layoutData - Data for layout template
   * @returns {string} Rendered HTML
   */
  render(templateName, data = {}, layoutData = {}) {
    try {
      // Read the main template
      const templatePath = join(this.templatesDir, `${templateName}.html`);
      let template = readFileSync(templatePath, 'utf8');
      
      // Read base template if we're not rendering the base itself
      if (templateName !== 'base') {
        const basePath = join(this.templatesDir, 'base.html');
        const baseTemplate = readFileSync(basePath, 'utf8');
        
        // Inject the content template into the base template
        const mergedData = {
          content: this.processTemplate(template, data),
          showBackButton: true,
          ...layoutData
        };
        
        return this.processTemplate(baseTemplate, mergedData);
      }
      
      return this.processTemplate(template, data);
    } catch (error) {
      console.error('Template rendering error:', error);
      return `<html><body><h1>Template Error</h1><p>${error.message}</p></body></html>`;
    }
  }

  /**
   * Process template with data substitution
   * @param {string} template - Template string
   * @param {object} data - Data object
   * @returns {string} Processed template
   */
  processTemplate(template, data) {
    let processed = template;
    
    // Simple variable substitution: {{variableName}}
    processed = processed.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
    
    // Simple conditionals: {{#condition}}content{{/condition}}
    processed = processed.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
      return data[key] ? content : '';
    });
    
    // Handle missing variables gracefully
    processed = processed.replace(/\{\{[^}]+\}\}/g, '');
    
    return processed;
  }

  /**
   * Get common layout data
   * @param {object} config - Application config
   * @returns {object} Common layout data
   */
  getCommonLayoutData(config) {
    return {
      customCSS: '',
      customJS: '',
      headerIcon: '🔍',
      headerTitle: 'OpenRPC Inspector',
      headerSubtitle: 'Interactive API Explorer & Testing Interface'
    };
  }

  /**
   * Get common page data
   * @param {object} config - Application config
   * @returns {object} Common page data
   */
  getCommonPageData(config) {
    // Ensure RPC URL has proper protocol for playground
    const rpcUrl = config.rpcUrl.startsWith('http') ? config.rpcUrl : `http://${config.rpcUrl}`;
    
    return {
      port: config.port,
      schemaFile: config.schemaFile,
      rpcUrl: config.rpcUrl,
      playgroundSchemaUrl: encodeURIComponent(`http://localhost:${config.port}/openrpc.json`),
      playgroundRpcUrl: encodeURIComponent(rpcUrl)
    };
  }
}

export default TemplateEngine;