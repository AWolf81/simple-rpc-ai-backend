# Contributing to Simple RPC AI Backend

Thank you for your interest in contributing to Simple RPC AI Backend! This document provides guidelines for contributing to the project.

## 🎯 **Project Focus**

Our **core mission** is building a **secure, platform-agnostic JSON-RPC backend** for AI integration with **enterprise-grade billing capabilities**.

**Primary Focus Areas:**
1. **JSON-RPC Protocol** (Core functionality)
2. **Billing Integration** (Revenue & user management)
3. **Platform-Agnostic Design** (VS Code, web, CLI)
4. **Corporate Proxy Bypass** (Enterprise deployment)

**Testing Priority:**
- **VS Code** will be our primary testing platform
- **Web applications** and **CLI tools** receive equal architectural support
- **Corporate environments** are a key deployment target

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ 
- TypeScript knowledge
- Understanding of JSON-RPC 2.0 protocol
- Experience with billing systems (for billing contributions)
- Familiarity with enterprise deployment (helpful)

### **Development Setup**
```bash
# Clone the repository
git clone https://github.com/AWolf81/simple-rpc-ai-backend.git
cd simple-rpc-ai-backend

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests with coverage
pnpm test:coverage

# Start development server
pnpm dev

# Type checking
pnpm typecheck
```

## 📋 **Contribution Guidelines**

### **Code Style**
- **TypeScript**: Strict typing throughout, no `any` types
- **Formatting**: Follow existing project patterns
- **Naming**: 
  - Functions: `camelCase`
  - Classes: `PascalCase`
  - Files: `kebab-case.ts`
  - JSON-RPC methods: `camelCase`

### **Pull Request Process**

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** following the guidelines below
4. **Add comprehensive tests** (≥80% coverage required)
5. **Update documentation** for API changes
6. **Run full test suite**: `pnpm build && pnpm test:coverage && pnpm typecheck`
7. **Submit a pull request** with detailed description

### **Pull Request Requirements**

✅ **Must Have:**
- Clear description of changes and rationale
- Tests maintaining ≥80% coverage
- Documentation updates for JSON-RPC method changes
- No breaking changes without major version bump
- Security considerations documented
- Cross-platform compatibility verified

❌ **Avoid:**
- Large PRs mixing unrelated changes
- Breaking changes without prior discussion
- New dependencies without strong justification
- Weakening security or billing protections
- Platform-specific solutions (prefer agnostic approaches)

## 🔧 **Types of Contributions**

### **🥇 Highest Priority**
- **JSON-RPC Protocol**: New methods, protocol improvements, error handling
- **Billing Integration**: Payment processing, subscription management, usage tracking
- **Authentication**: Progressive auth, session management, key storage
- **Corporate Features**: Proxy bypass, system prompt protection, enterprise deployment

### **🥈 High Priority**
- **Platform Adapters**: VS Code, web, CLI client improvements
- **AI Service Integration**: New providers, request optimization
- **Security Enhancements**: Encryption, validation, audit logging
- **Performance**: Request latency, billing calculations, database optimization

### **🥉 Medium Priority**
- **Developer Experience**: Better error messages, debugging tools, examples
- **Documentation**: API guides, deployment docs, troubleshooting
- **Testing Infrastructure**: E2E tests, load testing, security testing
- **Monitoring**: Metrics, health checks, observability

## 🧪 **Testing Requirements**

### **Coverage Standards**
- **Minimum 80% coverage** across branches, functions, lines, statements
- **Cross-platform testing** on Node.js 18, 20, 22
- **Integration tests** for complete workflows
- **Performance testing** - AI requests <30s, auth <200ms

### **Required Test Categories**
- **JSON-RPC Protocol**: All 12 methods, error cases, edge conditions
- **Billing Integration**: Payment flows, subscription logic, usage tracking
- **Authentication**: Progressive auth (anonymous → OAuth → Pro)
- **Platform Adapters**: VS Code, web, CLI client functionality
- **Security**: Input validation, key encryption, session management
- **Corporate Features**: Proxy bypass, system prompt protection

### **Testing Commands**
```bash
# Run all tests with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch

# Interactive test UI
pnpm test:ui

# Type checking
pnpm typecheck

# Clean build and full test suite
pnpm clean && pnpm build && pnpm test:coverage && pnpm typecheck
```

### **Platform-Specific Testing**
```bash
# Test basic server example
node examples/servers/basic-server.js

# Test AI server with billing
node examples/servers/ai-server-example.js

# VS Code extension testing (primary test platform)
code examples/extensions/
```

### **Known Issues to Test Around**
- **Billing module**: 6 TypeScript errors in `src/billing/opensaas-integration.ts`
- **Client crypto**: Demo hash function needs replacement with SHA-256
- **RPC discovery**: Missing `rpc.discover` method implementation

## 🔒 **Security & Billing Considerations**

### **Security-First Development**
- **System prompt protection** - Never expose prompts client-side
- **API key encryption** - Use AES-256-GCM for stored keys
- **Input validation** - Validate all JSON-RPC parameters
- **Corporate proxy compatibility** - Maintain enterprise deployment capability
- **Progressive authentication** - Support anonymous → OAuth → Pro flows

