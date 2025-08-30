/**
 * Test OpenAPI Compatibility Middleware
 * 
 * Tests our custom middleware to fix trpc-to-openapi issues
 */

import { generateOpenApiDoc, createTestRouter } from '../dist/index.js';
import { patchTrpcToOpenApi, makeRouterOpenApiCompatible } from '../dist/trpc/openapi-compat-middleware.js';
import fs from 'fs';
import path from 'path';

console.log(`
🔧 Testing OpenAPI Compatibility Middleware

Attempting to fix trpc-to-openapi input validation issues
`);

// Test 1: Try monkey patching approach
console.log('📋 Test 1: Monkey patch approach...');
const patched = await patchTrpcToOpenApi();
console.log(patched ? '✅ Monkey patch applied' : '❌ Monkey patch failed');

// Test 2: Try router wrapping approach  
console.log('\n📋 Test 2: Router compatibility wrapping...');
const testRouter = createTestRouter();
const compatRouter = makeRouterOpenApiCompatible(testRouter);
console.log('✅ Router wrapped with compatibility layer');

// Test 3: Try OpenAPI generation with compatibility fixes
console.log('\n📋 Test 3: OpenAPI generation with fixes...');
let openApiDoc;
let success = false;

try {
  openApiDoc = generateOpenApiDoc(compatRouter, {
    title: 'Compatibility Test API',
    version: '1.0.0',
    description: 'Testing OpenAPI compatibility middleware',
    baseUrl: 'http://localhost:3000'
  });
  
  console.log('✅ OpenAPI document generated with compatibility middleware!');
  console.log('📊 Document info:', {
    title: openApiDoc.info.title,
    version: openApiDoc.info.version,
    pathCount: Object.keys(openApiDoc.paths || {}).length
  });
  
  success = true;
} catch (error) {
  console.error('❌ OpenAPI generation still failed:', error.message);
  console.log('🔍 Error details:', error.stack?.split('\n').slice(0, 3).join('\n'));
}

// Test 4: Save results
if (success && openApiDoc) {
  const outputPath = path.join(process.cwd(), 'examples', 'middleware-test-openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2));
  console.log('\n💾 OpenAPI document saved to:', outputPath);
  
  // Show the paths that were generated
  const paths = Object.keys(openApiDoc.paths || {});
  if (paths.length > 0) {
    console.log('\n🛣️  Generated endpoints:');
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
  console.log('\n❌ Middleware test failed - compatibility fixes need more work');
  
  // Provide some debugging info
  console.log('\n🔍 Debug info:');
  console.log('- Router type:', typeof compatRouter);
  console.log('- Has _def:', '_def' in compatRouter);
  console.log('- Router keys:', Object.keys(compatRouter));
}

console.log('\n🏁 Middleware compatibility test complete');

// Show next steps
console.log('\n📝 Next Steps:');
console.log('1. If successful: Integrate middleware into main server');
console.log('2. If failed: Need to dig deeper into trpc-to-openapi source');
console.log('3. Consider contributing fix back to trpc-to-openapi repo');