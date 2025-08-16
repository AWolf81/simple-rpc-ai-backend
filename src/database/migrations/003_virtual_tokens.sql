-- Virtual Token Tracking Tables
-- Migration: 003_virtual_tokens.sql

-- User token accounts (RPC server is source of truth for balances)
CREATE TABLE IF NOT EXISTS user_token_accounts (
  user_id VARCHAR(255) PRIMARY KEY,     -- From JWT token (OpenSaaS user ID)
  email VARCHAR(255),                   -- Optional, from JWT
  virtual_token_balance BIGINT NOT NULL DEFAULT 0,    -- Available tokens (80% of purchased)
  total_tokens_purchased BIGINT NOT NULL DEFAULT 0,   -- Total ever purchased
  total_tokens_used BIGINT NOT NULL DEFAULT 0,        -- Total AI tokens consumed
  platform_fee_collected BIGINT NOT NULL DEFAULT 0,  -- 20% platform fees collected
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Detailed token usage log per AI request
CREATE TABLE IF NOT EXISTS token_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255),              -- For debugging/support
  provider VARCHAR(50) NOT NULL,        -- anthropic, openai, google
  model VARCHAR(100),                   -- claude-3-5-sonnet, gpt-4, etc
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,        -- Actual AI provider usage
  virtual_tokens_deducted INTEGER NOT NULL, -- What we charged user (includes 20% fee)
  platform_fee_tokens INTEGER NOT NULL,     -- 20% platform fee portion
  cost_per_1k_tokens DECIMAL(10,6),         -- For cost analysis
  method VARCHAR(100),                   -- executeAIRequest, etc
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_token_accounts(user_id) ON DELETE CASCADE
);

-- Token purchases/top-ups from LemonSqueezy webhooks
CREATE TABLE IF NOT EXISTS token_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  payment_id VARCHAR(255) UNIQUE,       -- LemonSqueezy order/payment ID
  variant_id VARCHAR(255),              -- LemonSqueezy product variant
  tokens_purchased BIGINT NOT NULL,     -- Raw tokens purchased
  usable_tokens BIGINT NOT NULL,        -- 80% after platform fee
  platform_fee_tokens BIGINT NOT NULL,  -- 20% platform fee
  amount_paid_cents INTEGER,            -- Actual payment in cents
  currency VARCHAR(10) DEFAULT 'USD',
  lemonsqueezy_data JSONB,              -- Full webhook payload for debugging
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_token_accounts(user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_usage_user_timestamp ON token_usage_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_provider ON token_usage_log(provider, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_token_topups_user ON token_topups(user_id, processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_topups_payment ON token_topups(payment_id);

-- Update trigger for user_token_accounts.updated_at
CREATE OR REPLACE FUNCTION update_token_account_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_token_account_timestamp
    BEFORE UPDATE ON user_token_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_token_account_timestamp();