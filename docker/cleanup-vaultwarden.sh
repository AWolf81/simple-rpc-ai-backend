#!/bin/bash

# Cleanup Vaultwarden Data and Docker Resources
# Run this script to completely remove all Vaultwarden data

set -e

echo "🧹 Cleaning up Vaultwarden data and Docker resources"
echo "==================================================="

# Stop and remove Vaultwarden containers and volumes
echo "🛑 Stopping Vaultwarden containers..."
docker-compose --env-file .env.vaultwarden -f docker-compose.vaultwarden.yml down -v --remove-orphans || true

# Remove Docker volumes
echo "🗑️ Removing Docker volumes..."
docker volume rm postgres_vw_data 2>/dev/null || true
docker volume rm redis_vw_data 2>/dev/null || true
docker volume rm vaultwarden_data 2>/dev/null || true

# Remove data directory (may need sudo)
echo "📂 Removing data directory..."
if [ -d "./data" ]; then
    if rm -rf ./data 2>/dev/null; then
        echo "✅ Data directory removed successfully"
    else
        echo "⚠️  Data directory has Docker ownership. Please run:"
        echo "    sudo rm -rf ./data"
        echo "    Or run: docker run --rm -v \$(pwd):/workspace alpine rm -rf /workspace/data"
    fi
else
    echo "✅ Data directory already removed"
fi

# Create new data directory for Infisical
echo "📁 Creating new data directory structure for Infisical..."
mkdir -p data/infisical/postgres
mkdir -p data/infisical/redis
mkdir -p data/infisical/app

echo "✅ Vaultwarden cleanup completed!"
echo ""
echo "📝 Next steps:"
echo "  1. The old Vaultwarden data has been removed"
echo "  2. New ./data directory structure created for Infisical"
echo "  3. You can now start Infisical with: pnpm infisical:start"