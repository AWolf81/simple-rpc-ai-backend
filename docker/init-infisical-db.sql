-- Infisical Database Initialization Script
-- Creates the database and user for Infisical

-- The database is already created by POSTGRES_DB environment variable
-- This script can be used for additional setup if needed

-- Create extensions that might be useful for Infisical
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant permissions (user is already created by POSTGRES_USER)
GRANT ALL PRIVILEGES ON DATABASE infisical TO infisical_user;

-- Log successful initialization
\echo 'Infisical database initialization completed successfully'