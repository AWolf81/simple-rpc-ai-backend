/**
 * Default MCP prompts provided by Simple RPC AI Backend
 */
/**
 * Default prompts list for MCP prompts/list
 */
export const DEFAULT_PROMPTS = [
    {
        name: 'ai-code-review',
        description: 'Comprehensive code review prompt for analyzing code quality, security, and best practices',
        arguments: [
            {
                name: 'language',
                description: 'Programming language (e.g., typescript, javascript, python)',
                required: true
            },
            {
                name: 'focus',
                description: 'Review focus area (security, performance, maintainability, all)',
                required: false
            }
        ]
    },
    {
        name: 'api-documentation',
        description: 'Generate comprehensive API documentation from code',
        arguments: [
            {
                name: 'format',
                description: 'Documentation format (openapi, markdown, jsdoc)',
                required: false
            },
            {
                name: 'include_examples',
                description: 'Include usage examples (true/false)',
                required: false
            }
        ]
    },
    {
        name: 'debug-assistant',
        description: 'Debug code issues with detailed analysis and solutions',
        arguments: [
            {
                name: 'error_type',
                description: 'Type of error (runtime, compile, logic, performance)',
                required: true
            },
            {
                name: 'context',
                description: 'Additional context about when the error occurs',
                required: false
            }
        ]
    },
    {
        name: 'test-generator',
        description: 'Generate comprehensive unit tests for given code',
        arguments: [
            {
                name: 'test_framework',
                description: 'Testing framework (jest, mocha, pytest, vitest)',
                required: true
            },
            {
                name: 'coverage_level',
                description: 'Test coverage level (basic, comprehensive, edge-cases)',
                required: false
            }
        ]
    }
];
/**
 * Default prompt templates for MCP prompts/get
 */
export const DEFAULT_PROMPT_TEMPLATES = {
    'ai-code-review': {
        name: 'ai-code-review',
        description: 'Comprehensive code review prompt',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `You are an expert code reviewer with deep knowledge of {{language}} and software engineering best practices. 

Please perform a comprehensive code review focusing on {{focus}}:

🔍 **Code Quality Analysis:**
- Code structure and organization
- Naming conventions and readability
- DRY principles and code reusability
- Error handling and edge cases

🛡️ **Security Review:**
- Input validation and sanitization
- Authentication and authorization
- Data encryption and secure storage
- Potential security vulnerabilities

⚡ **Performance Analysis:**
- Algorithm efficiency and complexity
- Memory usage optimization
- Database query efficiency
- Caching strategies

🧪 **Testing & Maintainability:**
- Test coverage and quality
- Documentation completeness
- Dependency management
- Refactoring opportunities

Please provide:
1. **Overall Assessment**: Brief summary of code quality
2. **Critical Issues**: High-priority problems requiring immediate attention
3. **Improvements**: Specific suggestions with code examples
4. **Best Practices**: Recommendations aligned with industry standards
5. **Security Concerns**: Any security-related findings

Format your response with clear sections and actionable recommendations.`
                }
            }
        ]
    },
    'api-documentation': {
        name: 'api-documentation',
        description: 'Generate comprehensive API documentation',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `You are an expert technical writer specializing in API documentation. 

Please generate comprehensive {{format}} for the provided API code.

📋 **Documentation Requirements:**
- Clear endpoint descriptions
- Request/response schemas
- Parameter specifications
- HTTP status codes
- Authentication requirements
{{#if include_examples}}- Usage examples and code samples{{/if}}
- Error handling documentation

🎯 **Format Guidelines:**
{{#eq format "openapi"}}
- Use OpenAPI 3.0 specification
- Include complete schema definitions
- Provide example requests/responses
{{/eq}}
{{#eq format "markdown"}}
- Use clear markdown formatting
- Include table of contents
- Provide code blocks with syntax highlighting
{{/eq}}
{{#eq format "jsdoc"}}
- Use JSDoc comment syntax
- Include @param and @returns tags
- Provide @example blocks
{{/eq}}

📚 **Content Structure:**
1. **Overview**: Brief API description and purpose
2. **Authentication**: How to authenticate requests
3. **Endpoints**: Detailed endpoint documentation
4. **Data Models**: Schema definitions
5. **Error Codes**: Common error responses
{{#if include_examples}}6. **Examples**: Real-world usage examples{{/if}}

Please ensure the documentation is professional, comprehensive, and developer-friendly.`
                }
            }
        ]
    },
    'debug-assistant': {
        name: 'debug-assistant',
        description: 'Debug code issues with detailed analysis',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `You are an expert debugging specialist with extensive experience in {{error_type}} error analysis and resolution.

🔧 **Debug Analysis Request:**
Error Type: {{error_type}}
{{#if context}}Context: {{context}}{{/if}}

🕵️ **Analysis Framework:**

1. **Error Identification:**
   - Root cause analysis
   - Error categorization
   - Impact assessment

2. **Code Investigation:**
   - Line-by-line analysis
   - Variable state examination
   - Execution flow tracing
   - Dependency checks

3. **Solution Development:**
   - Multiple solution approaches
   - Code fixes with explanations
   - Prevention strategies
   - Testing recommendations

4. **Best Practices:**
   - Error prevention techniques
   - Debugging methodologies
   - Monitoring and logging improvements

🎯 **Deliverables:**
- **Problem Summary**: Clear description of the issue
- **Root Cause**: Technical explanation of why it occurs  
- **Solution**: Step-by-step fix with code examples
- **Verification**: How to test the fix
- **Prevention**: How to avoid similar issues

Please provide detailed analysis with actionable solutions and code examples.`
                }
            }
        ]
    },
    'test-generator': {
        name: 'test-generator',
        description: 'Generate comprehensive unit tests',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `You are a test automation expert specializing in {{test_framework}} and comprehensive test coverage.

🧪 **Test Generation Requirements:**
Framework: {{test_framework}}
Coverage Level: {{coverage_level}}

📋 **Test Suite Structure:**

1. **Setup & Teardown:**
   - Test environment configuration
   - Mock setup and cleanup
   - Test data preparation

2. **Unit Tests:**
   - Happy path scenarios
   - Edge cases and boundary conditions
   - Error handling tests
   - Input validation tests

3. **Integration Tests:**
   - API endpoint testing
   - Database interaction tests
   - External service mocking

4. **Test Categories:**
{{#eq coverage_level "basic"}}
   - Core functionality tests
   - Basic error scenarios
{{/eq}}
{{#eq coverage_level "comprehensive"}}
   - Comprehensive functionality tests
   - Edge cases and boundary tests
   - Error handling scenarios
   - Performance tests
{{/eq}}
{{#eq coverage_level "edge-cases"}}
   - All edge cases and corner scenarios
   - Stress testing
   - Negative testing
   - Security testing
{{/eq}}

🎯 **Test Features:**
- Descriptive test names
- Arrange-Act-Assert pattern
- Mock usage where appropriate
- Assertion explanations
- Performance benchmarks (if applicable)

Please generate production-ready tests with clear documentation and good coverage.`
                }
            }
        ]
    }
};
