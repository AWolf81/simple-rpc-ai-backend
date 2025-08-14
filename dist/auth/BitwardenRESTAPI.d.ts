/**
 * Bitwarden REST API Wrapper
 *
 * Uses the Bitwarden CLI's built-in REST server (bw serve) for easier integration
 * This is more reliable than wrapping individual CLI commands
 */
import * as winston from 'winston';
export interface BitwardenConfig {
    serverUrl: string;
    clientId: string;
    clientSecret: string;
    masterPassword?: string;
    organizationId?: string;
    apiHost?: string;
    apiPort?: number;
}
export interface BitwardenItem {
    id: string;
    organizationId?: string;
    folderId?: string;
    type: number;
    name: string;
    notes?: string;
    favorite: boolean;
    login?: {
        username?: string;
        password?: string;
        totp?: string;
    };
    secureNote?: {
        type: number;
    };
    creationDate: string;
    revisionDate: string;
}
export interface BitwardenSecret {
    id: string;
    organizationId?: string;
    name: string;
    notes?: string;
    value?: string;
    creationDate: string;
    revisionDate: string;
}
export declare class BitwardenRESTAPI {
    private config;
    private logger;
    private apiClient;
    private serverProcess?;
    private sessionToken?;
    private isServerRunning;
    private apiBaseUrl;
    constructor(config: BitwardenConfig, logger?: winston.Logger);
    /**
     * Configure Bitwarden CLI for server
     */
    private configureCLI;
    /**
     * Authenticate with API key
     */
    private authenticateWithAPIKey;
    /**
     * Unlock vault if needed
     */
    private unlockVault;
    /**
     * Quick check if persistent service is available (for performance optimization)
     */
    private checkPersistentService;
    /**
     * Connect to persistent API server or start local server
     * 🚀 PERFORMANCE OPTIMIZATION: Connect to Docker service instead of spawning
     */
    private startAPIServer;
    /**
     * Test API server connectivity
     */
    private testAPIConnectivity;
    /**
     * Initialize: Configure, authenticate, start server
     */
    initialize(): Promise<void>;
    /**
     * List all items
     */
    listItems(): Promise<BitwardenSecret[]>;
    /**
     * Get item by ID
     */
    getItem(id: string): Promise<BitwardenSecret | null>;
    /**
     * Create a new secure note with API key
     */
    createSecret(name: string, value: string, notes?: string, organizationId?: string): Promise<string>;
    /**
     * Update an existing item
     */
    updateSecret(id: string, name: string, value: string, notes?: string): Promise<void>;
    /**
     * Delete an item
     */
    deleteSecret(id: string): Promise<void>;
    /**
     * Search for items by name
     */
    searchSecrets(searchTerm: string): Promise<BitwardenSecret[]>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
    /**
     * Cleanup: Stop server and clear resources
     */
    cleanup(): Promise<void>;
}
export default BitwardenRESTAPI;
//# sourceMappingURL=BitwardenRESTAPI.d.ts.map