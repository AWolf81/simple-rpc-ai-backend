#!/bin/bash

# Infisical Setup Script for Simple RPC AI Backend
# This script sets up Infisical for multi-tenant API key storage

set -e

echo "🔐 Setting up Infisical for Simple RPC AI Backend"
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create .env.infisical if it doesn't exist
if [ ! -f ".env.infisical" ]; then
    echo "📝 Creating .env.infisical from template..."
    cp .env.infisical.example .env.infisical
    
    # Generate secure random keys
    ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    AUTH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    DB_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)
    REDIS_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)
    ADMIN_PASS=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    # Update the .env file with generated values
    sed -i "s/your-32-character-encryption-key-here/$ENCRYPTION_KEY/g" .env.infisical
    sed -i "s/your-32-character-auth-secret-here/$AUTH_SECRET/g" .env.infisical
    sed -i "s/your-secure-database-password-here/$DB_PASS/g" .env.infisical
    sed -i "s/your-secure-redis-password-here/$REDIS_PASS/g" .env.infisical
    sed -i "s/your-admin-password-here/$ADMIN_PASS/g" .env.infisical
    
    echo "✅ Generated secure keys and passwords"
    echo "📝 Please review and customize .env.infisical if needed"
else
    echo "✅ Using existing .env.infisical configuration"
fi

# Stop any running Infisical containers
echo "🛑 Stopping any existing Infisical containers..."
docker-compose --env-file .env.infisical -f docker-compose.infisical.yml down --remove-orphans || true

# Pull latest images
echo "📦 Pulling latest Infisical images..."
docker-compose --env-file .env.infisical -f docker-compose.infisical.yml pull

# Start Infisical services
echo "🚀 Starting Infisical services..."
docker-compose --env-file .env.infisical -f docker-compose.infisical.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🏥 Checking service health..."
docker-compose --env-file .env.infisical -f docker-compose.infisical.yml ps

# Test connectivity
echo "🧪 Testing Infisical API connectivity..."
for i in {1..30}; do
    if curl -sf http://localhost:8080/api/status > /dev/null; then
        echo "✅ Infisical API is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Infisical API is not responding after 30 attempts"
        exit 1
    fi
    echo "⏳ Waiting for Infisical API... attempt $i/30"
    sleep 2
done

echo ""
echo "🎉 Infisical setup completed successfully!"
echo ""
echo "📊 Service URLs:"
echo "  🔐 Infisical API: http://localhost:8080"
echo "  🗄️  PostgreSQL:   localhost:5433"
echo "  🔴 Redis:         localhost:6380"
echo ""
echo "📝 Next steps:"
echo "  1. Access Infisical at http://localhost:8080"
echo "  2. Create your admin account"
echo "  3. Set up your first organization"
echo "  4. Configure API tokens for Simple RPC integration"
echo ""
echo "📚 View logs with:"
echo "  docker-compose -f docker-compose.infisical.yml logs -f"
echo ""
echo "🛑 Stop services with:"
echo "  docker-compose -f docker-compose.infisical.yml down"