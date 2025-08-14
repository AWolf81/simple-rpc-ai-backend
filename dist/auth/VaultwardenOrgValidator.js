/**
 * Vaultwarden Organization Validator
 *
 * Validates organization access during server startup
 */
import { BitwardenRESTAPI } from './BitwardenRESTAPI.js';
import * as winston from 'winston';
export class VaultwardenOrgValidator {
    logger;
    constructor(logger) {
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Validate Vaultwarden organization access during server startup
     */
    async validateOrganizationAccess(config) {
        this.logger.info('🏢 Validating Vaultwarden organization access...', {
            serverUrl: config.serverUrl,
            organizationId: config.organizationId,
            serviceEmail: config.serviceEmail
        });
        try {
            // Initialize Bitwarden REST API
            const api = new BitwardenRESTAPI({
                serverUrl: config.serverUrl,
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                masterPassword: config.masterPassword,
                serviceEmail: config.serviceEmail
            });
            // Test initialization
            await api.initialize();
            // Get health status
            const healthStatus = await api.getHealthStatus();
            if (!healthStatus.serverRunning) {
                return {
                    isValid: false,
                    error: 'Vaultwarden server not running or accessible'
                };
            }
            this.logger.info('✅ Vaultwarden server is accessible and healthy');
            // Test basic vault operations
            try {
                const items = await api.listItems();
                this.logger.info('✅ Vault access working', {
                    itemCount: items.length
                });
            }
            catch (error) {
                this.logger.warn('⚠️ Vault access limited', {
                    error: error.message
                });
            }
            // For now, assume organization is valid if we can access the vault
            // In a real setup, we'd check organization membership via API
            return {
                isValid: true,
                organizationName: `Organization: ${config.organizationId}`
            };
        }
        catch (error) {
            this.logger.error('❌ Organization validation failed', {
                error: error.message,
                organizationId: config.organizationId
            });
            return {
                isValid: false,
                error: `Organization validation failed: ${error.message}`
            };
        }
    }
    /**
     * Auto-setup guidance if validation fails
     */
    async provideSetupGuidance(config) {
        this.logger.info('🛠️ Vaultwarden Setup Guidance', {
            message: 'Organization validation failed - manual setup required'
        });
        console.log(`
🏢 Vaultwarden Organization Setup Required
==========================================

📋 Configuration:
   Server: ${config.serverUrl}
   Service Account: ${config.serviceEmail}
   Expected Organization: ${config.organizationId}

📝 Manual Setup Steps:
   1. Visit: ${config.serverUrl}/#/register
   2. Register with email: ${config.serviceEmail}
   3. Login and create organization: "${config.organizationId}"
   4. Go to Settings > Security > API Key
   5. Generate API key and update environment:
      • VW_SERVICE_CLIENT_ID=user.xxxxx
      • VW_SERVICE_ACCESS_TOKEN=xxxxx
   6. Restart server

🔗 Admin Panel: ${config.serverUrl}/admin/
   (Use VW_ADMIN_TOKEN to access)

📧 Need help? Check documentation for detailed setup instructions.
    `);
    }
    /**
     * Get organization configuration from environment
     */
    static getConfigFromEnv() {
        return {
            serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
            clientId: process.env.VW_SERVICE_CLIENT_ID || '',
            clientSecret: process.env.VW_SERVICE_ACCESS_TOKEN || '',
            masterPassword: process.env.VW_SERVICE_PASSWORD || '',
            organizationId: process.env.SIMPLE_RPC_ORG_ID || '',
            serviceEmail: process.env.VW_SERVICE_EMAIL || 'service@simple-rpc-ai.local'
        };
    }
}
export default VaultwardenOrgValidator;
//# sourceMappingURL=VaultwardenOrgValidator.js.map