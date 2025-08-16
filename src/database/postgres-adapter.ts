/**
 * PostgreSQL Database Adapter
 * Simple adapter for database operations using PostgreSQL
 */

import { Client, Pool } from 'pg';
import winston from 'winston';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // max connections in pool
}

export interface DatabaseRow {
  [key: string]: any;
}

export class PostgreSQLAdapter {
  private pool: Pool;
  private logger: winston.Logger;

  constructor(config: DatabaseConfig | string, logger?: winston.Logger) {
    // Support both connection string and config object
    if (typeof config === 'string') {
      config = this.parseConnectionString(config);
    }
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
  async execute(query: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0]?.id // PostgreSQL doesn't have lastInsertRowid like SQLite
      };
    } catch (error) {
      this.logger.error('Database execute error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a single row
   */
  async get(query: string, params?: any[]): Promise<DatabaseRow | undefined> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Database get error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all rows matching query
   */
  async all(query: string, params?: any[]): Promise<DatabaseRow[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Database all error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run a query (alias for execute for compatibility)
   */
  async run(query: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    return this.execute(query, params);
  }

  /**
   * Query method for virtual token service compatibility
   */
  async query(query: string, params?: any[]): Promise<DatabaseRow[]> {
    return this.all(query, params);
  }

  /**
   * Get database connection for transactions
   */
  async getConnection() {
    return this.pool.connect();
  }

  /**
   * Parse PostgreSQL connection string
   */
  private parseConnectionString(connectionString: string): DatabaseConfig {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1), // Remove leading '/'
      user: url.username,
      password: url.password,
      ssl: url.searchParams.get('sslmode') === 'require'
    };
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
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
    } catch (error) {
      this.logger.error('Database initialization error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return { healthy: true, message: 'PostgreSQL connection successful' };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { 
        healthy: false, 
        message: `PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

// PostgreSQL adapter - no aliases to avoid confusion