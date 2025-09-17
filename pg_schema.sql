-- Create proposals table for storing all proposal data
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  proposal_length BIGINT NOT NULL,
  transaction_data JSONB NOT NULL,
  
  -- Token configuration
  base_mint VARCHAR(64) NOT NULL,
  quote_mint VARCHAR(64) NOT NULL,
  base_decimals INTEGER NOT NULL,
  quote_decimals INTEGER NOT NULL,
  authority VARCHAR(64) NOT NULL,
  
  -- AMM configuration
  amm_config JSONB,
  
  -- AMM states
  pass_amm_state JSONB,
  fail_amm_state JSONB,
  
  -- Vault states
  base_vault_state JSONB,
  quote_vault_state JSONB,
  
  -- TWAP Oracle state
  twap_oracle_state JSONB,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- Create moderator state table for server restarts
CREATE TABLE IF NOT EXISTS moderator_state (
  id SERIAL PRIMARY KEY,
  proposal_id_counter INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one moderator state row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_moderator_state_single ON moderator_state((id = 1));

-- Create price history table for charting
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  market VARCHAR(4) NOT NULL CHECK (market IN ('pass', 'fail')),
  price DECIMAL(20, 10) NOT NULL,
  base_liquidity DECIMAL(20, 10),
  quote_liquidity DECIMAL(20, 10)
);

-- Create indexes for price history queries
CREATE INDEX IF NOT EXISTS idx_price_history_proposal_timestamp 
  ON price_history(proposal_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp 
  ON price_history(timestamp DESC);

-- Create TWAP history table
CREATE TABLE IF NOT EXISTS twap_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  pass_twap DECIMAL(20, 10) NOT NULL,
  fail_twap DECIMAL(20, 10) NOT NULL,
  pass_aggregation DECIMAL(20, 10) NOT NULL,
  fail_aggregation DECIMAL(20, 10) NOT NULL
);

-- Create indexes for TWAP history queries
CREATE INDEX IF NOT EXISTS idx_twap_history_proposal_timestamp 
  ON twap_history(proposal_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_twap_history_timestamp 
  ON twap_history(timestamp DESC);

-- Create trade history table
CREATE TABLE IF NOT EXISTS trade_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  market VARCHAR(4) NOT NULL CHECK (market IN ('pass', 'fail')),
  user_address VARCHAR(64) NOT NULL,
  is_base_to_quote BOOLEAN NOT NULL,
  amount_in DECIMAL(20, 10) NOT NULL,
  amount_out DECIMAL(20, 10) NOT NULL,
  price DECIMAL(20, 10) NOT NULL,
  tx_signature VARCHAR(128)
);

-- Create indexes for trade history queries
CREATE INDEX IF NOT EXISTS idx_trade_history_proposal_timestamp 
  ON trade_history(proposal_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trade_history_user 
  ON trade_history(user_address);
CREATE INDEX IF NOT EXISTS idx_trade_history_timestamp 
  ON trade_history(timestamp DESC);

-- Add update trigger for proposals updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_proposals_updated_at 
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moderator_state_updated_at 
  BEFORE UPDATE ON moderator_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();