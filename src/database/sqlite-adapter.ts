/**
 * SQLite Database Adapter for BYOK system
 * 
 * Implements the database interfaces for users, devices, and keys
 * Using SQLite for development and testing - can be swapped for PostgreSQL/MySQL in production
 */

import Database from 'better-sqlite3';
import { DatabaseAdapter, User, UserDevice } from '../auth/user-manager.js';
import { KeyStorageAdapter, UserKey } from '../auth/key-manager.js';

export class SQLiteAdapter implements DatabaseAdapter, KeyStorageAdapter {
  private db: Database.Database;

  constructor(databasePath: string = ':memory:') {
    this.db = new Database(databasePath);
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    this.createTables();
    this.createIndexes();
  }

  private createTables(): void {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        is_anonymous BOOLEAN DEFAULT 1,
        oauth_provider TEXT,
        oauth_id TEXT,
        email TEXT,
        plan TEXT DEFAULT 'free',
        features TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User devices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_devices (
        device_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_name TEXT,
        device_fingerprint TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // User API keys table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_keys (
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        encrypted_api_key TEXT NOT NULL,
        nonce TEXT NOT NULL,
        is_valid BOOLEAN DEFAULT 0,
        last_validated DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, provider),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // Passkey credentials table (for future use)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS passkey_credentials (
        credential_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        device_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
  }

  private createIndexes(): void {
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_devices_user ON user_devices(user_id, is_active)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_keys_user ON user_keys(user_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id)');
  }

  // User operations
  async createUser(userData: Partial<User>): Promise<User> {
    const user: User = {
      userId: userData.userId!,
      isAnonymous: userData.isAnonymous ?? true,
      oauthProvider: userData.oauthProvider,
      oauthId: userData.oauthId,
      email: userData.email,
      plan: userData.plan ?? 'free',
      features: userData.features ?? [],
      createdAt: userData.createdAt ?? new Date(),
      updatedAt: userData.updatedAt ?? new Date()
    };

    const stmt = this.db.prepare(`
      INSERT INTO users (
        user_id, is_anonymous, oauth_provider, oauth_id, email, plan, features, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.userId,
      user.isAnonymous ? 1 : 0,
      user.oauthProvider,
      user.oauthId,
      user.email,
      user.plan,
      JSON.stringify(user.features),
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );

    return user;
  }

  async findUserById(userId: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE user_id = ?');
    const row = stmt.get(userId);
    return row ? this.mapRowToUser(row) : null;
  }

  async findUserByOAuth(provider: string, oauthId: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?');
    const row = stmt.get(provider, oauthId);
    return row ? this.mapRowToUser(row) : null;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.isAnonymous !== undefined) {
      setParts.push('is_anonymous = ?');
      values.push(updates.isAnonymous ? 1 : 0);
    }
    if (updates.oauthProvider !== undefined) {
      setParts.push('oauth_provider = ?');
      values.push(updates.oauthProvider);
    }
    if (updates.oauthId !== undefined) {
      setParts.push('oauth_id = ?');
      values.push(updates.oauthId);
    }
    if (updates.email !== undefined) {
      setParts.push('email = ?');
      values.push(updates.email);
    }
    if (updates.plan !== undefined) {
      setParts.push('plan = ?');
      values.push(updates.plan);
    }
    if (updates.features !== undefined) {
      setParts.push('features = ?');
      values.push(JSON.stringify(updates.features));
    }

    setParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);

    const stmt = this.db.prepare(`UPDATE users SET ${setParts.join(', ')} WHERE user_id = ?`);
    stmt.run(...values);

    const updatedUser = await this.findUserById(userId);
    if (!updatedUser) {
      throw new Error('User not found after update');
    }

    return updatedUser;
  }

  // Device operations
  async createDevice(deviceData: Partial<UserDevice>): Promise<UserDevice> {
    const device: UserDevice = {
      deviceId: deviceData.deviceId!,
      userId: deviceData.userId!,
      deviceName: deviceData.deviceName ?? 'Unknown Device',
      deviceFingerprint: deviceData.deviceFingerprint ?? deviceData.deviceId!,
      isActive: deviceData.isActive ?? true,
      lastSeen: deviceData.lastSeen ?? new Date(),
      createdAt: deviceData.createdAt ?? new Date()
    };

    const stmt = this.db.prepare(`
      INSERT INTO user_devices (
        device_id, user_id, device_name, device_fingerprint, is_active, last_seen, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      device.deviceId,
      device.userId,
      device.deviceName,
      device.deviceFingerprint,
      device.isActive ? 1 : 0,
      device.lastSeen.toISOString(),
      device.createdAt.toISOString()
    );

    return device;
  }

  async findDeviceById(deviceId: string): Promise<UserDevice | null> {
    const stmt = this.db.prepare('SELECT * FROM user_devices WHERE device_id = ?');
    const row = stmt.get(deviceId);
    return row ? this.mapRowToDevice(row) : null;
  }

  async findUserDevices(userId: string): Promise<UserDevice[]> {
    const stmt = this.db.prepare('SELECT * FROM user_devices WHERE user_id = ? ORDER BY last_seen DESC');
    const rows = stmt.all(userId);
    return rows.map(row => this.mapRowToDevice(row));
  }

  async updateDevice(deviceId: string, updates: Partial<UserDevice>): Promise<UserDevice> {
    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.deviceName !== undefined) {
      setParts.push('device_name = ?');
      values.push(updates.deviceName);
    }
    if (updates.isActive !== undefined) {
      setParts.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.lastSeen !== undefined) {
      setParts.push('last_seen = ?');
      values.push(updates.lastSeen.toISOString());
    }

    values.push(deviceId);

    const stmt = this.db.prepare(`UPDATE user_devices SET ${setParts.join(', ')} WHERE device_id = ?`);
    stmt.run(...values);

    const updatedDevice = await this.findDeviceById(deviceId);
    if (!updatedDevice) {
      throw new Error('Device not found after update');
    }

    return updatedDevice;
  }

