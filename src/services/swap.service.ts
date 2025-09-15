import { 
  PublicKey, 
  Transaction
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { ExecutionService } from '../../app/services/execution.service';
import { IExecutionConfig } from '../../app/types/execution.interface';
import { getModerator } from './moderator.service';

/**
 * Service for handling token swaps via Jupiter
 */
export class SwapService {
  private readonly jupiterSwapApi = 'https://lite-api.jup.ag/swap/v1';
  private readonly executionService: ExecutionService;
  
  constructor(executionConfig: IExecutionConfig) {
    this.executionService = new ExecutionService(executionConfig);
  }
  
  /**
   * Check if AMMs for a proposal are finalized
   */
  private async checkAMMsFinalized(proposalId: number): Promise<void> {
    const moderator = await getModerator();
    
    const proposal = await moderator.getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    
    const [pAMM, fAMM] = proposal.getAMMs();
    
    if (pAMM.isFinalized || fAMM.isFinalized) {
      throw new Error('Cannot swap on finalized AMMs');
    }
  }

  
  /**
   * Fetch quote from Jupiter
   */
  async fetchQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BN,
    slippageBps: number = 50
  ): Promise<any> {
    const quoteParams = new URLSearchParams({
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      amount: amount.toString(),
      slippageBps: slippageBps.toString()
    });
    
    const quoteResponse = await fetch(`${this.jupiterSwapApi}/quote?${quoteParams}`);
    
    if (!quoteResponse.ok) {
      const error = await quoteResponse.text();
      throw new Error(`Jupiter quote failed: ${error}`);
    }
    
    return await quoteResponse.json();
  }
  
  /**
   * Build a swap transaction using Jupiter
   * Returns both the transaction and the quote data
   */
  async buildSwapTx(
    proposalId: number,
    user: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BN,
    slippageBps: number = 50
  ): Promise<{ transaction: Transaction; quote: any }> {
    // Check AMMs are not finalized
    await this.checkAMMsFinalized(proposalId);
    
    return this.buildJupiterSwapTx(user, inputMint, outputMint, amount, slippageBps);
  }
  
  /**
   * Build Jupiter swap transaction
   * Returns both the transaction and the quote data
   */
  private async buildJupiterSwapTx(
    user: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BN,
    slippageBps: number
  ): Promise<{ transaction: Transaction; quote: any }> {
    try {
      // Get quote first
      const quoteData = await this.fetchQuote(inputMint, outputMint, amount, slippageBps);
      
      // Get swap transaction
      const swapResponse = await fetch(`${this.jupiterSwapApi}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: user.toString(),
          asLegacyTransaction: true
        })
      });
      
      if (!swapResponse.ok) {
        const error = await swapResponse.text();
        throw new Error(`Jupiter swap failed: ${error}`);
      }
      
      const swapData = await swapResponse.json() as { swapTransaction: string };
      
      // Deserialize transaction
      const transactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = Transaction.from(transactionBuf);
      
      // Add recent blockhash and fee payer
      const { blockhash } = await this.executionService.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = user;
      
      return { transaction, quote: quoteData };
      
    } catch (error) {
      console.error('Jupiter swap error:', error);
      throw error;
    }
  }
  
  /**
   * Execute a swap transaction
   * Delegates to execution service
   */
  async executeSwapTx(transaction: Transaction): Promise<string> {
    const result = await this.executionService.executeTx(transaction);
    
    if (result.status === 'failed') {
      throw new Error(`Swap execution failed: ${result.error}`);
    }
    
    return result.signature;
  }
}

// Singleton instance management
let instance: SwapService | null = null;

export function getSwapService(): SwapService {
  if (!instance) {
    // Initialize with config from environment
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const executionConfig: IExecutionConfig = {
      rpcEndpoint: rpcUrl,
      commitment: 'confirmed'
    };
    instance = new SwapService(executionConfig);
  }
  return instance;
}