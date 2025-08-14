#!/bin/bash

# Validate Infisical Environment Variables

echo "🔍 Validating Infisical environment variables..."
echo "================================================"

if [ ! -f ".env.infisical" ]; then
    echo "❌ .env.infisical file not found"
    exit 1
fi

# Check if all required variables are set
REQUIRED_VARS=(
    "INFISICAL_DB_PASS"
    "INFISICAL_REDIS_PASS" 
    "INFISICAL_ENCRYPTION_KEY"
    "INFISICAL_AUTH_SECRET"
)

# Source the environment file safely
set -a
source .env.infisical
set +a

echo "📋 Checking required environment variables:"

all_set=true
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ $var: NOT SET"
        all_set=false
    else
        # Show first 10 characters only for security
        value="${!var}"
        preview="${value:0:10}..."
        echo "✅ $var: $preview"
    fi
done

if [ "$all_set" = true ]; then
    echo ""
    echo "✅ All required environment variables are properly set"
    echo "🐳 Ready to start Infisical services"
    exit 0
else
    echo ""
    echo "❌ Some required environment variables are missing"
    echo "💡 Run: pnpm infisical:setup to regenerate .env.infisical"
    exit 1
fi