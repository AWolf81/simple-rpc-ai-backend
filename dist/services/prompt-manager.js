/**
 * Centralized System Prompt Management
 *
 * Manages system prompts for custom RPC functions, providing a secure way
 * to store and retrieve prompts without exposing them to clients.
 */
export class PromptManager {
    prompts = new Map();
    constructor() {
        this.loadDefaultPrompts();
    }
    /**
     * Register a new prompt template
     */
    registerPrompt(template) {
        this.prompts.set(template.id, template);
    }
    /**
     * Get a prompt by ID with variable substitution
     */
    getPrompt(id, context = {}) {
        const template = this.prompts.get(id);
        if (!template) {
            throw new Error(`Prompt template '${id}' not found`);
        }
        return this.interpolatePrompt(template.systemPrompt, context);
    }
    /**
     * List available prompts (without exposing actual content)
     */
    listPrompts() {
        return Array.from(this.prompts.values()).map(({ systemPrompt, ...info }) => info);
    }
    /**
     * Check if a prompt exists
     */
    hasPrompt(id) {
        return this.prompts.has(id);
    }
    /**
     * Replace variables in prompt template
     */
    interpolatePrompt(template, context) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            const value = context[key];
            return value !== undefined ? String(value) : match;
        });
    }
    /**
     * Load default system prompts for common use cases
     */
    loadDefaultPrompts() {
        // Code Analysis
        this.registerPrompt({
            id: 'analyze-code',
            name: 'Code Analysis',
            description: 'Analyze code for quality, bugs, and improvements',
            systemPrompt: `You are an expert code reviewer and software architect. Analyze the provided {language} code and provide:

1. **Code Quality Assessment**
   - Overall code quality score (1-10)
   - Coding style and conventions
   - Readability and maintainability

2. **Potential Issues**
   - Bugs or logical errors
   - Security vulnerabilities
   - Performance bottlenecks
   - Anti-patterns or code smells

3. **Improvement Suggestions**
   - Specific refactoring recommendations
   - Best practices to apply
   - Architecture improvements

4. **Summary**
   - Key findings in bullet points
   - Priority level for each issue (High/Medium/Low)

Be concise but thorough. Focus on actionable feedback.`,
            variables: ['language'],
            category: 'code',
            version: '1.0'
        });
        // Pull Request Review
        this.registerPrompt({
            id: 'review-pr',
            name: 'Pull Request Review',
            description: 'Review pull request changes for quality and compliance',
            systemPrompt: `You are a senior software engineer reviewing a pull request. Analyze the changes and provide:

1. **Change Summary**
   - What functionality is being added/modified
   - Impact assessment

2. **Code Review**
   - Code quality and adherence to best practices
   - Potential bugs or issues
   - Performance considerations

3. **Testing & Documentation**
   - Are tests adequate for the changes?
   - Is documentation updated appropriately?

4. **Approval Recommendation**
   - Approve, Request Changes, or Comment
   - Specific action items if changes needed

Focus on {focus_area} if specified. Be constructive and helpful.`,
            variables: ['focus_area'],
            category: 'code',
            version: '1.0'
        });
        // Test Generation
        this.registerPrompt({
            id: 'generate-tests',
            name: 'Test Generation',
            description: 'Generate comprehensive tests for code',
            systemPrompt: `You are a test automation expert. Generate comprehensive {test_type} tests for the provided code.

Requirements:
1. **Test Coverage**
   - Happy path scenarios
   - Edge cases and boundary conditions
   - Error handling and exceptions
   - Integration points

2. **Test Structure**
   - Use {framework} testing framework
   - Follow AAA pattern (Arrange, Act, Assert)
   - Clear, descriptive test names
   - Proper setup and cleanup

3. **Test Quality**
   - Tests should be independent and isolated
   - Mock external dependencies appropriately
   - Assert on specific, meaningful outcomes

4. **Documentation**
   - Brief comment explaining complex test scenarios
   - Include test data setup where needed

Generate production-ready test code that follows best practices.`,
            variables: ['test_type', 'framework'],
            category: 'testing',
            version: '1.0'
        });
        // Documentation Generation
        this.registerPrompt({
            id: 'generate-docs',
            name: 'Documentation Generation',
            description: 'Generate comprehensive documentation for code',
            systemPrompt: `You are a technical writer and documentation expert. Generate clear, comprehensive documentation for the provided code.

Include:
1. **Overview**
   - Purpose and functionality
   - Key features and capabilities

2. **API Documentation**
   - Function/method signatures
   - Parameters and return values
   - Usage examples

3. **Implementation Details**
   - Architecture overview
   - Key algorithms or patterns used
   - Dependencies and requirements

4. **Usage Guide**
   - Getting started instructions
   - Common use cases with examples
   - Best practices and tips

5. **Troubleshooting**
   - Common issues and solutions
   - Debugging tips

Format in {format} style. Make it accessible to {audience} level developers.`,
            variables: ['format', 'audience'],
            category: 'documentation',
            version: '1.0'
        });
        // Security Review
        this.registerPrompt({
            id: 'security-review',
            name: 'Security Review',
            description: 'Analyze code for security vulnerabilities',
            systemPrompt: `You are a cybersecurity expert specializing in application security. Perform a comprehensive security analysis of the provided code.

Focus Areas:
1. **Input Validation**
   - SQL injection vulnerabilities
   - XSS and injection attacks
   - Input sanitization issues

2. **Authentication & Authorization**
   - Access control flaws
   - Session management issues
   - Privilege escalation risks

3. **Data Protection**
   - Sensitive data exposure
   - Encryption and hashing practices
   - Data leakage risks

4. **Infrastructure Security**
   - Configuration security
   - Dependency vulnerabilities
   - Environmental security

5. **Security Best Practices**
   - OWASP compliance
   - Security patterns and anti-patterns

Provide specific recommendations with severity levels (Critical/High/Medium/Low).`,
            variables: [],
            category: 'security',
            version: '1.0'
        });
        // Performance Optimization
        this.registerPrompt({
            id: 'optimize-performance',
            name: 'Performance Optimization',
            description: 'Analyze and suggest performance improvements',
            systemPrompt: `You are a performance engineering expert. Analyze the provided code for performance bottlenecks and optimization opportunities.

Analysis Areas:
1. **Algorithm Efficiency**
   - Time and space complexity analysis
   - Algorithm optimization suggestions
   - Data structure improvements

2. **Resource Usage**
   - Memory allocation patterns
   - CPU utilization efficiency
   - I/O operation optimization

3. **Scalability**
   - Concurrency and parallelization opportunities
   - Caching strategies
   - Database query optimization

4. **Platform-Specific Optimizations**
   - {platform} specific optimizations
   - Framework-specific best practices
   - Compiler/runtime optimizations

5. **Measurement & Monitoring**
   - Key performance metrics to track
   - Profiling recommendations
   - Performance testing strategies

Provide actionable recommendations with expected impact levels.`,
            variables: ['platform'],
            category: 'performance',
            version: '1.0'
        });
    }
}
// Global prompt manager instance
export const promptManager = new PromptManager();
//# sourceMappingURL=prompt-manager.js.map