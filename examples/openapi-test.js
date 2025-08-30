/**
 * Standalone OpenAPI Generation Test
 * 
 * Tests trpc-to-openapi generation with minimal setup
 */

import { createTestRouter, generateOpenApiDoc } from '../dist/index.js';
import fs from 'fs';
import path from 'path';

console.log(`
🧪 OpenAPI Generation Test

Testing trpc-to-openapi with minimal router setup
`);

// Create minimal test router
console.log('📋 Creating test router...');
const testRouter = createTestRouter();

// Test OpenAPI generation
console.log('🔧 Generating OpenAPI document...');
let openApiDoc;
let success = false;

try {
  openApiDoc = generateOpenApiDoc(testRouter, {
    title: 'Test API',
    version: '1.0.0',
    description: 'OpenAPI generation test',
    baseUrl: 'http://localhost:3000'
  });
  
  console.log('✅ OpenAPI document generated successfully!');
  console.log('📊 Document info:', {
    title: openApiDoc.info.title,
    version: openApiDoc.info.version,
    pathCount: Object.keys(openApiDoc.paths || {}).length
  });
  
  success = true;
} catch (error) {
  console.error('❌ OpenAPI generation failed:', error.message);
  console.error('Stack:', error.stack);
}

// Save the generated document
if (success && openApiDoc) {
  const outputPath = path.join(process.cwd(), 'examples', 'generated-openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2));
  console.log('💾 OpenAPI document saved to:', outputPath);
  
  // Show the paths that were generated
  const paths = Object.keys(openApiDoc.paths || {});
  if (paths.length > 0) {
    console.log('🛣️  Generated endpoints:');
    paths.forEach(path => {
      const methods = Object.keys(openApiDoc.paths[path]);
      methods.forEach(method => {
        const operation = openApiDoc.paths[path][method];
        console.log(`  ${method.toUpperCase()} ${path} - ${operation.summary || 'No summary'}`);
      });
    });
  } else {
    console.warn('⚠️  No paths found in generated document');
  }
} else {
  console.log('❌ Test failed - no document to save');
}

console.log('\n🏁 OpenAPI generation test complete');