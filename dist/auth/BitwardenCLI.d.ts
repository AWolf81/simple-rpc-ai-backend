/**
 * Bitwarden CLI Wrapper
 *
 * Provides a clean interface to the Bitwarden CLI for authentication and secret management
 * This is more reliable than the NAPI package and handles all authentication complexity
 */
import * as winston from 'winston';
export interface BitwardenConfig {
    serverUrl: string;
    clientId: string;
    clientSecret: string;
    masterPassword?: string;
    serviceEmail?: string;
    servicePassword?: string;
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
export declare class BitwardenCLI {
    private config;
    private logger;
    private sessionToken?;
    private isLoggedIn;
    constructor(config: BitwardenConfig, logger?: winston.Logger);
    /**
     * Execute Bitwarden CLI command
     */
    private execBW;
    /**
     * Configure the CLI to use Vaultwarden server
     */
    configure(): Promise<void>;
    /**
     * Login using API key and get session token
     */
    login(): Promise<void>;
    /**
     * Unlock vault (if needed)
     */
    unlock(): Promise<void>;
    /**
     * Get CLI status
     */
    getStatus(): Promise<any>;
    /**
     * List all items (secrets)
     */
    listItems(): Promise<BitwardenSecret[]>;
    /**
     * Get specific item by ID
     */
    getItem(id: string): Promise<BitwardenSecret | null>;
    /**
     * Create a secure note with API key
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
     * Lock the vault (keeps login session but requires unlock to access data)
     */
    lock(): Promise<void>;
    /**
     * Logout and clear session
     */
    logout(): Promise<void>;
    /**
     * Initialize: configure, login, and unlock
     */
    initialize(): Promise<void>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default BitwardenCLI;
//# sourceMappingURL=BitwardenCLI.d.ts.map