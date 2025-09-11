import { getPool } from './database.service';
import { IPersistenceService, IProposalDB, IModeratorStateDB, ITransactionData } from '../types/persistence.interface';
import { IProposal, IProposalConfig } from '../types/proposal.interface';
import { IModeratorConfig } from '../types/moderator.interface';
import { AMMState } from '../types/amm.interface';
import { VaultState } from '../types/vault.interface';
import { Proposal } from '../proposal';
import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

// Type definitions based on database schema and private field access requirements
type ProposalPrivateAccess = {
  _status: string;
  config: {
    baseDecimals: number;
    quoteDecimals: number;
    authority: {
      publicKey: PublicKey;
    };
  };
};

type TWAPOraclePrivateAccess = {
  _passObservation: number;
  _failObservation: number;
  _passAggregation: number;
  _failAggregation: number;
  _lastUpdateTime: number;
};

type AMMPrivateAccess = {
  _state: AMMState;
};

type VaultPrivateAccess = {
  _state: VaultState;
  _escrow: PublicKey;
  _passConditionalMint: PublicKey;
  _failConditionalMint: PublicKey;
};

/**
 * Service for persisting and loading state from PostgreSQL database
 */
export class PersistenceService implements IPersistenceService {
  private static instance: PersistenceService | null = null;
  
  private constructor() {}
  
  public static getInstance(): PersistenceService {
    if (!PersistenceService.instance) {
      PersistenceService.instance = new PersistenceService();
    }
    return PersistenceService.instance;
  }
  
  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    try {
      const pool = getPool();
      const migrationPath = path.join(process.cwd(), 'migrations', '001_initial_schema.sql');
      
      if (fs.existsSync(migrationPath)) {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
        await pool.query(migrationSQL);
        console.log('Database migrations completed successfully');
      } else {
        console.warn('Migration file not found, skipping migrations');
      }
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }
  
