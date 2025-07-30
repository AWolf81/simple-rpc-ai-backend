"use strict";
/**
 * Custom Functions Client Example
 *
 * Demonstrates how to use custom AI functions from a client application
 * (VS Code extension, CLI tool, web app, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AICodeHelper = exports.VSCodeAIHelper = void 0;
const simple_rpc_ai_backend_1 = require("simple-rpc-ai-backend");
class AICodeHelper {
    constructor(serverUrl = 'http://localhost:8000') {
        this.client = new simple_rpc_ai_backend_1.RPCClient(serverUrl);
    }
    /**
     * Analyze code for quality, bugs, and improvements
     */
    async analyzeCode(code, language = 'javascript') {
        try {
            const result = await this.client.request('analyzeCode', {
                content: code,
                language
            });
            return result;
        }
        catch (error) {
            console.error('Error analyzing code:', error);
            throw error;
        }
    }
    /**
     * Generate tests for the given code
     */
    async generateTests(code, framework = 'vitest', testType = 'unit') {
        try {
            const result = await this.client.request('generateTests', {
                content: code,
                framework,
                test_type: testType
            });
            return result;
        }
        catch (error) {
            console.error('Error generating tests:', error);
            throw error;
        }
    }
    /**
     * Review a pull request or code changes
     */
    async reviewPR(diff, focusArea) {
        try {
            const result = await this.client.request('reviewPR', {
                content: diff,
                focus_area: focusArea
            });
            return result;
        }
        catch (error) {
            console.error('Error reviewing PR:', error);
            throw error;
        }
    }
    /**
     * Generate documentation for code
     */
    async generateDocs(code, format = 'markdown', audience = 'intermediate') {
        try {
            const result = await this.client.request('generateDocs', {
                content: code,
                format,
                audience
            });
            return result;
        }
        catch (error) {
            console.error('Error generating docs:', error);
            throw error;
        }
    }
    /**
     * Perform security review of code
     */
    async securityReview(code) {
        try {
            const result = await this.client.request('securityReview', {
                content: code
            });
            return result;
        }
        catch (error) {
            console.error('Error in security review:', error);
            throw error;
        }
    }
    /**
     * Optimize code for performance
     */
    async optimizePerformance(code, platform = 'node.js') {
        try {
            const result = await this.client.request('optimizePerformance', {
                content: code,
                platform
            });
            return result;
        }
        catch (error) {
            console.error('Error optimizing performance:', error);
            throw error;
        }
    }
    /**
     * List all available custom functions
     */
    async listFunctions() {
        try {
            const result = await this.client.request('listCustomFunctions', {});
            return result;
        }
        catch (error) {
            console.error('Error listing functions:', error);
            throw error;
        }
    }
    /**
     * Call any custom function by name
     */
    async callFunction(functionName, params) {
        try {
            const result = await this.client.request(functionName, params);
            return result;
        }
        catch (error) {
            console.error(`Error calling function ${functionName}:`, error);
            throw error;
        }
    }
}
exports.AICodeHelper = AICodeHelper;
// Example usage
async function example() {
    const helper = new AICodeHelper();
    console.log('🚀 AI Code Helper Example');
    console.log('==========================\n');
    try {
        // List available functions
        console.log('📋 Available functions:');
        const functions = await helper.listFunctions();
        functions.forEach((func) => {
            console.log(`   • ${func.name}: ${func.description}`);
        });
        console.log();
        // Example: Analyze some problematic code
        const problemCode = `
function processUsers(users) {
  for (var i = 0; i < users.length; i++) {
    var user = users[i];
    if (user.age >= 18) {
      console.log(user.name + " is an adult");
      // TODO: send email
      setTimeout(function() {
        sendEmail(user.email, "Welcome!");
      }, 1000);
    }
  }
}
    `.trim();
        console.log('🔍 Analyzing code...');
        const analysis = await helper.analyzeCode(problemCode, 'javascript');
        console.log('Analysis result:', analysis.content);
        console.log('Tokens used:', analysis.usage);
        console.log();
        // Example: Generate tests
        const simpleCode = `
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
    `.trim();
        console.log('🧪 Generating tests...');
        const tests = await helper.generateTests(simpleCode, 'vitest');
        console.log('Generated tests:', tests.content);
        console.log();
        // Example: Security review
        const insecureCode = `
app.get('/user/:id', (req, res) => {
  const query = 'SELECT * FROM users WHERE id = ' + req.params.id;
  db.query(query, (err, result) => {
    res.json(result);
  });
});
    `.trim();
        console.log('🔒 Security review...');
        const security = await helper.securityReview(insecureCode);
        console.log('Security analysis:', security.content);
        console.log();
    }
    catch (error) {
        console.error('Example failed:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 Make sure the server is running:');
            console.log('   node examples/servers/custom-functions-example.js');
        }
    }
}
// For VS Code Extension usage
class VSCodeAIHelper extends AICodeHelper {
    /**
     * Analyze the currently selected code in VS Code
     */
    async analyzeSelection(editor) {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText.trim()) {
            throw new Error('No code selected');
        }
        const languageId = editor.document.languageId;
        return await this.analyzeCode(selectedText, languageId);
    }
    /**
     * Generate tests for the current file
     */
    async generateTestsForFile(editor) {
        const code = editor.document.getText();
        const languageId = editor.document.languageId;
        // Determine test framework based on project
        const framework = this.detectTestFramework() || 'vitest';
        return await this.generateTests(code, framework);
    }
    detectTestFramework() {
        // Simple framework detection logic
        // In a real VS Code extension, you'd check package.json, existing test files, etc.
        return 'vitest'; // Default
    }
}
exports.VSCodeAIHelper = VSCodeAIHelper;
// Run example if this file is executed directly (disabled for CommonJS compilation)
// if (import.meta.url === `file://${process.argv[1]}`) {
//   example();
// }
//# sourceMappingURL=custom-functions-client.js.map