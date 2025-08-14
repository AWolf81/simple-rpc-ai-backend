# Vaultwarden Secret Management Integration

**Feature Specification for Simple RPC AI Backend**

## Overview

Replace the current SQLite-based API key storage with a secure, enterprise-grade Vaultwarden integration. This provides end-to-end encrypted secret management with user-friendly client applications and robust backup/restore capabilities.

## Problem Statement

### Current Issues with SQLite Implementation
- **Security**: API keys stored in local database with basic encryption
- **Scalability**: No multi-user support or organizations  
- **Management**: No user-friendly interface for key management
- **Backup**: Manual database backup with potential corruption risks
- **Import/Export**: No standardized format for migrating secrets
- **Audit**: Limited logging and access tracking

### Business Requirements
- Secure storage of AI provider API keys
- Multi-user support with organization-level access control
- Easy user onboarding with familiar password manager UX
- Import capabilities from popular password managers
- Automated backup and disaster recovery
- Future extensibility for team/enterprise features

## Solution: Vaultwarden Integration

### Architecture Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code       │    │  Simple RPC      │    │  Vaultwarden    │
│   Extension     │───▶│  AI Backend      │───▶│   Instance      │
│                 │    │                  │    │                 │
│  User requests  │    │ Secret Manager   │    │ Encrypted Vault │
│  AI generation  │    │ Service Layer    │    │ PostgreSQL DB   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ Bitwarden Apps  │
                                               │ (User Management)│
                                               └─────────────────┘
```

## Technical Specification

### 1. Infrastructure Components

#### 1.1 Vaultwarden Deployment
```yaml
# docker-compose.vaultwarden.yml
version: '3.8'
services:
  vaultwarden:
    image: vaultwarden/server:1.30.1
    container_name: simple-rpc-vaultwarden
    restart: unless-stopped
    environment:
      # Core Configuration
      DOMAIN: https://vault.your-domain.com
      WEBSOCKET_ENABLED: true
      ROCKET_PORT: 80
      
      # Security Settings
      SIGNUPS_ALLOWED: false
      INVITATIONS_ALLOWED: true
      ADMIN_TOKEN: ${VW_ADMIN_TOKEN}
      
      # Database Configuration
      DATABASE_URL: postgresql://${VW_DB_USER}:${VW_DB_PASS}@postgres:5432/vaultwarden
      
      # API Access
      ORG_CREATION_USERS: ${VW_SERVICE_EMAIL}
      
      # Backup Settings
      BACKUP_SCHEDULE: "0 2 * * *"  # Daily at 2 AM
      
    volumes:
      - vw_data:/data
      - ./backups:/backups
    ports:
      - "8080:80"
    networks:
      - simple-rpc-network

  postgres:
    image: postgres:15-alpine
    container_name: simple-rpc-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: vaultwarden
      POSTGRES_USER: ${VW_DB_USER}
      POSTGRES_PASSWORD: ${VW_DB_PASS}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    networks:
      - simple-rpc-network

volumes:
  vw_data:
  postgres_data:

networks:
  simple-rpc-network:
    external: true
```

#### 1.2 Environment Configuration
```bash
# .env.vaultwarden
VW_ADMIN_TOKEN=<secure-random-token>
VW_DB_USER=vaultwarden_user
VW_DB_PASS=<secure-database-password>
VW_SERVICE_EMAIL=service@your-domain.com
VW_SERVICE_PASSWORD=<secure-service-password>
SIMPLE_RPC_ORG_ID=<generated-after-setup>
```

### 2. Service Layer Implementation

#### 2.1 Vaultwarden Secret Manager
```typescript
// src/services/VaultwardenSecretManager.ts
import { Client } from '@bitwarden/sdk-node';
import { SecretManagerInterface } from './interfaces/SecretManagerInterface';

export class VaultwardenSecretManager implements SecretManagerInterface {
  private client: Client;
  private organizationId: string;
  private projectId: string;

  constructor(
    private serverUrl: string,
    private serviceEmail: string,
    private servicePassword: string,
    organizationId: string
  ) {
    this.organizationId = organizationId;
  }