  /**
   * Save a proposal to the database
   */
  async saveProposal(proposal: IProposal): Promise<void> {
    const pool = getPool();
    
    try {
      // Serialize AMM states
      const passAmmState = proposal.__pAMM ? {
        state: proposal.__pAMM.state,
        pool: proposal.__pAMM.pool?.toBase58(),
        position: proposal.__pAMM.position?.toBase58(),
        positionNft: proposal.__pAMM.positionNft?.toBase58(),
      } : null;
      
      const failAmmState = proposal.__fAMM ? {
        state: proposal.__fAMM.state,
        pool: proposal.__fAMM.pool?.toBase58(),
        position: proposal.__fAMM.position?.toBase58(),
        positionNft: proposal.__fAMM.positionNft?.toBase58(),
      } : null;
      
      // Serialize Vault states
      const baseVaultState = proposal.__baseVault ? {
        state: proposal.__baseVault.state,
        escrow: proposal.__baseVault.escrow.toBase58(),
        passConditionalMint: proposal.__baseVault.passConditionalMint.toBase58(),
        failConditionalMint: proposal.__baseVault.failConditionalMint.toBase58(),
      } : null;
      
      const quoteVaultState = proposal.__quoteVault ? {
        state: proposal.__quoteVault.state,
        escrow: proposal.__quoteVault.escrow.toBase58(),
        passConditionalMint: proposal.__quoteVault.passConditionalMint.toBase58(),
        failConditionalMint: proposal.__quoteVault.failConditionalMint.toBase58(),
      } : null;
      
      // Serialize TWAP Oracle state
      const twapOracleState = proposal.twapOracle ? {
        passObservation: (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._passObservation,
        failObservation: (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._failObservation,
        passAggregation: (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._passAggregation,
        failAggregation: (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._failAggregation,
        lastUpdateTime: (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._lastUpdateTime,
        initialTwapValue: proposal.twapOracle.initialTwapValue,
        twapMaxObservationChangePerUpdate: proposal.twapOracle.twapMaxObservationChangePerUpdate,
        twapStartDelay: proposal.twapOracle.twapStartDelay,
        passThresholdBps: proposal.twapOracle.passThresholdBps,
      } : null;
      
      // Serialize AMM config
      const ammConfig = proposal.ammConfig ? {
        initialBaseAmount: proposal.ammConfig.initialBaseAmount.toString(),
        initialQuoteAmount: proposal.ammConfig.initialQuoteAmount.toString(),
      } : null;
      
      // Serialize transaction instructions only (not the full transaction)
      // We store instructions because blockhashes expire and need to be refreshed at execution time
      const instructionsData: ITransactionData = {
        instructions: proposal.transaction.instructions.map(ix => ({
          programId: ix.programId.toBase58(),
          keys: ix.keys.map(key => ({
            pubkey: key.pubkey.toBase58(),
            isSigner: key.isSigner,
            isWritable: key.isWritable
          })),
          data: Buffer.from(ix.data).toString('base64')
        })),
        feePayer: proposal.transaction.feePayer?.toBase58() || null
      };
      const transactionData = JSON.stringify(instructionsData);
      
      const query = `
        INSERT INTO proposals (
          id, description, status, created_at, finalized_at, proposal_length,
          transaction_data, base_mint, quote_mint, base_decimals, quote_decimals,
          authority, amm_config, pass_amm_state, fail_amm_state,
          base_vault_state, quote_vault_state, twap_oracle_state
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          pass_amm_state = EXCLUDED.pass_amm_state,
          fail_amm_state = EXCLUDED.fail_amm_state,
          base_vault_state = EXCLUDED.base_vault_state,
          quote_vault_state = EXCLUDED.quote_vault_state,
          twap_oracle_state = EXCLUDED.twap_oracle_state,
          updated_at = NOW()
      `;
      
      await pool.query(query, [
        proposal.id,
        proposal.description,
        proposal.status,
        new Date(proposal.createdAt),
        new Date(proposal.finalizedAt),
        proposal.proposalLength.toString(),
        transactionData,
        proposal.baseMint.toBase58(),
        proposal.quoteMint.toBase58(),
        (proposal as unknown as ProposalPrivateAccess).config.baseDecimals,
        (proposal as unknown as ProposalPrivateAccess).config.quoteDecimals,
        (proposal as unknown as ProposalPrivateAccess).config.authority.publicKey.toBase58(),
        JSON.stringify(ammConfig),
        JSON.stringify(passAmmState),
        JSON.stringify(failAmmState),
        JSON.stringify(baseVaultState),
        JSON.stringify(quoteVaultState),
        JSON.stringify(twapOracleState)
      ]);
    } catch (error) {
      console.error('Failed to save proposal:', error);
      throw error;
    }
  }
  
  /**
   * Load a proposal from the database
   */
  async loadProposal(id: number): Promise<IProposal | null> {
    const pool = getPool();
    
    try {
      const result = await pool.query<IProposalDB>(
        'SELECT * FROM proposals WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return this.reconstructProposal(row);
    } catch (error) {
      console.error('Failed to load proposal:', error);
      throw error;
    }
  }
  
  /**
   * Load all proposals from the database
   */
  async loadAllProposals(): Promise<IProposal[]> {
    const pool = getPool();
    
    try {
      const result = await pool.query<IProposalDB>(
        'SELECT * FROM proposals ORDER BY id'
      );
      
      const proposals: IProposal[] = [];
      for (const row of result.rows) {
        const proposal = await this.reconstructProposal(row);
        if (proposal) {
          proposals.push(proposal);
        }
      }
      
      return proposals;
    } catch (error) {
      console.error('Failed to load proposals:', error);
      throw error;
    }
  }
  
  /**
   * Get proposals for frontend (simplified data)
   */
  async getProposalsForFrontend(): Promise<IProposalDB[]> {
    const pool = getPool();
    
    try {
      const result = await pool.query<IProposalDB>(
        'SELECT * FROM proposals ORDER BY created_at DESC'
      );
      
      return result.rows;
    } catch (error) {
      console.error('Failed to get proposals for frontend:', error);
      throw error;
    }
  }
  
  /**
   * Get a single proposal for frontend
   */
  async getProposalForFrontend(id: number): Promise<IProposalDB | null> {
    const pool = getPool();
    
    try {
      const result = await pool.query<IProposalDB>(
        'SELECT * FROM proposals WHERE id = $1',
        [id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Failed to get proposal for frontend:', error);
      throw error;
    }
  }
  
  /**
   * Save moderator state to the database
   */
  async saveModeratorState(proposalCounter: number, config: IModeratorConfig): Promise<void> {
    const pool = getPool();
    
    try {
      const configData = {
        baseMint: config.baseMint.toBase58(),
        quoteMint: config.quoteMint.toBase58(),
        baseDecimals: config.baseDecimals,
        quoteDecimals: config.quoteDecimals,
        authority: config.authority.publicKey.toBase58(),
        rpcUrl: config.connection.rpcEndpoint,
      };
      
      const query = `
        INSERT INTO moderator_state (id, proposal_id_counter, config)
        VALUES (1, $1, $2)
        ON CONFLICT (id) DO UPDATE SET
          proposal_id_counter = EXCLUDED.proposal_id_counter,
          config = EXCLUDED.config,
          updated_at = NOW()
      `;
      
      await pool.query(query, [proposalCounter, JSON.stringify(configData)]);
    } catch (error) {
      console.error('Failed to save moderator state:', error);
      throw error;
    }
  }
  
  /**
   * Load moderator state from the database
   */
  async loadModeratorState(): Promise<{ proposalCounter: number; config: IModeratorConfig } | null> {
    const pool = getPool();
    
    try {
      const result = await pool.query<IModeratorStateDB>(
        'SELECT * FROM moderator_state WHERE id = 1'
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      // Load authority keypair - use test authority if in test mode
      let authority: Keypair;
      
      // Check if we're in test mode by checking if test moderator service is available
      try {
        const TestModeratorService = (await import('../../src/test/test-moderator.service')).default;
        const testInfo = TestModeratorService.getTestInfo();
        
        if (testInfo) {
          // We're in test mode - use the test authority that was used to create the mints
          const { getTestModeConfig } = await import('../../src/test/config');
          const testConfig = getTestModeConfig();
          authority = testConfig.wallets.authority;
        } else {
          throw new Error('Not in test mode');
        }
      } catch {
        // We're in production mode - load from filesystem
        const keypairPath = process.env.SOLANA_KEYPAIR_PATH || './wallet.json';
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
        authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
      }
      
      const config: IModeratorConfig = {
        baseMint: new PublicKey(row.config.baseMint),
        quoteMint: new PublicKey(row.config.quoteMint),
        baseDecimals: row.config.baseDecimals,
        quoteDecimals: row.config.quoteDecimals,
        authority,
        connection: new Connection(row.config.rpcUrl, 'confirmed'),
      };
      
      return {
        proposalCounter: row.proposal_id_counter,
        config,
      };
    } catch (error) {
      console.error('Failed to load moderator state:', error);
      return null;
    }
  }
  
  /**
   * Helper method to reconstruct a Proposal object from database row
   */
  private async reconstructProposal(row: IProposalDB): Promise<IProposal | null> {
    try {
      // Load authority keypair - use test authority if in test mode
      let authority: Keypair;
      
      // Check if we're in test mode by checking if test moderator service is available
      try {
        const TestModeratorService = (await import('../../src/test/test-moderator.service')).default;
        const testInfo = TestModeratorService.getTestInfo();
        
        if (testInfo) {
          // We're in test mode - use the test authority that was used to create the mints
          const { getTestModeConfig } = await import('../../src/test/config');
          const testConfig = getTestModeConfig();
          authority = testConfig.wallets.authority;
          console.log(`Using test authority for proposal reconstruction: ${authority.publicKey.toBase58()}`);
        } else {
          throw new Error('Not in test mode');
        }
      } catch {
        // We're in production mode - load from filesystem
        const keypairPath = process.env.SOLANA_KEYPAIR_PATH || './wallet.json';
        let keypairData;
        try {
          const fileContent = fs.readFileSync(keypairPath, 'utf-8');
          keypairData = JSON.parse(fileContent);
        } catch (fileError) {
          throw new Error(`Failed to load authority keypair from ${keypairPath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }
        
        try {
          authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
        } catch (keypairError) {
          throw new Error(`Failed to create keypair from data in ${keypairPath}: ${keypairError instanceof Error ? keypairError.message : String(keypairError)}`);
        }
      }
      
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      
      // Reconstruct transaction from stored instructions
      // Handle both string and already-parsed object cases
      let instructionsData: ITransactionData;
      if (typeof row.transaction_data === 'string') {
        try {
          instructionsData = JSON.parse(row.transaction_data);
        } catch (error) {
          throw new Error(`Failed to parse transaction data for proposal ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        instructionsData = row.transaction_data as ITransactionData;
      }
      
      const transaction = new Transaction();
      
      // Reconstruct instructions
      for (const ixData of instructionsData.instructions) {
        transaction.add({
          programId: new PublicKey(ixData.programId),
          keys: ixData.keys.map((key) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable
          })),
          data: Buffer.from(ixData.data, 'base64')
        });
      }
      
      // Set fee payer if it was stored
      if (instructionsData.feePayer) {
        transaction.feePayer = new PublicKey(instructionsData.feePayer);
      }
      
      // Reconstruct proposal config
      const config: IProposalConfig = {
        id: row.id,
        description: row.description,
        transaction: transaction,
        createdAt: new Date(row.created_at).getTime(),
        proposalLength: parseInt(row.proposal_length),
        baseMint: new PublicKey(row.base_mint),
        quoteMint: new PublicKey(row.quote_mint),
        baseDecimals: row.base_decimals,
        quoteDecimals: row.quote_decimals,
        authority,
        connection,
        twap: row.twap_oracle_state ? {
          initialTwapValue: row.twap_oracle_state.initialTwapValue,
          twapMaxObservationChangePerUpdate: row.twap_oracle_state.twapMaxObservationChangePerUpdate,
          twapStartDelay: row.twap_oracle_state.twapStartDelay,
          passThresholdBps: row.twap_oracle_state.passThresholdBps,
          minUpdateInterval: 60000, // 1 minute default
        } : {
          initialTwapValue: 0.5,
          twapMaxObservationChangePerUpdate: 0.1,
          twapStartDelay: 60000,
          passThresholdBps: 5000,
          minUpdateInterval: 60000, // 1 minute default
        },
        ammConfig: row.amm_config ? {
          initialBaseAmount: new BN(row.amm_config.initialBaseAmount),
          initialQuoteAmount: new BN(row.amm_config.initialQuoteAmount),
        } : {
          initialBaseAmount: new BN(0),
          initialQuoteAmount: new BN(0),
        },
      };
      
      // Create proposal instance
      const proposal = new Proposal(config);
      
      // Restore status
      (proposal as unknown as ProposalPrivateAccess)._status = row.status;
      
      // Only initialize blockchain components if the proposal isn't in Uninitialized state
      if (row.status !== 'Uninitialized') {
        // Manually create and restore AMMs since we can't call initialize() on already-persisted proposals
        const { AMM } = await import('../amm');
        const { Vault } = await import('../vault');
        const { VaultType } = await import('../types/vault.interface');
        
        // Create execution config for AMMs
        const executionConfig = {
          rpcEndpoint: connection.rpcEndpoint,
          commitment: 'confirmed' as const,
          maxRetries: 3,
          skipPreflight: false
        };
        
        // Create base and quote vaults
        const baseVault = new Vault({
          proposalId: row.id,
          vaultType: VaultType.Base,
          regularMint: new PublicKey(row.base_mint),
          decimals: row.base_decimals,
          connection: connection,
          authority: authority
        });
        
        const quoteVault = new Vault({
          proposalId: row.id,
          vaultType: VaultType.Quote,
          regularMint: new PublicKey(row.quote_mint),
          decimals: row.quote_decimals,
          connection: connection,
          authority: authority
        });
        
        // Set the vaults on the proposal
        proposal.__baseVault = baseVault;
        proposal.__quoteVault = quoteVault;
        
        // Restore Vault states first so we can access the conditional mints
        if (row.base_vault_state) {
          (baseVault as unknown as VaultPrivateAccess)._state = row.base_vault_state.state;
          (baseVault as unknown as VaultPrivateAccess)._escrow = new PublicKey(row.base_vault_state.escrow);
          (baseVault as unknown as VaultPrivateAccess)._passConditionalMint = new PublicKey(row.base_vault_state.passConditionalMint);
          (baseVault as unknown as VaultPrivateAccess)._failConditionalMint = new PublicKey(row.base_vault_state.failConditionalMint);
        }
        
        if (row.quote_vault_state) {
          (quoteVault as unknown as VaultPrivateAccess)._state = row.quote_vault_state.state;
          (quoteVault as unknown as VaultPrivateAccess)._escrow = new PublicKey(row.quote_vault_state.escrow);
          (quoteVault as unknown as VaultPrivateAccess)._passConditionalMint = new PublicKey(row.quote_vault_state.passConditionalMint);
          (quoteVault as unknown as VaultPrivateAccess)._failConditionalMint = new PublicKey(row.quote_vault_state.failConditionalMint);
        }
        
        // Create AMMs using the conditional token mints from vaults
        const pAMM = new AMM(
          baseVault.passConditionalMint,
          quoteVault.passConditionalMint,
          row.base_decimals,
          row.quote_decimals,
          authority,
          executionConfig
        );
        
        const fAMM = new AMM(
          baseVault.failConditionalMint,
          quoteVault.failConditionalMint,
          row.base_decimals,
          row.quote_decimals,
          authority,
          executionConfig
        );
        
        // Set the AMMs on the proposal
        proposal.__pAMM = pAMM;
        proposal.__fAMM = fAMM;
        
        // Set AMMs in TWAP oracle so it can track prices
        proposal.twapOracle.setAMMs(pAMM, fAMM);
        
        // Restore AMM states if they exist
        if (row.pass_amm_state) {
          if (row.pass_amm_state.pool) {
            pAMM.pool = new PublicKey(row.pass_amm_state.pool);
          }
          if (row.pass_amm_state.position) {
            pAMM.position = new PublicKey(row.pass_amm_state.position);
          }
          if (row.pass_amm_state.positionNft) {
            pAMM.positionNft = new PublicKey(row.pass_amm_state.positionNft);
          }
          (pAMM as unknown as AMMPrivateAccess)._state = row.pass_amm_state.state;
        }
        
        if (row.fail_amm_state) {
          if (row.fail_amm_state.pool) {
            fAMM.pool = new PublicKey(row.fail_amm_state.pool);
          }
          if (row.fail_amm_state.position) {
            fAMM.position = new PublicKey(row.fail_amm_state.position);
          }
          if (row.fail_amm_state.positionNft) {
            fAMM.positionNft = new PublicKey(row.fail_amm_state.positionNft);
          }
          (fAMM as unknown as AMMPrivateAccess)._state = row.fail_amm_state.state;
        }
      }
      
      // Restore TWAP Oracle state if exists
      if (row.twap_oracle_state && proposal.twapOracle) {
        (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._passObservation = row.twap_oracle_state.passObservation;
        (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._failObservation = row.twap_oracle_state.failObservation;
        (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._passAggregation = row.twap_oracle_state.passAggregation;
        (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._failAggregation = row.twap_oracle_state.failAggregation;
        (proposal.twapOracle as unknown as TWAPOraclePrivateAccess)._lastUpdateTime = row.twap_oracle_state.lastUpdateTime;
      }
      
      return proposal;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to reconstruct proposal #${row.id}:`, {
        proposalId: row.id,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to reconstruct proposal #${row.id}: ${errorMessage}`);
    }
  }
}