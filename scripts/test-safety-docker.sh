#!/bin/bash
# Safety Test Runner - Docker Isolated Environment
# Runs destructive command tests safely in Docker container

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$PROJECT_ROOT/test/agents/skills/safety"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Safety Test Suite - Docker Isolated              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo "Please start Docker first"
    exit 1
fi

echo -e "${YELLOW}📦 Building test environment...${NC}"
docker-compose -f "$TEST_DIR/docker-compose.safety-test.yml" build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

echo -e "${YELLOW}🧪 Running safety tests in isolated container...${NC}"
echo -e "${YELLOW}⚠️  These tests include DESTRUCTIVE commands${NC}"
echo -e "${YELLOW}⚠️  Tests run in ISOLATED Docker container for safety${NC}"
echo ""

# Create test results directory
mkdir -p "$TEST_DIR/test-results"

# Run tests
docker-compose -f "$TEST_DIR/docker-compose.safety-test.yml" up --abort-on-container-exit

TEST_EXIT_CODE=$?

# Cleanup
echo ""
echo -e "${YELLOW}🧹 Cleaning up containers...${NC}"
docker-compose -f "$TEST_DIR/docker-compose.safety-test.yml" down -v

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          ✅ All Safety Tests Passed!                  ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Test results saved to: $TEST_DIR/test-results/${NC}"
else
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║          ❌ Safety Tests Failed                       ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Check test results in: $TEST_DIR/test-results/${NC}"
fi

exit $TEST_EXIT_CODE
