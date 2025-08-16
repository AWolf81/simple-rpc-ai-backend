#!/bin/bash

# PostgreSQL Secret Manager Setup Script

set -e

echo "🐘 Setting up PostgreSQL Secret Manager"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create .env.postgres if it doesn't exist
if [ ! -f ".env.postgres" ]; then
    echo "📝 Creating .env.postgres from template..."
    cp .env.postgres.example .env.postgres
    
    # Generate secure random values
    DB_PASS=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
    ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    # Update the .env file with generated values
    sed -i "s/your-secure-postgres-password-here/$DB_PASS/g" .env.postgres
    sed -i "s/your-32-character-encryption-key-here/$ENCRYPTION_KEY/g" .env.postgres
    
    echo "✅ Generated secure passwords and encryption key"
    echo "📝 Please review and customize .env.postgres if needed"
else
    echo "✅ Using existing .env.postgres configuration"
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data/postgres

# Stop any running containers
echo "🛑 Stopping any existing PostgreSQL containers..."
docker-compose --env-file .env.postgres -f docker-compose.postgres.yml down || true

# Start PostgreSQL
echo "🚀 Starting PostgreSQL..."
docker-compose --env-file .env.postgres -f docker-compose.postgres.yml up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose --env-file .env.postgres -f docker-compose.postgres.yml exec -T postgres-secrets pg_isready -U secret_manager -d secrets > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL did not start within 30 seconds"
        exit 1
    fi
    echo "⏳ Waiting for PostgreSQL... attempt $i/30"
    sleep 1
done

echo ""
echo "🎉 PostgreSQL Secret Manager setup completed!"
echo ""
echo "📊 Service Details:"
echo "  🐘 PostgreSQL: localhost:5432"
echo "  📂 Data: ./data/postgres"
echo ""
echo "📝 Next steps:"
echo "  1. Install dependencies: pnpm install"
echo "  2. Run tests: pnpm test:postgres"
echo ""
echo "📚 View logs with:"
echo "  docker-compose --env-file .env.postgres -f docker-compose.postgres.yml logs -f"
echo ""
echo "🛑 Stop services with:"
echo "  docker-compose --env-file .env.postgres -f docker-compose.postgres.yml down"