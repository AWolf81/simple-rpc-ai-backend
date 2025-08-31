/**
 * Example: Custom MCP Extensions
 * Shows how to extend the default prompts and resources in Simple RPC AI Backend
 */

import { createRpcAiServer } from '../dist/index.js';

console.log('🎨 Custom MCP Extensions Example');

// Example server with custom prompts and resources
const server = createRpcAiServer({
  port: 8006,
  mcp: {
    enableMCP: true,
    transports: {
      http: true,
      stdio: false, 
      sse: false
    },
    
    // 🎯 MCP Extensions - Custom prompts and resources
    extensions: {
      prompts: {
        includeDefaults: true,    // Keep the 4 default AI prompts
        
        // ➕ Add custom prompts
        customPrompts: [
          {
            name: 'database-optimizer',
            description: 'Optimize database queries and schemas for better performance',
            arguments: [
              {
                name: 'database_type',
                description: 'Type of database (postgresql, mysql, mongodb, etc.)',
                required: true
              },
              {
                name: 'optimization_goal',
                description: 'Optimization goal (performance, storage, scalability)',
                required: false
              }
            ]
          },
          {
            name: 'security-audit',
            description: 'Comprehensive security audit for applications and infrastructure',
            arguments: [
              {
                name: 'audit_scope',
                description: 'Scope of audit (application, infrastructure, network, all)',
                required: true
              },
              {
                name: 'compliance_framework',
                description: 'Compliance framework (GDPR, SOC2, HIPAA, PCI-DSS)',
                required: false
              }
            ]
          }
        ],
        
        // 📝 Custom prompt templates with dynamic content
        customTemplates: {
          'database-optimizer': {
            name: 'database-optimizer',
            description: 'Database optimization expert prompt',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `You are a database optimization expert specializing in {{database_type}} systems.

🎯 **Optimization Goal**: {{optimization_goal}}

🔍 **Analysis Areas:**
- Query performance and execution plans
- Index optimization and usage patterns
- Schema design and normalization
- Connection pooling and resource management
- Caching strategies and implementation

📊 **Deliverables:**
1. **Performance Analysis**: Identify bottlenecks and slow queries
2. **Optimization Recommendations**: Specific improvements with expected impact
3. **Index Strategy**: Optimal indexing for your use case
4. **Schema Review**: Structural improvements and best practices
5. **Monitoring Setup**: Tools and metrics to track performance

Please provide actionable recommendations with performance impact estimates.`
                }
              }
            ]
          },
          
          'security-audit': {
            name: 'security-audit',
            description: 'Security audit expert prompt',
            messages: [
              {
                role: 'user', 
                content: {
                  type: 'text',
                  text: `You are a cybersecurity expert conducting a comprehensive security audit.

🔒 **Audit Scope**: {{audit_scope}}
{{#if compliance_framework}}📋 **Compliance Framework**: {{compliance_framework}}{{/if}}

🛡️ **Security Assessment Areas:**
- Authentication and authorization mechanisms
- Data encryption (at rest and in transit)
- Input validation and injection prevention
- Access controls and privilege management
- Network security and firewall configuration
- Vulnerability assessment and patch management

📋 **Audit Framework:**
1. **Threat Modeling**: Identify potential attack vectors
2. **Vulnerability Assessment**: Technical security weaknesses
3. **Compliance Review**: Regulatory requirement adherence
4. **Risk Analysis**: Impact and likelihood assessment
5. **Remediation Plan**: Prioritized security improvements

🎯 **Deliverables:**
- Executive security summary
- Detailed findings with severity ratings
- Compliance gap analysis
- Implementation roadmap with timelines
- Security monitoring recommendations

Please provide a systematic security evaluation with actionable remediation steps.`
                }
              }
            ]
          }
        },
        
        // ❌ Exclude specific default prompts (optional)
        // excludeDefaults: ['test-generator']
      },
      
      resources: {
        includeDefaults: true,     // Keep the 8 default resources
        
        // ➕ Add custom resources
        customResources: [
          {
            uri: 'file://custom-config.json',
            name: 'Custom Application Config',
            description: 'Custom application configuration and feature flags',
            mimeType: 'application/json'
          },
          {
            uri: 'file://deployment-info.json', 
            name: 'Deployment Information',
            description: 'Current deployment status and environment details',
            mimeType: 'application/json'
          },
          {
            uri: 'https://docs.your-company.com/api',
            name: 'Company API Documentation',
            description: 'Internal API documentation and standards',
            mimeType: 'text/html'
          }
        ],
        
        // 🔧 Custom resource handlers for reading resources
        customHandlers: {
          'custom-config.json': () => ({
            application: {
              name: 'My Custom App',
              version: '2.1.0',
              environment: process.env.NODE_ENV || 'development'
            },
            features: {
              advanced_analytics: true,
              beta_features: false,
              custom_integrations: true
            },
            integrations: {
              database: 'postgresql',
              cache: 'redis', 
              queue: 'bullmq',
              monitoring: 'datadog'
            }
          }),
          
          'deployment-info.json': () => ({
            deployment: {
              id: `deploy-${Date.now()}`,
              timestamp: new Date().toISOString(),
              version: '2.1.0',
              environment: 'production',
              region: 'us-east-1'
            },
            infrastructure: {
              containers: 3,
              load_balancer: 'active',
              database_replicas: 2,
              cache_nodes: 1
            },
            health: {
              status: 'healthy',
              uptime_seconds: Math.floor(process.uptime()),
              last_check: new Date().toISOString()
            }
          })
        },
        
        // ❌ Exclude specific default resources (optional)  
        // excludeDefaults: ['file://usage-analytics.json']
      }
    }
  }
});

server.start().then(() => {
  console.log('✅ Server with custom MCP extensions started on port 8006');
  console.log('\n🧪 Test the extensions:');
  
  console.log('\n📝 Custom Prompts:');
  console.log('  List all (including custom): curl -X POST http://localhost:8006/mcp -d \'{"jsonrpc":"2.0","id":1,"method":"prompts/list"}\'');
  console.log('  Get database optimizer: curl -X POST http://localhost:8006/mcp -d \'{"jsonrpc":"2.0","id":2,"method":"prompts/get","params":{"name":"database-optimizer","arguments":{"database_type":"postgresql","optimization_goal":"performance"}}}\'');
  
  console.log('\n📂 Custom Resources:');
  console.log('  List all (including custom): curl -X POST http://localhost:8006/mcp -d \'{"jsonrpc":"2.0","id":3,"method":"resources/list"}\'');
  console.log('  Read custom config: curl -X POST http://localhost:8006/mcp -d \'{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"file://custom-config.json"}}\'');
  
  console.log('\n💡 Features:');
  console.log('  • 6 total prompts (4 default + 2 custom)');
  console.log('  • 11 total resources (8 default + 3 custom)');
  console.log('  • Dynamic template substitution with {{variables}}');
  console.log('  • Configurable inclusion/exclusion of defaults');
}).catch(console.error);