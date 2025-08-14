/**
 * PostgreSQL Database Adapter
 * Simple adapter for database operations using PostgreSQL
 */
import { Pool } from 'pg';
import winston from 'winston';
export class PostgreSQLAdapter {
    pool;
    logger;
    constructor(config, logger) {
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            transports: [new winston.transports.Console()]
        });
        this.pool = new Pool({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl,
            max: config.max || 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }
    /**
     * Execute a query that modifies data (INSERT, UPDATE, DELETE)
     */
    async execute(query, params) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(query, params);
            return {
                changes: result.rowCount || 0,
                lastInsertRowid: result.rows[0]?.id // PostgreSQL doesn't have lastInsertRowid like SQLite
            };
        }
        catch (error) {
            this.logger.error('Database execute error:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get a single row
     */
    async get(query, params) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows[0];
        }
        catch (error) {
            this.logger.error('Database get error:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get all rows matching query
     */
    async all(query, params) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows;
        }
        catch (error) {
            this.logger.error('Database all error:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Run a query (alias for execute for compatibility)
     */
    async run(query, params) {
        return this.execute(query, params);
    }
    /**
     * Initialize database schema
     */
    async initialize() {
        const client = await this.pool.connect();
        try {
            // Create usage_events table for billing
            await client.query(`
        CREATE TABLE IF NOT EXISTS usage_events (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          organization_id VARCHAR(255),
          event_type VARCHAR(50) NOT NULL,
          provider VARCHAR(50),
          model VARCHAR(100),
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          cost_usd DECIMAL(10,6) DEFAULT 0,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
            // Create billing_events table
            await client.query(`
        CREATE TABLE IF NOT EXISTS billing_events (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          organization_id VARCHAR(255),
          event_type VARCHAR(50) NOT NULL,
          amount DECIMAL(10,6) NOT NULL,
          currency VARCHAR(3) DEFAULT 'usd',
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
            // Create user_quotas table
            await client.query(`
        CREATE TABLE IF NOT EXISTS user_quotas (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL UNIQUE,
          organization_id VARCHAR(255),
          monthly_limit_usd DECIMAL(10,6) DEFAULT 10.00,
          current_usage_usd DECIMAL(10,6) DEFAULT 0,
          reset_date DATE DEFAULT CURRENT_DATE + INTERVAL '1 month',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
            // Create indexes
            await client.query('CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON billing_events(user_id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id)');
            this.logger.info('Database schema initialized successfully');
        }
        catch (error) {
            this.logger.error('Database initialization error:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Close all connections
     */
    async close() {
        await this.pool.end();
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            return { healthy: true, message: 'PostgreSQL connection successful' };
        }
        catch (error) {
            this.logger.error('Health check failed:', error);
            return {
                healthy: false,
                message: `PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
// PostgreSQL adapter - no aliases to avoid confusion
//# sourceMappingURL=postgres-adapter.js.map