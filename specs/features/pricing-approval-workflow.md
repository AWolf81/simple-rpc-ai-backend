# 💰 Feature Spec: Pricing Change Approval Workflow

## Overview

Automated approval workflow for AI provider pricing changes during registry updates. Provides safety controls for significant pricing changes that could impact cost calculations and billing.

## Problem Statement

- Registry pricing data can change unexpectedly
- Significant pricing changes (>20%) should require manual approval
- Need audit trail for all pricing changes
- Risk of cost overruns without proper oversight
- Need to balance automation with safety controls

## Solution Design

### Core Components

1. **Pricing Change Detection**
   - Compare current vs. new pricing during registry updates
   - Calculate percentage changes for all models
   - Flag changes above configurable thresholds

2. **Approval Workflow Engine**
   - Queue pricing changes requiring approval
   - Support multiple approval levels based on change magnitude
   - Automatic approval for minor changes (configurable threshold)

3. **Admin Dashboard**
   - Web interface for reviewing pending pricing changes
   - Side-by-side comparison of old vs. new pricing
   - Bulk approval/rejection capabilities
   - Historical pricing change log

4. **Notification System**
   - Email alerts for significant pricing changes
   - Slack/Teams integration for team notifications
   - Summary reports of approved/rejected changes

## API Design

### Core Types

```typescript
interface PricingChange {
  id: string;
  provider: string;
  model?: string;
  changeType: 'increase' | 'decrease' | 'new' | 'removed';
  currentPricing: PricingInfo;
  newPricing: PricingInfo;
  percentageChange: number;
  detectedAt: string;
  source: 'registry_update' | 'manual_override';
  metadata: {
    registryVersion?: string;
    updateReason?: string;
  };
}

interface PricingChangeApproval {
  id: string;
  changeId: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  approver?: string;
  approverRole: 'admin' | 'finance' | 'system';
  approvedAt?: string;
  reason?: string;
  effectiveDate?: string;
  expiresAt?: string;
}

interface ApprovalRule {
  id: string;
  name: string;
  conditions: {
    percentageThreshold: number;
    changeType?: 'increase' | 'decrease';
    provider?: string;
    amountThreshold?: number; // absolute dollar change
  };
  action: 'auto_approve' | 'require_approval' | 'require_finance_approval';
  priority: number;
}
```

### New RPC Methods

```typescript
// Get pending pricing changes
getPendingPricingChanges: protectedProcedure
  .input(z.object({
    status?: z.enum(['pending', 'approved', 'rejected']),
    provider?: z.string(),
    limit?: z.number().default(50)
  }))
  .query(async ({ input }) => {
    // Return paginated list of pricing changes
  });

// Approve/reject pricing change
approvePricingChange: protectedProcedure
  .input(z.object({
    changeId: z.string(),
    action: z.enum(['approve', 'reject']),
    reason?: z.string(),
    effectiveDate?: z.string()
  }))
  .mutation(async ({ input, ctx }) => {
    // Process approval/rejection
  });

// Bulk approve changes
bulkApprovePricingChanges: protectedProcedure
  .input(z.object({
    changeIds: z.array(z.string()),
    action: z.enum(['approve', 'reject']),
    reason?: z.string()
  }))
  .mutation(async ({ input, ctx }) => {
    // Process bulk approval
  });

// Configure approval rules
configureApprovalRules: protectedProcedure
  .input(z.object({
    rules: z.array(ApprovalRuleSchema)
  }))
  .mutation(async ({ input, ctx }) => {
    // Update approval rules
  });

// Get pricing change history
getPricingChangeHistory: protectedProcedure
  .input(z.object({
    provider?: z.string(),
    model?: z.string(),
    dateRange?: z.object({
      start: z.string(),
      end: z.string()
    }),
    limit?: z.number().default(100)
  }))
  .query(async ({ input }) => {
    // Return historical pricing changes
  });
```

### Registry Update Integration

```typescript
// Enhanced registry service with approval workflow
class ProviderRegistryService {
  async updateFromRegistry(): Promise<RegistryUpdateResult> {
    // 1. Download new registry data
    const newData = await this.downloadRegistryData();
    
    // 2. Detect pricing changes
    const changes = await this.detectPricingChanges(newData);
    
    // 3. Apply approval rules
    const { autoApproved, requiresApproval } = await this.applyApprovalRules(changes);
    
    // 4. Process auto-approved changes
    await this.applyPricingChanges(autoApproved);
    
    // 5. Queue changes requiring approval
    await this.queueForApproval(requiresApproval);
    
    // 6. Send notifications
    await this.sendNotifications(requiresApproval);
    
    return {
      totalChanges: changes.length,
      autoApproved: autoApproved.length,
      pendingApproval: requiresApproval.length,
      summary: this.generateUpdateSummary(changes)
    };
  }
}
```

## Admin Dashboard Design

### Dashboard Sections

1. **Pending Approvals**
   - List of pricing changes awaiting approval
   - Quick approve/reject buttons
   - Bulk selection and actions
   - Priority indicators based on change magnitude

