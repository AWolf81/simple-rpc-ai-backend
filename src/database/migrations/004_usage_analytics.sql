-- Usage Analytics Migration
-- Adds tables for tracking usage across subscription and BYOK users

-- Usage analytics table (for all users)
CREATE TABLE IF NOT EXISTS usage_analytics (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('subscription', 'byok')),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd DECIMAL(10,6),
    request_id VARCHAR(255),
    method VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Purchase tracking table (for both subscription and one-time purchases)
CREATE TABLE IF NOT EXISTS user_purchases (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    payment_id VARCHAR(255) NOT NULL UNIQUE,
    purchase_type VARCHAR(50) NOT NULL CHECK (purchase_type IN ('subscription', 'one_time')),
    variant_id VARCHAR(255),
    quantity INTEGER, -- For one-time purchases (e.g., number of tokens)
    amount_paid_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lemonsqueezy_data JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_timestamp ON usage_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_timestamp ON usage_analytics(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_provider ON usage_analytics(provider);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_type ON usage_analytics(user_type);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_payment_id ON user_purchases(payment_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_processed_at ON user_purchases(processed_at);
CREATE INDEX IF NOT EXISTS idx_user_purchases_purchase_type ON user_purchases(purchase_type);