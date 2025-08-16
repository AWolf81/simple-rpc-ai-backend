/**
 * PostgreSQL Database Adapter
 * Simple adapter for database operations using PostgreSQL
 */
import winston from 'winston';
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;
}
export interface DatabaseRow {
    [key: string]: any;
}
export declare class PostgreSQLAdapter {
    private pool;
    private logger;
    constructor(config: DatabaseConfig | string, logger?: winston.Logger);
    /**
     * Execute a query that modifies data (INSERT, UPDATE, DELETE)
     */
    execute(query: string, params?: any[]): Promise<{
        changes: number;
        lastInsertRowid?: number;
    }>;
    /**
     * Get a single row
     */
    get(query: string, params?: any[]): Promise<DatabaseRow | undefined>;
    /**
     * Get all rows matching query
     */
    all(query: string, params?: any[]): Promise<DatabaseRow[]>;
    /**
     * Run a query (alias for execute for compatibility)
     */
    run(query: string, params?: any[]): Promise<{
        changes: number;
        lastInsertRowid?: number;
    }>;
    /**
     * Query method for virtual token service compatibility
     */
    query(query: string, params?: any[]): Promise<DatabaseRow[]>;
    /**
     * Get database connection for transactions
     */
    getConnection(): Promise<import("pg").PoolClient>;
    /**
     * Parse PostgreSQL connection string
     */
    private parseConnectionString;
    /**
     * Initialize database schema
     */
    initialize(): Promise<void>;
    /**
     * Close all connections
     */
    close(): Promise<void>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=postgres-adapter.d.ts.map