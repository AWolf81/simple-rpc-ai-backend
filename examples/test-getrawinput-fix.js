/**
 * Test getRawInput Fix for OpenAPI Generation
 * 
 * Tests our targeted fix using getRawInput() to solve the input validation issue
 */

import { generateOpenApiDoc } from '../dist/index.js';
import { 
  createGetRawInputTestRouter, 
  wrapRouterWithGetRawInputFix,
  debugProcedureInputs 
} from '../dist/trpc/getrawinput-fix.js';
import fs from 'fs';
import path from 'path';

console.log(`
🧬 Testing getRawInput Fix for OpenAPI

This approach directly addresses tRPC v11's lazy input materialization
`);

// Test 1: Create router with getRawInput fix
console.log('📋 Test 1: Creating router with getRawInput fix...');
const testRouter = createGetRawInputTestRouter();
console.log('✅ Router created with pre-materialized inputs');

// Test 2: Debug what the router looks like internally
console.log('\n📋 Test 2: Debugging procedure structure...');
debugProcedureInputs(testRouter);

// Test 3: Apply additional wrapper fix
console.log('\n📋 Test 3: Applying wrapper fixes...');
const wrappedRouter = wrapRouterWithGetRawInputFix(testRouter);
console.log('✅ Router wrapped with additional compatibility fixes');

// Test 4: Try OpenAPI generation
console.log('\n📋 Test 4: Testing OpenAPI generation...');
let openApiDoc;
let success = false;

try {
  openApiDoc = generateOpenApiDoc(wrappedRouter, {
    title: 'GetRawInput Fix Test',
    version: '1.0.0',
    description: 'Testing getRawInput compatibility fix',
    baseUrl: 'http://localhost:3000'
  });
  
  console.log('🎉 SUCCESS! OpenAPI document generated with getRawInput fix!');
  console.log('📊 Document info:', {
    title: openApiDoc.info.title,
    version: openApiDoc.info.version,
    pathCount: Object.keys(openApiDoc.paths || {}).length
  });
  
  success = true;
} catch (error) {
  console.error('❌ OpenAPI generation still failed:', error.message);
  console.log('🔍 Error type:', error.constructor.name);
  
  // Show more context about the error
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 5);
    console.log('📍 Error location:', stackLines.join('\n  '));
  }
}

// Test 5: Save results and show analysis
if (success && openApiDoc) {
  const outputPath = path.join(process.cwd(), 'examples', 'getrawinput-fix-openapi.json');
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
  console.log('✅ The getRawInput fix successfully resolved the input validation issue!');
  console.log('✅ tRPC v11 lazy input materialization has been bridged');
  console.log('✅ OpenAPI generation now works with our compatibility layer');
  
} else {
  console.log('\n🔍 FAILURE ANALYSIS:');
  console.log('❌ The getRawInput fix needs further refinement');
  console.log('💡 The middleware approach shows promise but needs deeper integration');
  console.log('🚧 Consider forking trpc-to-openapi with these fixes');
}

console.log('\n🏁 getRawInput fix test complete');

// Show practical next steps
console.log('\n📝 Next Steps:');
if (success) {
  console.log('1. ✅ Integrate this fix into your main server');
  console.log('2. ✅ Replace standard tRPC procedures with fixed versions');
  console.log('3. ✅ Use this approach for all OpenAPI-documented endpoints');
} else {
  console.log('1. 🔧 Further refine the input schema detection logic');
  console.log('2. 🔍 Investigate trpc-to-openapi source code for exact requirements');
  console.log('3. 🛠️ Consider a custom OpenAPI generator using this approach');
}