### **Billing Security**
- **Payment data isolation** - Never log payment information
- **Usage tracking accuracy** - Ensure billing calculations are precise
- **Subscription validation** - Verify user entitlements before processing
- **Rate limiting** - Protect against billing abuse
- **Audit logging** - Track all billing-related operations

## 📚 **Documentation**

### **Required Documentation Updates**
- **CLAUDE.md** - Update for JSON-RPC method changes
- **README.md** - Update for any API changes
- **Code comments** - Document billing logic and security operations
- **Examples** - Update server and client examples
- **TypeScript types** - Ensure all public APIs are properly typed

### **Documentation Standards**
- **JSON-RPC method documentation** - Parameters, returns, error codes
- **Billing integration guides** - Payment flows, subscription management
- **Security implications** - Always document security considerations
- **Corporate deployment** - Enterprise setup and proxy configuration
- **Migration guides** - For breaking changes

## 🐛 **Bug Reports**

### **Good Bug Reports Include:**
- **Clear description** of the issue
- **JSON-RPC method affected** (if applicable)
- **Reproduction steps** - step-by-step instructions
- **Expected vs actual behavior**
- **Environment details** (OS, Node.js version, platform)
- **Error messages** and stack traces
- **Billing impact** (if billing-related)

### **Critical Bug Categories**
- **Security vulnerabilities** - Use "security" label, follow responsible disclosure
- **Billing issues** - Payment failures, incorrect charges, subscription problems
- **JSON-RPC protocol issues** - Method failures, invalid responses
- **Corporate deployment** - Proxy bypass failures, enterprise incompatibility

## 💡 **Feature Requests**

### **High-Value Feature Requests:**
- **New JSON-RPC methods** - Expand API functionality
- **Billing improvements** - New payment methods, subscription features
- **Corporate features** - Enhanced enterprise deployment capabilities
- **Platform support** - New client platforms or improved existing ones
- **AI provider integration** - Support for additional AI services

### **Feature Request Template:**
- **Use case** - Why is this needed?
- **JSON-RPC impact** - New methods or changes to existing ones?
- **Billing implications** - How does this affect payment/subscription flows?
- **Security considerations** - Any security implications?
- **Platform compatibility** - Works across VS Code, web, CLI?
- **Implementation approach** - High-level implementation ideas

### **Feature Priority**
1. **JSON-RPC protocol enhancements**
2. **Billing and subscription improvements**
3. **Corporate deployment features**
4. **Platform compatibility improvements**
5. **Developer experience enhancements**

## 🔄 **Release Process**

### **Version Management**
- **Semantic versioning** for all releases
- **Breaking changes** require major version bump
- **Billing changes** require careful migration planning
- **Security fixes** get immediate priority releases

### **Release Checklist**
- **All tests passing** with ≥80% coverage
- **Documentation updated** including CLAUDE.md
- **Examples tested** across all platforms
- **Billing integration verified** (if applicable)
- **Security review** for authentication/billing changes
- **Corporate deployment tested** (proxy bypass functionality)

## 🏢 **Enterprise Contributions**

### **Corporate-Friendly Features**
- **Proxy bypass capabilities** - Essential for enterprise deployment
- **System prompt protection** - Keep proprietary prompts secure
- **Centralized billing** - Corporate subscription management
- **Audit logging** - Enterprise compliance requirements
- **Zero client configuration** - Reduce IT deployment complexity

### **Enterprise Testing**
- Test behind corporate proxies
- Verify system prompt isolation
- Validate billing accuracy in enterprise scenarios
- Ensure minimal client-side configuration requirements

## 🤝 **Community Guidelines**

### **Code of Conduct**
- **Be respectful** to all contributors
- **Constructive feedback** focused on code quality
- **Help others understand** JSON-RPC and billing concepts
- **Maintain professionalism** in all interactions
- **Share knowledge** about enterprise deployment challenges

### **Communication**
- **GitHub Issues** for bugs, features, and architectural discussions
- **Pull Request discussions** for code review and implementation details
- **Clear documentation** of JSON-RPC changes and billing implications

## 📞 **Getting Help**

### **Where to Ask Questions**
- **GitHub Issues** - Bugs, features, architectural questions
- **Pull Request comments** - Code-specific questions and reviews
- **CLAUDE.md** - Check project documentation first

### **Response Times**
- **Security/billing issues**: 1-2 business days
- **JSON-RPC protocol issues**: 2-5 business days
- **Platform compatibility**: 3-7 business days
- **General features**: 1-2 weeks
- **Pull requests**: 3-10 business days

*Note: Response times may vary based on complexity and maintainer availability.*

## 🏆 **Recognition**

Contributors are recognized through:
- **Contributors list** in repository
- **Release notes** for significant contributions
- **Documentation credits** for major features
- **Special recognition** for security and billing improvements

---

**Thank you for contributing to Simple RPC AI Backend! Your efforts help build secure, enterprise-ready AI integration infrastructure.** 🚀