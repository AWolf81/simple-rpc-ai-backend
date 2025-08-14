export const __esModule: boolean;
export class SQLiteAdapter {
    constructor(databasePath?: string);
    db: any;
    /**
     * Initialize database schema
     */
    initialize(): Promise<void>;
    createTables(): void;
    createIndexes(): void;
    createUser(userData: any): Promise<{
        userId: any;
        isAnonymous: any;
        oauthProvider: any;
        oauthId: any;
        email: any;
        plan: any;
        features: any;
        createdAt: any;
        updatedAt: any;
    }>;
    findUserById(userId: any): Promise<{
        userId: any;
        isAnonymous: boolean;
        oauthProvider: any;
        oauthId: any;
        email: any;
        plan: any;
        features: any;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    findUserByOAuth(provider: any, oauthId: any): Promise<{
        userId: any;
        isAnonymous: boolean;
        oauthProvider: any;
        oauthId: any;
        email: any;
        plan: any;
        features: any;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    updateUser(userId: any, updates: any): Promise<{
        userId: any;
        isAnonymous: boolean;
        oauthProvider: any;
        oauthId: any;
        email: any;
        plan: any;
        features: any;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createDevice(deviceData: any): Promise<{
        deviceId: any;
        userId: any;
        deviceName: any;
        deviceFingerprint: any;
        isActive: any;
        lastSeen: any;
        createdAt: any;
    }>;
    findDeviceById(deviceId: any): Promise<{
        deviceId: any;
        userId: any;
        deviceName: any;
        deviceFingerprint: any;
        isActive: boolean;
        lastSeen: Date;
        createdAt: Date;
    } | null>;
    findUserDevices(userId: any): Promise<any>;
    updateDevice(deviceId: any, updates: any): Promise<{
        deviceId: any;
        userId: any;
        deviceName: any;
        deviceFingerprint: any;
        isActive: boolean;
        lastSeen: Date;
        createdAt: Date;
    }>;
    storeKey(keyData: any): Promise<void>;
    getKey(userId: any, provider: any): Promise<{
        userId: any;
        provider: any;
        encryptedApiKey: any;
        nonce: any;
        isValid: boolean;
        lastValidated: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    getUserKeys(userId: any): Promise<any>;
    updateKey(userId: any, provider: any, updates: any): Promise<{
        userId: any;
        provider: any;
        encryptedApiKey: any;
        nonce: any;
        isValid: boolean;
        lastValidated: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteKey(userId: any, provider: any): Promise<void>;
    mapRowToUser(row: any): {
        userId: any;
        isAnonymous: boolean;
        oauthProvider: any;
        oauthId: any;
        email: any;
        plan: any;
        features: any;
        createdAt: Date;
        updatedAt: Date;
    };
    mapRowToDevice(row: any): {
        deviceId: any;
        userId: any;
        deviceName: any;
        deviceFingerprint: any;
        isActive: boolean;
        lastSeen: Date;
        createdAt: Date;
    };
    mapRowToKey(row: any): {
        userId: any;
        provider: any;
        encryptedApiKey: any;
        nonce: any;
        isValid: boolean;
        lastValidated: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    };
    /**
     * Close database connection
     */
    close(): Promise<void>;
}
//# sourceMappingURL=sqlite-adapter.d.ts.map