  // Key storage operations
  async storeKey(keyData: UserKey): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_keys (
        user_id, provider, encrypted_api_key, nonce, is_valid, last_validated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      keyData.userId,
      keyData.provider,
      keyData.encryptedApiKey,
      keyData.nonce,
      keyData.isValid ? 1 : 0,
      keyData.lastValidated?.toISOString(),
      keyData.createdAt.toISOString(),
      keyData.updatedAt.toISOString()
    );
  }

  async getKey(userId: string, provider: string): Promise<UserKey | null> {
    const stmt = this.db.prepare('SELECT * FROM user_keys WHERE user_id = ? AND provider = ?');
    const row = stmt.get(userId, provider);
    return row ? this.mapRowToKey(row) : null;
  }

  async getUserKeys(userId: string): Promise<UserKey[]> {
    const stmt = this.db.prepare('SELECT * FROM user_keys WHERE user_id = ? ORDER BY updated_at DESC');
    const rows = stmt.all(userId);
    return rows.map(row => this.mapRowToKey(row));
  }

  async updateKey(userId: string, provider: string, updates: Partial<UserKey>): Promise<UserKey> {
    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.encryptedApiKey !== undefined) {
      setParts.push('encrypted_api_key = ?');
      values.push(updates.encryptedApiKey);
    }
    if (updates.nonce !== undefined) {
      setParts.push('nonce = ?');
      values.push(updates.nonce);
    }
    if (updates.isValid !== undefined) {
      setParts.push('is_valid = ?');
      values.push(updates.isValid ? 1 : 0);
    }
    if (updates.lastValidated !== undefined) {
      setParts.push('last_validated = ?');
      values.push(updates.lastValidated.toISOString());
    }

    setParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId, provider);

    const stmt = this.db.prepare(`UPDATE user_keys SET ${setParts.join(', ')} WHERE user_id = ? AND provider = ?`);
    stmt.run(...values);

    const updatedKey = await this.getKey(userId, provider);
    if (!updatedKey) {
      throw new Error('Key not found after update');
    }

    return updatedKey;
  }

  async deleteKey(userId: string, provider: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM user_keys WHERE user_id = ? AND provider = ?');
    stmt.run(userId, provider);
  }

  // Helper methods for mapping database rows to objects
  private mapRowToUser(row: any): User {
    return {
      userId: row.user_id,
      isAnonymous: Boolean(row.is_anonymous),
      oauthProvider: row.oauth_provider,
      oauthId: row.oauth_id,
      email: row.email,
      plan: row.plan,
      features: JSON.parse(row.features || '[]'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToDevice(row: any): UserDevice {
    return {
      deviceId: row.device_id,
      userId: row.user_id,
      deviceName: row.device_name,
      deviceFingerprint: row.device_fingerprint,
      isActive: Boolean(row.is_active),
      lastSeen: new Date(row.last_seen),
      createdAt: new Date(row.created_at)
    };
  }

  private mapRowToKey(row: any): UserKey {
    return {
      userId: row.user_id,
      provider: row.provider,
      encryptedApiKey: row.encrypted_api_key,
      nonce: row.nonce,
      isValid: Boolean(row.is_valid),
      lastValidated: row.last_validated ? new Date(row.last_validated) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Execute a SQL statement (for CREATE, INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid as number
    };
  }

  /**
   * Get a single row from a SQL query
   */
  async get(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  /**
   * Get all rows from a SQL query
   */
  async all(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    this.db.close();
  }
}