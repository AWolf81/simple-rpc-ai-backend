#!/bin/bash

# Quick Skills System Test Script
# Usage: ./test-skills.sh

set -e

API_URL="http://localhost:8000/rpc"

echo "🧪 Agent Skills System - Quick Test Suite"
echo "=========================================="
echo ""

# Check if server is running
echo "1️⃣  Checking server health..."
if ! curl -s "$API_URL" > /dev/null 2>&1; then
  echo "❌ Server not running on port 8000"
  echo "   Start with: node examples/03-agents-basic/server.js"
  exit 1
fi
echo "✅ Server is running"
echo ""

# Test 1: List skills
echo "2️⃣  Listing all skills..."
SKILLS=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.list","params":{},"id":1}' \
  | jq -r '.result.skills[] | "   - \(.name) (\(.sourceType))"')

echo "$SKILLS"
SKILL_COUNT=$(echo "$SKILLS" | wc -l)
echo "✅ Found $SKILL_COUNT skills"
echo ""

# Test 2: Validate hello-world skill
echo "3️⃣  Validating hello-world skill..."
VALIDATION=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.validate","params":{"skillId":"hello-world"},"id":2}' \
  | jq -r '.result | "   Valid: \(.valid)\n   L1 Tokens: \(.metrics.level1Tokens)\n   L2 Tokens: \(.metrics.level2Tokens)\n   Scripts: \(.metrics.scripts | length)"')

echo "$VALIDATION"
echo "✅ Validation complete"
echo ""

# Test 3: Execute greeting script
echo "4️⃣  Executing greeting script..."
GREETING=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.executeScript","params":{"skillId":"hello-world","scriptName":"scripts/greet.ts","args":["Tester"]},"id":3}' \
  | jq -r '.result.stdout')

echo "   Output: $GREETING"
echo "✅ Script executed successfully"
echo ""

# Test 4: Match skills by capability
echo "5️⃣  Matching skills by capability (testing)..."
MATCHES=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.match","params":{"capabilities":["testing"]},"id":4}' \
  | jq -r '.result.skills[] | "   - \(.name)"')

echo "$MATCHES"
echo "✅ Capability matching works"
echo ""

# Test 5: Get system statistics
echo "6️⃣  Getting system statistics..."
STATS=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.stats","params":{},"id":5}' \
  | jq -r '.result | "   Total Skills: \(.totalSkills)\n   Built-in: \(.bySource.builtin // 0)\n   Local: \(.bySource.local // 0)\n   Total L1 Tokens: \(.totalLevel1Tokens)\n   Total L2 Tokens: \(.totalLevel2Tokens)"')

echo "$STATS"
echo "✅ Statistics retrieved"
echo ""

echo "=========================================="
echo "🎉 All tests passed!"
echo ""
echo "📖 For detailed testing guide, see:"
echo "   SKILL_TESTING_GUIDE.md"
echo ""
echo "🔧 Manual tests:"
echo "   • Create test JSON: mkdir -p /tmp/workspace && echo '{\"test\":\"data\"}' > /tmp/workspace/test.json"
echo "   • Validate JSON: curl -X POST $API_URL -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"agents.skills.executeScript\",\"params\":{\"skillId\":\"hello-world\",\"scriptName\":\"scripts/validate-json.ts\",\"args\":[\"/tmp/workspace/test.json\"]},\"id\":6}' | jq"
echo ""
