/**
 * Bitwarden REST API Wrapper
 * 
 * Uses the Bitwarden CLI's built-in REST server (bw serve) for easier integration
 * This is more reliable than wrapping individual CLI commands
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { exec, spawn, ChildProcess } from 'child_process';
import { log, promisify } from 'util';
import * as winston from 'winston';  

const execAsync = promisify(exec);

export interface BitwardenConfig {
  serverUrl: string;
  clientId: string;
  clientSecret: string;
  masterPassword?: string;
  organizationId?: string;
  apiHost?: string;  // For bw serve
  apiPort?: number;  // For bw serve
}

export interface BitwardenItem {
  id: string;
  organizationId?: string;
  folderId?: string;
  type: number; // 1=Login, 2=SecureNote, 3=Card, 4=Identity
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

export class BitwardenRESTAPI {
  private config: BitwardenConfig;
  private logger: winston.Logger;
  private apiClient: AxiosInstance;
  private serverProcess?: ChildProcess;
  private sessionToken?: string;
  private isServerRunning: boolean = false;
  private apiBaseUrl: string;

  constructor(config: BitwardenConfig, logger?: winston.Logger) {
    this.config = {
      ...config,
      apiHost: config.apiHost || 'localhost',
      apiPort: config.apiPort || 8087
    };
    
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    this.apiBaseUrl = `http://${this.config.apiHost}:${this.config.apiPort}`;
    
    this.apiClient = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.apiClient.interceptors.request.use(
      (config) => {
        if (this.sessionToken) {
          config.headers.Authorization = `Bearer ${this.sessionToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Configure Bitwarden CLI for server
   */
  private async configureCLI(): Promise<void> {
    this.logger.info(`Checking Bitwarden CLI server configuration...`);

    try {
      const { stdout } = await execAsync('./node_modules/.bin/bw config server');
      const currentServer = stdout.trim();
      if (currentServer === this.config.serverUrl) {
        this.logger.info('CLI server already configured');
        return;
      }

      // Only logout if switching server
      try {
        await execAsync('./node_modules/.bin/bw logout');
        this.logger.debug('Logged out due to server switch');
      } catch {}

      await execAsync(`./node_modules/.bin/bw config server ${this.config.serverUrl}`);
      this.logger.info('CLI server configured successfully');

    } catch (error: any) {
      throw new Error(`Failed to configure CLI: ${error.message}`);
    }
  }

  /**
   * Authenticate with API key
   */
  private async authenticateWithAPIKey(): Promise<void> {
    this.logger.info('Authenticating with API key...');
    
    try {
      const loginEnv = {
        ...process.env,
        BW_CLIENTID: this.config.clientId,
        BW_CLIENTSECRET: this.config.clientSecret
      };
      
      const { stdout } = await execAsync('./node_modules/.bin/bw login --apikey --raw', { 
        env: loginEnv,
        timeout: 15000 // 15 second timeout
      });
      this.sessionToken = stdout.trim();
      // do we need to check if ther is `You are already logged in as service@simple-rpc-ai.local.` in stdout
      // --> not needed as we would get an error and out would fail
      this.logger.info('API key authentication successful');
      this.logger.debug(`Session token: ${this.sessionToken?.substring(0, 10)}...`);      
    } catch (error: any) {
      const alreadyLoggedIn = error.stderr?.includes('You are already logged in') 
                          || error.stdout?.includes('You are already logged in')
                          || error.message?.includes('You are already logged in');

      if (alreadyLoggedIn) {
        this.logger.info('Already logged in — skipping API key login.');
        return;
      }

      throw new Error(`API key authentication failed: ${error.message}`);
    }
  }

  /**
   * Unlock vault if needed
   */
  private async unlockVault(): Promise<void> {
    this.logger.info('Checking vault unlock status...');

    try {
      const { stdout: statusOutput } = await execAsync('./node_modules/.bin/bw status');
      const status = JSON.parse(statusOutput);

      if (status.status === 'unlocked') {
        this.logger.info('Vault already unlocked');
        return;
      }

      if (!this.config.masterPassword) {
        throw new Error('Master password required to unlock vault');
      }

      this.logger.info('Unlocking vault...');

      const env = {
        ...process.env,
        BW_PASSWORD: this.config.masterPassword,
        BW_SESSION: this.sessionToken
      };

      const { stdout: sessionToken, stderr } = await execAsync(
        './node_modules/.bin/bw unlock --raw --passwordenv BW_PASSWORD',
        { env }
      );

      if (!sessionToken.trim()) {
        throw new Error(`Failed to unlock vault: ${stderr || 'No session token returned'}`);
      }

      this.sessionToken = sessionToken.trim();
      process.env.BW_SESSION = this.sessionToken;
      this.logger.info('Vault unlocked successfully');
    } catch (error: any) {
      this.logger.error('Failed to unlock vault:', error.message);
      throw error;
    }
  }



  /**
   * Quick check if persistent service is available (for performance optimization)
   */
  private async checkPersistentService(): Promise<boolean> {
    try {
      this.logger.info(`🔍 Testing persistent service at ${this.apiBaseUrl}/status`);
      const response = await fetch(`${this.apiBaseUrl}/status`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2000) // 2 second timeout for quick check
      });
      
      this.logger.info(`📡 Response: status=${response.status}, ok=${response.ok}`);
      if (response.ok) {
        const data = await response.json();
        this.logger.info(`✅ Persistent service available: ${JSON.stringify(data.success)}`);
        return true;
      }
      this.logger.info(`❌ Persistent service not available: ${response.status}`);
      return false;
    } catch (error: any) {
      this.logger.info(`❌ Persistent service check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Connect to persistent API server or start local server
   * 🚀 PERFORMANCE OPTIMIZATION: Connect to Docker service instead of spawning
   */
  private async startAPIServer(): Promise<void> {
    this.logger.info(`Connecting to Bitwarden API at ${this.apiBaseUrl}...`);

    // Check if persistent service is available
    try {
      this.logger.debug(`Attempting to connect to persistent service at: ${this.apiBaseUrl}/status`);
      const response = await fetch(`${this.apiBaseUrl}/status`);
      this.logger.debug(`Response status: ${response.status}, ok: ${response.ok}`);
      if (response.ok) {
        const responseText = await response.text();
        this.logger.debug(`Response body: ${responseText}`);
        this.isServerRunning = true;
        this.logger.info('✅ Connected to persistent Bitwarden API service');
        this.logger.info('🚀 Performance: Using persistent connection (no spawning overhead)');
        return;
      }
    } catch (error) {
      this.logger.error('Persistent service connection failed:', error);
      this.logger.debug('Persistent service not available, starting local server...');
    }

    // Fallback: Start local bw serve process (legacy mode)
    this.logger.info(`📦 Fallback: Starting local bw serve on ${this.apiBaseUrl}...`);
    this.logger.warn('⚠️  Consider using docker-compose.vaultwarden-optimized.yml for better performance');

    if (this.isServerRunning) {
      this.logger.info('API server already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn(
        './node_modules/.bin/bw',
        ['serve', '--hostname', this.config.apiHost!, '--port', this.config.apiPort!.toString()],
        {
          env: {
            ...process.env,
            BW_SESSION: this.sessionToken
          },
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      let serverStarted = false;

      const logOutput = (data: Buffer, source: 'stdout' | 'stderr') => {
        const output = data.toString();
        this.logger.debug(`BW Server ${source}: ${output}`);
      };

      this.serverProcess.stdout?.on('data', (d) => logOutput(d, 'stdout'));
      this.serverProcess.stderr?.on('data', (d) => logOutput(d, 'stderr'));

      this.serverProcess.on('error', (error) => {
        this.logger.error('Failed to start BW server:', error);
        if (!serverStarted) {
          reject(new Error(`Failed to start API server: ${error.message}`));
        }
      });

      this.serverProcess.on('exit', (code, signal) => {
        this.logger.info(`BW server exited with code ${code}, signal ${signal}`);
        this.isServerRunning = false;
        this.serverProcess = undefined;
      });

      // Poll API until ready (with longer timeout for local spawn)
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${this.apiBaseUrl}/status`);
          if (res.ok) {
            clearInterval(pollInterval);
            serverStarted = true;
            this.isServerRunning = true;
            this.logger.info('🐌 Local Bitwarden server started (consider persistent service)');
            resolve();
          }
        } catch {
          // Ignore connection errors until timeout
        }

        if (Date.now() - startTime > 15000) { // Longer timeout for spawning
          clearInterval(pollInterval);
          if (!serverStarted) {
            reject(new Error('API server startup timeout (15s)'));
          }
        }
      }, 500);
    });
  }


  /**
   * Test API server connectivity
   */
  private async testAPIConnectivity(): Promise<void> {
    this.logger.info('Testing API connectivity...');
    
    try {
      const response = await this.apiClient.get('/status');
      this.logger.info('API connectivity test successful');
      this.logger.debug(`API status: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      throw new Error(`API connectivity test failed: ${error.message}`);
    }
  }

  /**
   * Initialize: Configure, authenticate, start server
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info(`🔧 BitwardenRESTAPI initializing with apiBaseUrl: ${this.apiBaseUrl}`);
      
      // Quick check: if persistent service is available, skip CLI auth overhead
      const persistentServiceAvailable = await this.checkPersistentService();
      
      this.logger.info(`🔍 Persistent service check result: ${persistentServiceAvailable}`);
      
      if (persistentServiceAvailable) {
        this.logger.info('⚡ Fast path: Using persistent service, skipping CLI authentication');
        this.isServerRunning = true;
        this.logger.info('✅ Connected to persistent Bitwarden API service');
        this.logger.info('🚀 Performance: Using persistent connection (no spawning overhead)');
      } else {
        // Fallback: full CLI initialization for local spawning
        this.logger.info('🐌 Slow path: Persistent service unavailable, using CLI authentication');
        await this.configureCLI(); // Needed for switching to a different vaultwarden server
        await this.authenticateWithAPIKey();
        await this.unlockVault();
        await this.startAPIServer();
      }
      
      // Skip connectivity test if using persistent service (already tested in startAPIServer)
      if (this.isServerRunning) {
        this.logger.info('Skipping connectivity test - persistent service already verified');
      } else {
        this.logger.info('Starting API connectivity test...');
        await this.testAPIConnectivity();
        this.logger.info('API connectivity test done');
      }
      
      this.logger.info('BitwardenRESTAPI initialized successfully');
    } catch (error: any) {
      await this.cleanup();
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  /**
   * List all items
   */
  async listItems(): Promise<BitwardenSecret[]> {
    try {
      const response = await this.apiClient.get('/list/object/items');
      let items: BitwardenItem[] = response.data?.data ?? response.data ?? [];

      // If it's not an array, make it an empty array
      if (!Array.isArray(items)) {
        items = [];
      }

      if (items.length === 0) {
        this.logger.info('No items found in vault.');
        return [];
      }

      return items.map(item => ({
        id: item.id,
        organizationId: item.organizationId,
        name: item.name,
        notes: item.notes,
        value: item.login?.password || item.notes || '',
        creationDate: item.creationDate,
        revisionDate: item.revisionDate
      }));
    } catch (error: any) {
      throw new Error(`Failed to list items: ${error.message}`);
    }
  }

  /**
   * Get item by ID
   */
  async getItem(id: string): Promise<BitwardenSecret | null> {
    try {
      const response = await this.apiClient.get(`/object/item/${id}`);
      const item: BitwardenItem = response.data.data || response.data;
      
      return {
        id: item.id,
        organizationId: item.organizationId,
        name: item.name,
        notes: item.notes,
        value: item.login?.password || item.notes || '', // For secure notes, content is in notes
        creationDate: item.creationDate,
        revisionDate: item.revisionDate
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get item: ${error.message}`);
    }
  }

  /**
   * Create a new secure note with API key
   */
  async createSecret(name: string, value: string, notes?: string, organizationId?: string): Promise<string> {
    try {
      const item = {
        type: 2, // Secure Note
        name,
        notes: value, // Store the actual API key value in notes field
        favorite: false,
        secureNote: {
          type: 0
        },
        organizationId: organizationId || null,
        folderId: null,
        reprompt: 0
      };

      const response = await this.apiClient.post('/object/item', item);
      const createdItem: BitwardenItem = response.data.data || response.data;
      
      this.logger.info(`Created secret: ${name} (${createdItem.id})`);
      return createdItem.id;
    } catch (error: any) {
      throw new Error(`Failed to create secret: ${error.message}`);
    }
  }

  /**
   * Update an existing item
   */
  async updateSecret(id: string, name: string, value: string, notes?: string): Promise<void> {
    try {
      // First get the existing item
      const existingSecret = await this.getItem(id);
      if (!existingSecret) {
        throw new Error(`Item not found: ${id}`);
      }

      const updatedItem = {
        id,
        type: 2, // Secure Note
        name,
        notes: value, // Store the actual API key value in notes field
        favorite: false,
        secureNote: {
          type: 0
        },
        organizationId: existingSecret.organizationId,
        folderId: null,
        reprompt: 0
      };

      await this.apiClient.put(`/object/item/${id}`, updatedItem);
      this.logger.info(`Updated secret: ${name} (${id})`);
    } catch (error: any) {
      throw new Error(`Failed to update secret: ${error.message}`);
    }
  }

  /**
   * Delete an item
   */
  async deleteSecret(id: string): Promise<void> {
    try {
      await this.apiClient.delete(`/object/item/${id}`);
      this.logger.info(`Deleted secret: ${id}`);
    } catch (error: any) {
      throw new Error(`Failed to delete secret: ${error.message}`);
    }
  }

  /**
   * Search for items by name
   */
  async searchSecrets(searchTerm: string): Promise<BitwardenSecret[]> {
    try {
      const allItems = await this.listItems();
      return allItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error: any) {
      throw new Error(`Failed to search secrets: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{status: 'healthy' | 'unhealthy', details: any}> {
    try {
      if (!this.isServerRunning) {
        return {
          status: 'unhealthy',
          details: { error: 'API server not running' }
        };
      }

      const response = await this.apiClient.get('/status');
      
      return {
        status: 'healthy',
        details: {
          serverRunning: this.isServerRunning,
          apiPort: this.config.apiPort,
          responseStatus: response.status,
          hasSession: !!this.sessionToken
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  /**
   * Cleanup: Stop server and clear resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Bitwarden REST API...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = undefined;
    }
    
    this.isServerRunning = false;
    this.sessionToken = undefined;
    
    this.logger.info('Cleanup completed');
  }
}

export default BitwardenRESTAPI;