  async initialize(): Promise<void> {
    this.client = new Client({
      apiUrl: `${this.serverUrl}/api`,
      identityUrl: `${this.serverUrl}/identity`,
    });

    // Authenticate service account
    await this.client.auth.login({
      email: this.serviceEmail,
      password: this.servicePassword,
    });

    // Get or create "AI Provider Keys" project
    this.projectId = await this.ensureProject('AI Provider Keys');
  }

  async storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string> {
    const secretName = userId 
      ? `${provider}-${userId}`
      : `${provider}-default`;

    const secretId = await this.client.secrets.create({
      organizationId: this.organizationId,
      projectId: this.projectId,
      key: secretName,
      value: apiKey,
      note: `API key for ${provider} provider${userId ? ` (user: ${userId})` : ' (default)'}`,
    });

    await this.auditLog('STORE_API_KEY', {
      provider,
      userId,
      secretId,
      timestamp: new Date().toISOString(),
    });

    return secretId;
  }

  async getApiKey(provider: string, userId?: string): Promise<string | null> {
    const secretName = userId 
      ? `${provider}-${userId}`
      : `${provider}-default`;

    try {
      const secrets = await this.client.secrets.list({
        organizationId: this.organizationId,
        projectId: this.projectId,
      });

      const secret = secrets.data.find(s => s.key === secretName);
      if (!secret) return null;

      const secretData = await this.client.secrets.get(secret.id);
      
      await this.auditLog('RETRIEVE_API_KEY', {
        provider,
        userId,
        secretId: secret.id,
        timestamp: new Date().toISOString(),
      });

      return secretData.value;
    } catch (error) {
      await this.auditLog('RETRIEVE_API_KEY_ERROR', {
        provider,
        userId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  async deleteApiKey(provider: string, userId?: string): Promise<boolean> {
    const secretName = userId 
      ? `${provider}-${userId}`
      : `${provider}-default`;

    try {
      const secrets = await this.client.secrets.list({
        organizationId: this.organizationId,
        projectId: this.projectId,
      });

      const secret = secrets.data.find(s => s.key === secretName);
      if (!secret) return false;

      await this.client.secrets.delete(secret.id);
      
      await this.auditLog('DELETE_API_KEY', {
        provider,
        userId,
        secretId: secret.id,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      await this.auditLog('DELETE_API_KEY_ERROR', {
        provider,
        userId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  async listUserApiKeys(userId?: string): Promise<Array<{provider: string, hasKey: boolean}>> {
    const secrets = await this.client.secrets.list({
      organizationId: this.organizationId,
      projectId: this.projectId,
    });

    const userSuffix = userId ? `-${userId}` : '-default';
    const providers = ['anthropic', 'openai', 'google', 'deepseek', 'openrouter'];
    
    return providers.map(provider => ({
      provider,
      hasKey: secrets.data.some(s => s.key === `${provider}${userSuffix}`)
    }));
  }

  async rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string> {
    // Delete old key
    await this.deleteApiKey(provider, userId);
    
    // Store new key
    const secretId = await this.storeApiKey(provider, newApiKey, userId);
    
    await this.auditLog('ROTATE_API_KEY', {
      provider,
      userId,
      secretId,
      timestamp: new Date().toISOString(),
    });

    return secretId;
  }

  private async ensureProject(projectName: string): Promise<string> {
    const projects = await this.client.projects.list(this.organizationId);
    const existing = projects.data.find(p => p.name === projectName);
    
    if (existing) return existing.id;

    const project = await this.client.projects.create({
      organizationId: this.organizationId,
      name: projectName,
    });

    return project.id;
  }

  private async auditLog(action: string, data: any): Promise<void> {
    // Log to structured logging system
    console.log(JSON.stringify({
      service: 'VaultwardenSecretManager',
      action,
      data,
      timestamp: new Date().toISOString(),
    }));
  }

  async healthCheck(): Promise<{status: 'healthy' | 'unhealthy', details: any}> {
    try {
      await this.client.projects.list(this.organizationId);
      return {
        status: 'healthy',
        details: {
          serverUrl: this.serverUrl,
          organizationId: this.organizationId,
          projectId: this.projectId,
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }
}
```

#### 2.2 Interface Definition
```typescript
// src/services/interfaces/SecretManagerInterface.ts
export interface SecretManagerInterface {
  initialize(): Promise<void>;
  storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string>;
  getApiKey(provider: string, userId?: string): Promise<string | null>;
  deleteApiKey(provider: string, userId?: string): Promise<boolean>;
  listUserApiKeys(userId?: string): Promise<Array<{provider: string, hasKey: boolean}>>;
  rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string>;
  healthCheck(): Promise<{status: 'healthy' | 'unhealthy', details: any}>;
}
```

#### 2.3 Migration Service
```typescript
// src/services/MigrationService.ts
import { VaultwardenSecretManager } from './VaultwardenSecretManager';
import { LegacySQLiteManager } from './LegacySQLiteManager';

export class MigrationService {
  constructor(
    private vaultwarden: VaultwardenSecretManager,
    private sqlite: LegacySQLiteManager
  ) {}

  async migrateSQLiteToVaultwarden(): Promise<{migrated: number, errors: string[]}> {
    const results = { migrated: 0, errors: [] };
    
    try {
      // Get all API keys from SQLite
      const legacyKeys = await this.sqlite.getAllApiKeys();
      
      for (const key of legacyKeys) {
        try {
          await this.vaultwarden.storeApiKey(
            key.provider, 
            key.apiKey, 
            key.userId
          );
          results.migrated++;
        } catch (error) {
          results.errors.push(`Failed to migrate ${key.provider}: ${error.message}`);
        }
      }

      // Backup SQLite database before cleanup
      await this.sqlite.createBackup(`pre-vaultwarden-migration-${Date.now()}.db`);
      
      return results;
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  async validateMigration(): Promise<{valid: boolean, issues: string[]}> {
    const issues = [];
    
    // Compare counts
    const sqliteCount = await this.sqlite.getApiKeyCount();
    const vaultwardenKeys = await this.vaultwarden.listUserApiKeys();
    const vaultwardenCount = vaultwardenKeys.filter(k => k.hasKey).length;
    
    if (sqliteCount !== vaultwardenCount) {
      issues.push(`Key count mismatch: SQLite(${sqliteCount}) vs Vaultwarden(${vaultwardenCount})`);
    }

    // Validate key accessibility
    for (const key of vaultwardenKeys) {
      if (key.hasKey) {
        const retrieved = await this.vaultwarden.getApiKey(key.provider);
        if (!retrieved) {
          issues.push(`Cannot retrieve ${key.provider} key from Vaultwarden`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
```

### 3. RPC Method Updates

#### 3.1 Enhanced RPC Methods
```typescript
// src/rpc/secretMethods.ts
export const secretMethods = {
  // Store API key for a provider
  async storeProviderApiKey(params: {
    provider: string;
    apiKey: string;
    userId?: string;
  }) {
    const secretId = await secretManager.storeApiKey(
      params.provider,
      params.apiKey,
      params.userId
    );
    
    return {
      success: true,
      secretId,
      message: `API key stored securely for ${params.provider}`
    };
  },

  // Get API key for a provider
  async getProviderApiKey(params: {
    provider: string;
    userId?: string;
  }) {
    const apiKey = await secretManager.getApiKey(
      params.provider,
      params.userId
    );
    
    return {
      success: !!apiKey,
      hasKey: !!apiKey,
      message: apiKey ? 'API key retrieved' : 'No API key found'
    };
  },

  // Delete API key
  async deleteProviderApiKey(params: {
    provider: string;
    userId?: string;
  }) {
    const deleted = await secretManager.deleteApiKey(
      params.provider,
      params.userId
    );
    
    return {
      success: deleted,
      message: deleted ? 'API key deleted' : 'API key not found'
    };
  },

  // List available providers and their key status
  async listProviderKeys(params: { userId?: string }) {
    const keys = await secretManager.listUserApiKeys(params.userId);
    
    return {
      success: true,
      providers: keys,
      message: `Found ${keys.filter(k => k.hasKey).length} configured providers`
    };
  },

  // Rotate API key
  async rotateProviderApiKey(params: {
    provider: string;
    newApiKey: string;
    userId?: string;
  }) {
    const secretId = await secretManager.rotateApiKey(
      params.provider,
      params.newApiKey,
      params.userId
    );
    
    return {
      success: true,
      secretId,
      message: `API key rotated for ${params.provider}`
    };
  },

  // Health check
  async vaultwardenHealth() {
    const health = await secretManager.healthCheck();
    
    return {
      success: health.status === 'healthy',
      status: health.status,
      details: health.details,
      timestamp: new Date().toISOString()
    };
  },

  // Migration from SQLite
  async migrationStatus() {
    return {
      success: true,
      status: migrationService.getStatus(),
      canMigrate: migrationService.canMigrate(),
      timestamp: new Date().toISOString()
    };
  },

  async migrateFromSQLite() {
    const results = await migrationService.migrateSQLiteToVaultwarden();
    
    return {
      success: results.errors.length === 0,
      migrated: results.migrated,
      errors: results.errors,
      message: `Migrated ${results.migrated} API keys`
    };
  }
};
```

### 4. User Management Features

#### 4.1 User Invitation System
```typescript
// src/services/UserInvitationService.ts
export class UserInvitationService {
  constructor(private vaultwarden: VaultwardenSecretManager) {}

  async inviteUser(email: string, role: 'user' | 'admin' = 'user'): Promise<string> {
    // Create invitation in Vaultwarden
    const invitation = await this.vaultwarden.client.organizations.inviteUser({
      organizationId: this.vaultwarden.organizationId,
      email,
      type: role === 'admin' ? 1 : 2, // 1 = Admin, 2 = User
      accessAll: false,
      collections: [], // Users can only access their own secrets
    });

    // Send invitation email (implement email service)
    await this.sendInvitationEmail(email, invitation.token);

    return invitation.id;
  }

  async revokeInvitation(invitationId: string): Promise<boolean> {
    try {
      await this.vaultwarden.client.organizations.deleteInvitation(
        this.vaultwarden.organizationId,
        invitationId
      );
      return true;
    } catch {
      return false;
    }
  }

  private async sendInvitationEmail(email: string, token: string): Promise<void> {
    // Implement email service integration
    // Could use SendGrid, AWS SES, etc.
    console.log(`TODO: Send invitation email to ${email} with token ${token}`);
  }
}
```

### 5. Backup and Disaster Recovery

#### 5.1 Automated Backup System
```bash
#!/bin/bash
# scripts/backup-vaultwarden.sh

BACKUP_DIR="/app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="simple-rpc-vaultwarden"
DB_CONTAINER="simple-rpc-postgres"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Vaultwarden data
docker exec $CONTAINER tar czf "/backups/vw_data_$DATE.tar.gz" -C /data .

# Backup PostgreSQL database
docker exec $DB_CONTAINER pg_dump -U $VW_DB_USER vaultwarden | gzip > "$BACKUP_DIR/vw_db_$DATE.sql.gz"

# Encrypt backups
gpg --symmetric --cipher-algo AES256 "$BACKUP_DIR/vw_data_$DATE.tar.gz"
gpg --symmetric --cipher-algo AES256 "$BACKUP_DIR/vw_db_$DATE.sql.gz"

# Clean up unencrypted backups
rm "$BACKUP_DIR/vw_data_$DATE.tar.gz"
rm "$BACKUP_DIR/vw_db_$DATE.sql.gz"

# Clean old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.gpg" -mtime +30 -delete

echo "Backup completed: $DATE"
```

#### 5.2 Restore Procedure
```bash
#!/bin/bash
# scripts/restore-vaultwarden.sh

BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz.gpg>"
    exit 1
fi

# Decrypt backup
gpg --decrypt "$BACKUP_FILE" > "${BACKUP_FILE%.gpg}"

# Stop services
docker-compose -f docker-compose.vaultwarden.yml down

# Restore data
docker run --rm -v simple-rpc_vw_data:/data -v $(pwd):/backup alpine \
    sh -c "cd /data && rm -rf * && tar xzf /backup/${BACKUP_FILE%.gpg}"

# Start services
docker-compose -f docker-compose.vaultwarden.yml up -d

echo "Restore completed"
```

### 6. Configuration and Deployment

#### 6.1 Environment Setup
```typescript
// src/config/vaultwarden.ts
export interface VaultwardenConfig {
  serverUrl: string;
  serviceEmail: string;
  servicePassword: string;
  organizationId: string;
  adminToken: string;
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}

export const vaultwardenConfig: VaultwardenConfig = {
  serverUrl: process.env.VAULTWARDEN_URL || 'http://localhost:8080',
  serviceEmail: process.env.VW_SERVICE_EMAIL!,
  servicePassword: process.env.VW_SERVICE_PASSWORD!,
  organizationId: process.env.SIMPLE_RPC_ORG_ID!,
  adminToken: process.env.VW_ADMIN_TOKEN!,
  database: {
    host: process.env.VW_DB_HOST || 'localhost',
    port: parseInt(process.env.VW_DB_PORT || '5432'),
    database: process.env.VW_DB_NAME || 'vaultwarden',
    username: process.env.VW_DB_USER!,
    password: process.env.VW_DB_PASS!,
  },
};
```

#### 6.2 Health Monitoring
```typescript
// src/monitoring/VaultwardenMonitor.ts
export class VaultwardenMonitor {
  constructor(private secretManager: VaultwardenSecretManager) {}

  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
    timestamp: string;
  }> {
    const checks: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check Vaultwarden API connectivity
    try {
      const vwHealth = await this.secretManager.healthCheck();
      checks.vaultwarden_api = vwHealth;
      if (vwHealth.status !== 'healthy') overallStatus = 'degraded';
    } catch (error) {
      checks.vaultwarden_api = { status: 'unhealthy', error: error.message };
      overallStatus = 'unhealthy';
    }

    // Check database connectivity
    try {
      const dbHealth = await this.checkDatabaseHealth();
      checks.database = dbHealth;
      if (!dbHealth.connected) overallStatus = 'unhealthy';
    } catch (error) {
      checks.database = { connected: false, error: error.message };
      overallStatus = 'unhealthy';
    }

    // Check backup system
    try {
      const backupHealth = await this.checkBackupSystem();
      checks.backup_system = backupHealth;
      if (!backupHealth.operational) overallStatus = 'degraded';
    } catch (error) {
      checks.backup_system = { operational: false, error: error.message };
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabaseHealth() {
    // Implement database connectivity check
    return { connected: true, latency: '< 10ms' };
  }

  private async checkBackupSystem() {
    // Check if backup system is operational
    return { operational: true, lastBackup: new Date().toISOString() };
  }
}
```

## Implementation Timeline

### Phase 1: Infrastructure Setup (Week 1)
- [ ] Deploy Vaultwarden with PostgreSQL backend
- [ ] Configure SSL/TLS certificates
- [ ] Set up automated backups
- [ ] Create service account and organization
- [ ] Test basic API connectivity

### Phase 2: Service Integration (Week 2)
- [ ] Implement `VaultwardenSecretManager` class
- [ ] Create migration service from SQLite
- [ ] Update RPC methods for secret management
- [ ] Add comprehensive error handling and logging
- [ ] Implement health monitoring

### Phase 3: Migration (Week 3)
- [ ] Backup existing SQLite database
- [ ] Run migration script with validation
- [ ] Update Simple RPC AI Backend configuration
- [ ] Deploy updated backend with Vaultwarden integration
- [ ] Verify all existing API keys work correctly

### Phase 4: User Features (Week 4)
- [ ] Implement user invitation system
- [ ] Create documentation for Bitwarden client setup
- [ ] Add import/export functionality
- [ ] Set up monitoring and alerting
- [ ] Performance testing and optimization

## Security Considerations

### 1. Access Control
- Service account has minimal required permissions
- Organization-level isolation for Simple RPC secrets
- Regular rotation of service account credentials
- Audit logging for all secret operations

### 2. Network Security
- Vaultwarden behind reverse proxy with SSL termination
- Database connections encrypted with TLS
- API rate limiting and request validation
- Network segmentation between components

### 3. Data Protection
- End-to-end encryption for all secrets
- Encrypted backups with separate key management
- Secure key derivation for service authentication
- Regular security updates and vulnerability scanning

## Testing Strategy

### Unit Tests
```typescript
// tests/VaultwardenSecretManager.test.ts
describe('VaultwardenSecretManager', () => {
  let manager: VaultwardenSecretManager;
  
  beforeEach(() => {
    manager = new VaultwardenSecretManager(/* test config */);
  });

  test('should store and retrieve API keys', async () => {
    const secretId = await manager.storeApiKey('openai', 'test-key');
    const retrieved = await manager.getApiKey('openai');
    expect(retrieved).toBe('test-key');
  });

  test('should handle provider rotation', async () => {
    await manager.storeApiKey('anthropic', 'old-key');
    await manager.rotateApiKey('anthropic', 'new-key');
    const retrieved = await manager.getApiKey('anthropic');
    expect(retrieved).toBe('new-key');
  });

  test('should list user API keys correctly', async () => {
    await manager.storeApiKey('openai', 'key1', 'user1');
    await manager.storeApiKey('anthropic', 'key2', 'user1');
    
    const keys = await manager.listUserApiKeys('user1');
    expect(keys.filter(k => k.hasKey)).toHaveLength(2);
  });
});
```

### Integration Tests
```typescript
// tests/integration/VaultwardenIntegration.test.ts
describe('Vaultwarden Integration', () => {
  test('should perform complete lifecycle', async () => {
    // Store, retrieve, rotate, delete
    // Verify audit logs
    // Check health monitoring
  });

  test('should migrate from SQLite correctly', async () => {
    // Setup test SQLite database
    // Run migration
    // Validate all keys migrated
  });
});
```

## Dependencies

### New NPM Packages
```json
{
  "dependencies": {
    "@bitwarden/sdk-node": "^0.4.0",
    "pg": "^8.11.0",
    "@types/pg": "^8.10.0"
  },
  "devDependencies": {
    "@testcontainers/postgresql": "^10.2.0",
    "@testcontainers/compose": "^10.2.0"
  }
}
```

### Docker Images
- `vaultwarden/server:1.30.1`
- `postgres:15-alpine`

## Documentation Requirements

### User Documentation
1. **Setup Guide**: How to install and configure Vaultwarden
2. **Migration Guide**: Step-by-step SQLite to Vaultwarden migration
3. **Client Setup**: Using Bitwarden apps to manage API keys
4. **Import Guide**: Importing from other password managers
5. **Troubleshooting**: Common issues and solutions

### Developer Documentation
1. **API Reference**: RPC method documentation
2. **Architecture Overview**: System design and data flow
3. **Deployment Guide**: Production deployment procedures
4. **Monitoring Guide**: Health checks and alerting setup
5. **Backup/Restore**: Disaster recovery procedures

## Success Metrics

### Security Metrics
- Zero API key exposure incidents
- 100% encrypted storage compliance
- Complete audit trail for all operations
- Regular security scan compliance

### Performance Metrics
- < 100ms average secret retrieval time
- 99.9% uptime for secret management
- < 5 second migration completion time
- Zero data loss during migrations

### User Experience Metrics
- One-click API key import from popular managers
- Self-service key management via Bitwarden apps
- Zero-downtime deployments and updates
- Comprehensive error messages and recovery guidance

## Rollback Plan

If critical issues arise:

1. **Immediate Rollback**: Switch RPC backend to use SQLite backup
2. **Data Recovery**: Restore from encrypted backups
3. **Service Restart**: Restart with previous configuration
4. **User Communication**: Notify users of temporary service changes

The SQLite implementation will remain as a fallback option during the initial rollout period.