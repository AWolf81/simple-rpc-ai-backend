/**
 * SQLite Database Adapter for BYOK system
 *
 * Implements the database interfaces for users, devices, and keys
 * Using SQLite for development and testing - can be swapped for PostgreSQL/MySQL in production
 */
import { DatabaseAdapter, User, UserDevice } from '../auth/user-manager.js';
import { KeyStorageAdapter, UserKey } from '../auth/key-manager.js';
export declare class SQLiteAdapter implements DatabaseAdapter, KeyStorageAdapter {
    private db;
    constructor(databasePath?: string);
    /**
     * Initialize database schema
     */
    initialize(): Promise<void>;
    private createTables;
    private createIndexes;
    createUser(userData: Partial<User>): Promise<User>;
    findUserById(userId: string): Promise<User | null>;
    findUserByOAuth(provider: string, oauthId: string): Promise<User | null>;
    updateUser(userId: string, updates: Partial<User>): Promise<User>;
    createDevice(deviceData: Partial<UserDevice>): Promise<UserDevice>;
    findDeviceById(deviceId: string): Promise<UserDevice | null>;
    findUserDevices(userId: string): Promise<UserDevice[]>;
    updateDevice(deviceId: string, updates: Partial<UserDevice>): Promise<UserDevice>;
    storeKey(keyData: UserKey): Promise<void>;
    getKey(userId: string, provider: string): Promise<UserKey | null>;
    getUserKeys(userId: string): Promise<UserKey[]>;
    updateKey(userId: string, provider: string, updates: Partial<UserKey>): Promise<UserKey>;
    deleteKey(userId: string, provider: string): Promise<void>;
    private mapRowToUser;
    private mapRowToDevice;
    private mapRowToKey;
    /**
     * Execute a SQL statement (for CREATE, INSERT, UPDATE, DELETE)
     */
    execute(sql: string, params?: any[]): Promise<{
        changes: number;
        lastInsertRowid: number;
    }>;
    /**
     * Get a single row from a SQL query
     */
    get(sql: string, params?: any[]): Promise<any>;
    /**
     * Get all rows from a SQL query
     */
    all(sql: string, params?: any[]): Promise<any[]>;
    /**
     * Close database connection
     */
    close(): Promise<void>;
}
//# sourceMappingURL=sqlite-adapter.d.ts.map