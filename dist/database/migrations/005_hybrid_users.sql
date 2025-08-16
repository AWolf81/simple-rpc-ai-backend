-- Hybrid Users Migration
-- Supports users with multiple payment methods (subscription + one-time + BYOK)

-- User profiles table to track all user capabilities and preferences
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255),
    
    -- Capabilities (what the user has access to)
    has_subscription BOOLEAN DEFAULT FALSE,
    has_one_time_purchases BOOLEAN DEFAULT FALSE,
    has_byok_configured BOOLEAN DEFAULT FALSE,
    
    -- Token consumption preferences (order of preference)
    consumption_order JSONB DEFAULT '["subscription", "one_time", "byok"]'::jsonb,
    
    -- BYOK configuration
    byok_enabled BOOLEAN DEFAULT FALSE,
    byok_providers JSONB DEFAULT '{}'::jsonb, -- { "anthropic": { "enabled": true }, "openai": { "enabled": false } }
    
    -- Notifications preferences
    notify_token_low_threshold INTEGER DEFAULT 1000,
    notify_fallback_to_byok BOOLEAN DEFAULT TRUE,
    notify_one_time_consumed BOOLEAN DEFAULT TRUE,
    
    -- Subscription info
    subscription_tier VARCHAR(100),
    subscription_status VARCHAR(50), -- active, cancelled, expired
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Separate token accounts for different types
CREATE TABLE IF NOT EXISTS user_token_balances (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES user_profiles(user_id),
    balance_type VARCHAR(50) NOT NULL CHECK (balance_type IN ('subscription', 'one_time')),
    
    -- Token balance info
    virtual_token_balance BIGINT NOT NULL DEFAULT 0,
    total_tokens_purchased BIGINT NOT NULL DEFAULT 0,
    total_tokens_used BIGINT NOT NULL DEFAULT 0,
    platform_fee_collected BIGINT NOT NULL DEFAULT 0,
    
    -- Source tracking
    purchase_source VARCHAR(100), -- 'monthly_subscription', 'token_pack_100k', etc.
    purchase_date TIMESTAMP,
    expiry_date TIMESTAMP, -- For one-time purchases that might expire
    
    -- Priority for consumption (lower number = higher priority)
    consumption_priority INTEGER DEFAULT 100,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, balance_type, purchase_source)
);

-- Enhanced usage log to track which balance type was used
ALTER TABLE usage_analytics ADD COLUMN IF NOT EXISTS balance_type_used VARCHAR(50);
ALTER TABLE usage_analytics ADD COLUMN IF NOT EXISTS fallback_reason VARCHAR(200);
ALTER TABLE usage_analytics ADD COLUMN IF NOT EXISTS user_notified BOOLEAN DEFAULT FALSE;

-- Enhanced purchase tracking with more details
ALTER TABLE user_purchases ADD COLUMN IF NOT EXISTS purchase_category VARCHAR(50) DEFAULT 'tokens';
ALTER TABLE user_purchases ADD COLUMN IF NOT EXISTS token_quantity BIGINT;
ALTER TABLE user_purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE user_purchases ADD COLUMN IF NOT EXISTS consumption_priority INTEGER DEFAULT 100;

-- Token consumption log for detailed tracking
CREATE TABLE IF NOT EXISTS token_consumption_log (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    request_id VARCHAR(255),
    
    -- Consumption details
    total_tokens_needed INTEGER NOT NULL,
    consumption_plan JSONB NOT NULL, -- [{"type": "subscription", "tokens": 500}, {"type": "byok", "tokens": 500}]
    actual_consumption JSONB NOT NULL, -- What actually happened
    
    -- Notifications sent
    notifications_sent JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_capabilities ON user_profiles(has_subscription, has_one_time_purchases, has_byok_configured);

CREATE INDEX IF NOT EXISTS idx_user_token_balances_user_id ON user_token_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_balances_type ON user_token_balances(user_id, balance_type);
CREATE INDEX IF NOT EXISTS idx_user_token_balances_priority ON user_token_balances(user_id, consumption_priority);

CREATE INDEX IF NOT EXISTS idx_token_consumption_log_user_id ON token_consumption_log(user_id);
CREATE INDEX IF NOT EXISTS idx_token_consumption_log_request_id ON token_consumption_log(request_id);

-- Update existing data to use new schema (migration script)
-- Insert profiles for existing users
INSERT INTO user_profiles (user_id, email, has_subscription, created_at)
SELECT user_id, email, TRUE, created_at 
FROM user_token_accounts 
ON CONFLICT (user_id) DO UPDATE SET 
    has_subscription = TRUE,
    updated_at = CURRENT_TIMESTAMP;

-- Migrate existing token balances
INSERT INTO user_token_balances (id, user_id, balance_type, virtual_token_balance, total_tokens_purchased, total_tokens_used, platform_fee_collected, purchase_source, created_at)
SELECT 
    gen_random_uuid()::text,
    user_id, 
    'subscription',
    virtual_token_balance,
    total_tokens_purchased,
    total_tokens_used,
    platform_fee_collected,
    'legacy_subscription',
    created_at
FROM user_token_accounts
ON CONFLICT DO NOTHING;

-- Update profiles for users with purchases
UPDATE user_profiles 
SET 
    has_one_time_purchases = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id IN (
    SELECT DISTINCT user_id 
    FROM user_purchases 
    WHERE purchase_type = 'one_time'
);