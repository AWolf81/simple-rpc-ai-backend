/**
 * Example: Minimal MCP Extensions
 * Shows how to replace defaults with only custom prompts and resources
 */

import { createRpcAiServer } from '../dist/index.js';

console.log('🎯 Minimal Custom MCP Extensions (Replace Defaults)');

const server = createRpcAiServer({
  port: 8007,
  mcp: {
    enableMCP: true,
    transports: { http: true },
    
    extensions: {
      prompts: {
        includeDefaults: false,   // 🚫 No default prompts
        
        customPrompts: [
          {
            name: 'company-assistant',
            description: 'Internal company knowledge assistant',
            arguments: [
              {
                name: 'department',
                description: 'Department (engineering, sales, marketing, hr)',
                required: true
              }
            ]
          }
        ],
        
        customTemplates: {
          'company-assistant': {
            name: 'company-assistant',
            description: 'Company-specific assistant',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: 'You are our internal {{department}} assistant. Help with department-specific tasks and company policies.'
                }
              }
            ]
          }
        }
      },
      
      resources: {
        includeDefaults: false,   // 🚫 No default resources
        
        customResources: [
          {
            uri: 'file://company-handbook.json',
            name: 'Company Handbook',
            description: 'Company policies and procedures',
            mimeType: 'application/json'
          }
        ],
        
        customHandlers: {
          'company-handbook.json': () => ({
            company: 'My Company Inc.',
            policies: {
              remote_work: 'Hybrid - 3 days in office',
              vacation_days: 25,
              health_insurance: 'Premium plan included'
            },
            departments: ['engineering', 'sales', 'marketing', 'hr'],
            contact: {
              hr: 'hr@company.com',
              it: 'it@company.com'
            }
          })
        }
      }
    }
  }
});

server.start().then(() => {
  console.log('✅ Minimal server started on port 8007');
  console.log('\n💡 Only custom content available:');
  console.log('  • 1 prompt (company-assistant)');  
  console.log('  • 1 resource (company-handbook)');
  console.log('  • No default Simple RPC AI prompts/resources');
}).catch(console.error);