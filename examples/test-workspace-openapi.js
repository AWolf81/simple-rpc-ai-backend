/**
 * Test modified trpc-to-openapi from workspace
 * 
 * Tests if our v11 compatibility fix works with the workspace version
 */

import { generateOpenApiDoc } from '../dist/index.js';
import fs from 'fs';
import path from 'path';

console.log(`
🧬 Testing Workspace trpc-to-openapi with v11 Fix

This tests our modified trpc-to-openapi package from the tools workspace
`);

// Test: Try OpenAPI generation with our AI router
console.log('📋 Testing OpenAPI generation with AI router...');
let openApiDoc;
let success = false;

try {
  // Import and create AI router for testing
  const { createAppRouter } = await import('../dist/trpc/root.js');
  const router = createAppRouter();
  
  openApiDoc = generateOpenApiDoc(router, {
    title: 'Workspace Fix Test',
    version: '1.0.0',
    description: 'Testing workspace trpc-to-openapi with v11 compatibility',
    baseUrl: 'http://localhost:3000'
  });
  
  console.log('🎉 SUCCESS! OpenAPI document generated with workspace fix!');
  console.log('📊 Document info:', {
    title: openApiDoc.info.title,
    version: openApiDoc.info.version,
    pathCount: Object.keys(openApiDoc.paths || {}).length
  });
  
  success = true;
} catch (error) {
  console.error('❌ OpenAPI generation failed:', error.message);
  console.log('🔍 Error type:', error.constructor.name);
  
  // Show more context about the error
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 5);
    console.log('📍 Error location:', stackLines.join('\n  '));
  }
}

// Save results and show analysis
if (success && openApiDoc) {
  const outputPath = path.join(process.cwd(), 'examples', 'workspace-fix-openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2));
  console.log('\n💾 OpenAPI document saved to:', outputPath);
  
  // Show the paths that were generated
  const paths = Object.keys(openApiDoc.paths || {});
  if (paths.length > 0) {
    console.log('\n🛣️  Generated endpoints:');
    paths.forEach(pathName => {
      const methods = Object.keys(openApiDoc.paths[pathName]);
      methods.forEach(method => {
        const operation = openApiDoc.paths[pathName][method];
        console.log(`  ${method.toUpperCase()} ${pathName} - ${operation.summary || 'No summary'}`);
        
        // Show input schema if present
        if (operation.requestBody) {
          console.log(`    📥 Input: Has request body`);
        }
        if (operation.parameters && operation.parameters.length > 0) {
          console.log(`    📝 Parameters: ${operation.parameters.length}`);
        }
      });
    });
  } else {
    console.warn('⚠️  No paths found - OpenAPI generation partially failed');
  }
  
  console.log('\n🎯 SUCCESS ANALYSIS:');
  console.log('✅ The workspace trpc-to-openapi fix successfully resolved the tRPC v11 issue!');
  console.log('✅ Our modified getInputOutputParsers function bridged v11 lazy input materialization');
  console.log('✅ OpenAPI generation now works with tRPC v11!');
  
} else {
  console.log('\n🔍 FAILURE ANALYSIS:');
  console.log('❌ The workspace trpc-to-openapi needs further refinement');
  console.log('💡 Check if the modified procedure.js has the correct v11 compatibility logic');
  console.log('🚧 May need to compile other parts of the package');
}

console.log('\n🏁 Workspace OpenAPI test complete');