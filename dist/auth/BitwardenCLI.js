/**
 * Bitwarden CLI Wrapper
 *
 * Provides a clean interface to the Bitwarden CLI for authentication and secret management
 * This is more reliable than the NAPI package and handles all authentication complexity
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import * as winston from 'winston';
const execAsync = promisify(exec);
export class BitwardenCLI {
    config;
    logger;
    sessionToken;
    isLoggedIn = false;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Execute Bitwarden CLI command
     */
    async execBW(command, includeSession = true, env) {
        const sessionPart = includeSession && this.sessionToken ? `--session ${this.sessionToken}` : '';
        const fullCommand = `npx bw ${command} ${sessionPart}`.trim();
        // Merge custom environment variables with process.env
        const execEnv = env ? { ...process.env, ...env } : process.env;
        this.logger.debug(`Executing: ${fullCommand.replace(this.sessionToken || '', '[SESSION]')}`);
        try {
            const { stdout, stderr } = await execAsync(fullCommand, { env: execEnv });
            if (stderr && !stderr.includes('Could not find')) {
                this.logger.warn(`BW stderr: ${stderr}`);
            }
            return stdout.trim();
        }
        catch (error) {
            this.logger.error(`BW command failed: ${error.message}`);
            throw new Error(`Bitwarden CLI error: ${error.message}`);
        }
    }
    /**
     * Configure the CLI to use Vaultwarden server
     */
    async configure() {
        this.logger.info(`Configuring Bitwarden CLI for server: ${this.config.serverUrl}`);
        try {
            // Always logout first to avoid server config conflicts
            try {
                await this.logout();
                this.logger.info('Logged out to prepare for server configuration');
            }
            catch (e) {
                // Logout failure is not critical for initial setup
                this.logger.debug('Logout failed during configure (this is normal for first setup)');
            }
            await this.execBW(`config server ${this.config.serverUrl}`, false);
            this.logger.info('CLI configured successfully');
        }
        catch (error) {
            throw new Error(`Failed to configure CLI: ${error.message}`);
        }
    }
    /**
     * Login using API key and get session token
     */
    async login() {
        this.logger.info('Logging in with API key...');
        try {
            // First check if already logged in
            try {
                const status = await this.execBW('status', false);
                const statusData = JSON.parse(status);
                if (statusData.status === 'locked' || statusData.status === 'unlocked') {
                    this.isLoggedIn = true;
                    this.logger.info(`Already logged in (status: ${statusData.status})`);
                    // If unlocked, we can get the session token from login
                    if (statusData.status === 'unlocked') {
                        return;
                    }
                    // If locked, we need to unlock
                    return;
                }
            }
            catch (e) {
                // Status check failed, continue with login
            }
            // Login with API key method using environment variables
            const loginEnv = {
                BW_CLIENTID: this.config.clientId,
                BW_CLIENTSECRET: this.config.clientSecret
            };
            const sessionToken = await this.execBW('login --apikey --raw', false, loginEnv);
            this.sessionToken = sessionToken;
            this.isLoggedIn = true;
            this.logger.info('API key login successful');
            this.logger.debug(`Session token: ${this.sessionToken?.substring(0, 10)}...`);
        }
        catch (error) {
            throw new Error(`API key login failed: ${error.message}`);
        }
    }
    /**
     * Unlock vault (if needed)
     */
    async unlock() {
        if (!this.isLoggedIn) {
            throw new Error('Must login first');
        }
        try {
            const status = await this.getStatus();
            if (status.status === 'unlocked') {
                this.logger.info('Vault already unlocked');
                return;
            }
            if (status.status !== 'locked') {
                this.logger.warn(`Unexpected vault status: ${status.status}`);
            }
            this.logger.info('Unlocking vault...');
            // For API key authentication, we might not need a master password
            // or the unlock might be automatic after login
            if (this.config.masterPassword) {
                const unlockEnv = {
                    BW_PASSWORD: this.config.masterPassword
                };
                const sessionToken = await this.execBW('unlock --raw', true, unlockEnv);
                this.sessionToken = sessionToken;
            }
            else {
                // Try unlock without password first (API key might not require it)
                try {
                    const sessionToken = await this.execBW('unlock --raw', true, { BW_PASSWORD: '' });
                    this.sessionToken = sessionToken;
                }
                catch (e) {
                    this.logger.info('Vault unlock not needed or already unlocked for API key auth');
                }
            }
            this.logger.info('Vault access ready');
        }
        catch (error) {
            throw new Error(`Unlock failed: ${error.message}`);
        }
    }
    /**
     * Get CLI status
     */
    async getStatus() {
        const statusOutput = await this.execBW('status', false);
        return JSON.parse(statusOutput);
    }
    /**
     * List all items (secrets)
     */
    async listItems() {
        if (!this.sessionToken) {
            throw new Error('Must be logged in and unlocked');
        }
        const output = await this.execBW('list items');
        const items = JSON.parse(output);
        return items.map((item) => ({
            id: item.id,
            organizationId: item.organizationId,
            name: item.name,
            notes: item.notes,
            value: item.login?.password || item.secureNote?.notes || item.notes,
            creationDate: item.creationDate,
            revisionDate: item.revisionDate
        }));
    }
    /**
     * Get specific item by ID
     */
    async getItem(id) {
        if (!this.sessionToken) {
            throw new Error('Must be logged in and unlocked');
        }
        try {
            const output = await this.execBW(`get item ${id}`);
            const item = JSON.parse(output);
            return {
                id: item.id,
                organizationId: item.organizationId,
                name: item.name,
                notes: item.notes,
                value: item.login?.password || item.secureNote?.notes || item.notes,
                creationDate: item.creationDate,
                revisionDate: item.revisionDate
            };
        }
        catch (error) {
            this.logger.warn(`Item not found: ${id}`);
            return null;
        }
    }
    /**
     * Create a secure note with API key
     */
    async createSecret(name, value, notes, organizationId) {
        if (!this.sessionToken) {
            throw new Error('Must be logged in and unlocked');
        }
        const item = {
            type: 2, // Secure Note
            name,
            notes: notes || `API key: ${name}`,
            secureNote: {
                type: 0,
                notes: value
            },
            organizationId: organizationId || null
        };
        const tempFile = `/tmp/bw-item-${Date.now()}.json`;
        require('fs').writeFileSync(tempFile, JSON.stringify(item));
        try {
            const output = await this.execBW(`create item ${tempFile}`);
            const createdItem = JSON.parse(output);
            // Clean up temp file
            require('fs').unlinkSync(tempFile);
            this.logger.info(`Created secret: ${name} (${createdItem.id})`);
            return createdItem.id;
        }
        catch (error) {
            // Clean up temp file on error
            try {
                require('fs').unlinkSync(tempFile);
            }
            catch (e) { }
            throw error;
        }
    }
    /**
     * Update an existing item
     */
    async updateSecret(id, name, value, notes) {
        if (!this.sessionToken) {
            throw new Error('Must be logged in and unlocked');
        }
        // First get the existing item
        const existingItem = await this.getItem(id);
        if (!existingItem) {
            throw new Error(`Item not found: ${id}`);
        }
        const updatedItem = {
            id,
            type: 2, // Secure Note
            name,
            notes: notes || `API key: ${name}`,
            secureNote: {
                type: 0,
                notes: value
            },
            organizationId: existingItem.organizationId
        };
        const tempFile = `/tmp/bw-item-${Date.now()}.json`;
        require('fs').writeFileSync(tempFile, JSON.stringify(updatedItem));
        try {
            await this.execBW(`edit item ${id} ${tempFile}`);
            // Clean up temp file
            require('fs').unlinkSync(tempFile);
            this.logger.info(`Updated secret: ${name} (${id})`);
        }
        catch (error) {
            // Clean up temp file on error
            try {
                require('fs').unlinkSync(tempFile);
            }
            catch (e) { }
            throw error;
        }
    }
    /**
     * Delete an item
     */
    async deleteSecret(id) {
        if (!this.sessionToken) {
            throw new Error('Must be logged in and unlocked');
        }
        await this.execBW(`delete item ${id}`);
        this.logger.info(`Deleted secret: ${id}`);
    }
    /**
     * Search for items by name
     */
    async searchSecrets(searchTerm) {
        const allItems = await this.listItems();
        return allItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    /**
     * Lock the vault (keeps login session but requires unlock to access data)
     */
    async lock() {
        try {
            await this.execBW('lock', false);
            this.sessionToken = undefined; // Clear session token after lock
            this.logger.info('Vault locked successfully');
        }
        catch (error) {
            this.logger.warn(`Lock warning: ${error.message}`);
        }
    }
    /**
     * Logout and clear session
     */
    async logout() {
        try {
            await this.execBW('logout', false);
            this.sessionToken = undefined;
            this.isLoggedIn = false;
            this.logger.info('Logged out successfully');
        }
        catch (error) {
            this.logger.warn(`Logout warning: ${error.message}`);
        }
    }
    /**
     * Initialize: configure, login, and unlock
     */
    async initialize() {
        await this.configure();
        await this.login();
        await this.unlock();
        this.logger.info('Bitwarden CLI initialized successfully');
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const status = await this.getStatus();
            return {
                status: status.status === 'unlocked' ? 'healthy' : 'unhealthy',
                details: {
                    status: status.status,
                    userEmail: status.userEmail,
                    serverUrl: status.serverUrl,
                    lastSync: status.lastSync
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: { error: error.message }
            };
        }
    }
}
export default BitwardenCLI;
//# sourceMappingURL=BitwardenCLI.js.map