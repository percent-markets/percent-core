-- Multi-moderator schema with i_ prefix

-- Moderators table
CREATE TABLE IF NOT EXISTS i_moderators (
  id SERIAL PRIMARY KEY,
  proposal_id_counter INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL,
  protocol_name VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposals table
CREATE TABLE IF NOT EXISTS i_proposals (
  id SERIAL PRIMARY KEY,
  moderator_id INTEGER NOT NULL,
  proposal_id INTEGER NOT NULL,
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  proposal_length BIGINT NOT NULL,

  transaction_instructions JSONB NOT NULL,
  transaction_fee_payer VARCHAR(64),

  base_mint VARCHAR(64) NOT NULL,
  quote_mint VARCHAR(64) NOT NULL,
  base_decimals INTEGER NOT NULL,
  quote_decimals INTEGER NOT NULL,

  amm_config JSONB NOT NULL,
  twap_config JSONB NOT NULL,

  pass_amm_data JSONB,
  fail_amm_data JSONB,
  base_vault_data JSONB,
  quote_vault_data JSONB,
  twap_oracle_data JSONB,

  spot_pool_address VARCHAR(64),
  total_supply BIGINT NOT NULL DEFAULT 1000000000,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_i_moderator_proposal UNIQUE (moderator_id, proposal_id),
  CONSTRAINT fk_i_proposals_moderator FOREIGN KEY (moderator_id)
    REFERENCES i_moderators(id) ON DELETE CASCADE
);

-- Indexes for proposals
CREATE INDEX IF NOT EXISTS idx_i_proposals_moderator_status ON i_proposals(moderator_id, status);
CREATE INDEX IF NOT EXISTS idx_i_proposals_moderator_created ON i_proposals(moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_i_proposals_moderator_proposal ON i_proposals(moderator_id, proposal_id);

-- Price history table
CREATE TABLE IF NOT EXISTS i_price_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderator_id INTEGER NOT NULL,
  proposal_id INTEGER NOT NULL,
  market VARCHAR(4) NOT NULL CHECK (market IN ('pass', 'fail', 'spot')),
  price DECIMAL(20, 10) NOT NULL,

  CONSTRAINT fk_i_price_history_moderator FOREIGN KEY (moderator_id)
    REFERENCES i_moderators(id) ON DELETE CASCADE,
  CONSTRAINT fk_i_price_history_proposal FOREIGN KEY (moderator_id, proposal_id)
    REFERENCES i_proposals(moderator_id, proposal_id) ON DELETE CASCADE
);

-- Index for price history
CREATE INDEX IF NOT EXISTS idx_i_price_history_moderator_proposal_timestamp
  ON i_price_history(moderator_id, proposal_id, timestamp DESC);

-- TWAP history table
CREATE TABLE IF NOT EXISTS i_twap_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderator_id INTEGER NOT NULL,
  proposal_id INTEGER NOT NULL,
  pass_twap DECIMAL(20, 10) NOT NULL,
  fail_twap DECIMAL(20, 10) NOT NULL,
  pass_aggregation DECIMAL(20, 10) NOT NULL,
  fail_aggregation DECIMAL(20, 10) NOT NULL,

  CONSTRAINT fk_i_twap_history_moderator FOREIGN KEY (moderator_id)
    REFERENCES i_moderators(id) ON DELETE CASCADE,
  CONSTRAINT fk_i_twap_history_proposal FOREIGN KEY (moderator_id, proposal_id)
    REFERENCES i_proposals(moderator_id, proposal_id) ON DELETE CASCADE
);

-- Index for TWAP history
CREATE INDEX IF NOT EXISTS idx_i_twap_history_moderator_proposal_timestamp
  ON i_twap_history(moderator_id, proposal_id, timestamp DESC);

-- Trade history table
CREATE TABLE IF NOT EXISTS i_trade_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderator_id INTEGER NOT NULL,
  proposal_id INTEGER NOT NULL,
  market VARCHAR(4) NOT NULL CHECK (market IN ('pass', 'fail')),
  user_address VARCHAR(64) NOT NULL,
  is_base_to_quote BOOLEAN NOT NULL,
  amount_in DECIMAL(20, 10) NOT NULL,
  amount_out DECIMAL(20, 10) NOT NULL,
  price DECIMAL(20, 10) NOT NULL,
  tx_signature VARCHAR(128),

  CONSTRAINT fk_i_trade_history_moderator FOREIGN KEY (moderator_id)
    REFERENCES i_moderators(id) ON DELETE CASCADE,
  CONSTRAINT fk_i_trade_history_proposal FOREIGN KEY (moderator_id, proposal_id)
    REFERENCES i_proposals(moderator_id, proposal_id) ON DELETE CASCADE
);

-- Index for trade history
CREATE INDEX IF NOT EXISTS idx_i_trade_history_moderator_proposal_timestamp
  ON i_trade_history(moderator_id, proposal_id, timestamp DESC);

-- Update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update triggers
CREATE TRIGGER update_i_proposals_updated_at
  BEFORE UPDATE ON i_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_i_moderators_updated_at
  BEFORE UPDATE ON i_moderators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- WebSocket notification for prices
CREATE OR REPLACE FUNCTION notify_i_new_price()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('i_new_price', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER i_price_notification_trigger
  AFTER INSERT ON i_price_history
  FOR EACH ROW
  EXECUTE FUNCTION notify_i_new_price();

-- WebSocket notification for trades
CREATE OR REPLACE FUNCTION notify_i_new_trade()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('i_new_trade', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER i_trade_notification_trigger
  AFTER INSERT ON i_trade_history
  FOR EACH ROW
  EXECUTE FUNCTION notify_i_new_trade();