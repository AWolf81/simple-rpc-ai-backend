/**
 * Example: Minimal MCP Extensions
 * Shows how to replace defaults with only custom prompts and resources
 */

import { createRpcAiServer } from '../dist/index.js';
import { config } from 'dotenv'

config({path: '.env.oauth'})

console.log('🎯 Minimal Custom MCP Extensions (Replace Defaults)');

const server = createRpcAiServer({
  port: 8009,
  
  // AI Provider Configuration for MCP Jam
  ai: {
    defaultProvider: 'anthropic',
    providers: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key-here',
        enabled: true,
        models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307']
      }
    },
    limits: {
      tokensPerRequest: 4000,
      requestsPerMinute: 50
    }
  },
  
  mcp: {
    enableMCP: true,
    transports: { 
      http: true,
      sse: true  // Enable SSE for MCP Jam chat streaming
    },
    
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

// Add custom tools to expose prompts and resources as callable MCP tools
import { z } from 'zod';
import { publicProcedure, router, mergeRouters } from '../dist/trpc/index.js';

const customToolsRouter = router({
  // Tool to invoke company-assistant prompt
  'company-assistant': publicProcedure
    .meta({
      mcp: {
        title: 'Company Assistant Prompt',
        description: 'Get a department-specific company assistant prompt',
        category: 'prompts'
      }
    })
    .input(z.object({
      department: z.enum(['engineering', 'sales', 'marketing', 'hr'])
        .describe('Department for the assistant')
    }))
    .mutation(async ({ input }) => {
      // This tool calls the MCP prompt and returns the processed template
      const response = await fetch('http://localhost:8009/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'prompts/get',
          params: {
            name: 'company-assistant',
            arguments: { department: input.department }
          }
        })
      });
      const result = await response.json();
      return {
        prompt: result.result?.messages?.[0]?.content?.text || 'Prompt not found',
        department: input.department
      };
    }),

  // Tool to access company handbook
  'company-handbook': publicProcedure
    .meta({
      mcp: {
        title: 'Company Handbook',
        description: 'Access company policies and procedures',
        category: 'resources'
      }
    })
    .input(z.object({}))
    .query(async () => {
      // This tool calls the MCP resource and returns the content
      const response = await fetch('http://localhost:8009/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'resources/read',
          params: {
            uri: 'file://company-handbook.json'
          }
        })
      });
      const result = await response.json();
      return result.result?.contents?.[0]?.text ? 
        JSON.parse(result.result.contents[0].text) : 
        { error: 'Handbook not found' };
    })
});

// Add the custom tools after server creation but before start
const currentRouter = server.getRouter();
const mergedRouter = mergeRouters(currentRouter, customToolsRouter);
server.setRouter(mergedRouter);

server.start().then(() => {
  console.log('✅ Simple MCP Server started on port 8009');
  console.log('\n💡 MCP Extensions (no auth - simple testing):');
  console.log('  • 1 prompt (company-assistant) - accessible via MCP prompts/get');  
  console.log('  • 1 resource (company-handbook) - accessible via MCP resources/read');
  console.log('  • 2 MCP tools for chat access:');
  console.log('    - company-assistant (prompt as tool)');
  console.log('    - company-handbook (resource as tool)');
  console.log('  • Auto-discovered MCP tools available');
  console.log('\n🌐 MCP Jam Connection:');
  console.log('  • Server URL: http://localhost:8009/mcp');
  console.log('  • Chat streaming: SSE enabled');
  console.log('  • AI Provider: Anthropic Claude');
  console.log('\n⚠️  HTTP only - for ngrok HTTPS, use: ngrok http 8009');
}).catch(console.error);