2. **Pricing Comparison View**
   ```
   [Provider: Anthropic] [Model: Claude 3.5 Sonnet]
   
   Current Pricing          New Pricing             Change
   Input:  $3.00/1k  →     Input:  $3.50/1k       +16.7% ↗
   Output: $15.00/1k →     Output: $15.00/1k       No change
   
   [Approve] [Reject] [Schedule for later]
   ```

3. **Approval Rules Configuration**
   - Visual rule builder
   - Test rules against historical data
   - Rule priority management

4. **Change History & Audit Log**
   - Complete history of all pricing changes
   - Filter by provider, date, approver
   - Export capabilities for compliance

### Notification Templates

```typescript
interface NotificationTemplate {
  type: 'pricing_change_detected' | 'approval_required' | 'change_approved';
  channels: ('email' | 'slack' | 'webhook')[];
  template: {
    subject: string;
    body: string;
    variables: string[];
  };
}

// Example notification
const pricingChangeAlert: NotificationTemplate = {
  type: 'approval_required',
  channels: ['email', 'slack'],
  template: {
    subject: 'AI Pricing Change Approval Required: {{provider}}',
    body: `
      🚨 Significant pricing change detected for {{provider}}
      
      Model: {{model}}
      Current Price: {{currentPrice}}
      New Price: {{newPrice}}
      Change: {{percentageChange}}% {{direction}}
      
      Action Required: Review and approve in admin dashboard
      Dashboard: {{dashboardUrl}}
      
      Auto-reject in: {{autoRejectHours}} hours
    `,
    variables: ['provider', 'model', 'currentPrice', 'newPrice', 'percentageChange', 'direction', 'dashboardUrl', 'autoRejectHours']
  }
};
```

## Implementation Phases

### Phase 1: Core Detection & Storage
- [ ] Pricing change detection engine
- [ ] Database schema for changes and approvals
- [ ] Basic approval/rejection API
- [ ] Simple notification system

### Phase 2: Admin Dashboard
- [ ] Web dashboard for managing approvals
- [ ] Pricing comparison views
- [ ] Bulk operations
- [ ] Basic reporting

### Phase 3: Advanced Features
- [ ] Approval rule engine
- [ ] Advanced notifications (Slack, Teams)
- [ ] Scheduled effective dates
- [ ] Compliance reporting

### Phase 4: Automation & Intelligence
- [ ] ML-based anomaly detection
- [ ] Predictive pricing alerts
- [ ] Integration with cost management systems
- [ ] Advanced analytics dashboard

## Configuration Example

```typescript
// approval-config.json
{
  "approvalRules": [
    {
      "name": "Auto-approve minor decreases",
      "conditions": {
        "percentageThreshold": 10,
        "changeType": "decrease"
      },
      "action": "auto_approve",
      "priority": 1
    },
    {
      "name": "Require approval for major increases",
      "conditions": {
        "percentageThreshold": 20,
        "changeType": "increase"
      },
      "action": "require_approval",
      "priority": 2
    },
    {
      "name": "Finance approval for enterprise providers",
      "conditions": {
        "percentageThreshold": 15,
        "provider": "anthropic"
      },
      "action": "require_finance_approval",
      "priority": 3
    }
  ],
  "notifications": {
    "email": {
      "enabled": true,
      "recipients": ["admin@company.com", "finance@company.com"]
    },
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/...",
      "channel": "#ai-operations"
    }
  },
  "autoRejectAfter": "72h",
  "requiresApprovalThreshold": 15
}
```

## Security Considerations

- **Role-based access**: Only admins/finance can approve pricing changes
- **Audit logging**: All approval actions logged with user and timestamp
- **Change isolation**: Failed approvals don't affect live pricing
- **Rollback capability**: Ability to revert approved changes
- **Rate limiting**: Prevent bulk approval abuse

## Success Metrics

- **Safety**: Zero unintended cost overruns from pricing changes
- **Efficiency**: 95% of minor changes auto-approved
- **Transparency**: 100% of pricing changes have audit trail
- **Response time**: Approval decisions made within 24 hours
- **Accuracy**: <1% false positive rate for change detection

## Future Enhancements

1. **Integration with Cost Management**
   - Budget impact analysis
   - Cost forecasting based on pricing changes
   - Integration with cloud billing systems

2. **Advanced Analytics**
   - Pricing trend analysis
   - Provider cost comparison reports
   - ROI analysis for different models

3. **Automated Testing**
   - Automated testing of pricing changes in staging
   - A/B testing for cost optimization
   - Performance impact analysis

## Open Questions

1. **Approval Authority**: Who should have approval rights for different change magnitudes?
2. **Effective Dates**: Should approved changes take effect immediately or be scheduled?
3. **Rollback Window**: How long should approved changes be reversible?
4. **Integration Points**: Which external systems need pricing change notifications?
5. **Compliance Requirements**: What audit/compliance requirements need to be met?

---

**Status**: 📋 Backlog  
**Priority**: High  
**Effort**: 3-4 weeks  
**Dependencies**: Enhanced Provider Registry (completed)