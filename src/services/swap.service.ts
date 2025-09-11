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
  private readonly jupiterApi = 'https://lite-api.jup.ag/swap/v1';
  private readonly executionService: ExecutionService;
  
  constructor(executionConfig: IExecutionConfig) {
    this.executionService = new ExecutionService(executionConfig);
  }
  
  /**
   * Check if AMMs for a proposal are finalized
   */
  private checkAMMsFinalized(proposalId: number): void {
    const moderator = getModerator();
    
    if (proposalId < 0 || proposalId >= moderator.proposals.length) {
      throw new Error('Proposal not found');
    }
    
    const proposal = moderator.proposals[proposalId];
    const [pAMM, fAMM] = proposal.getAMMs();
    
    if (pAMM.isFinalized || fAMM.isFinalized) {
      throw new Error('Cannot swap on finalized AMMs');
    }
  }
  
  /**
   * Build a swap transaction using Jupiter
   */
  async buildSwapTx(
    proposalId: number,
    user: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BN,
    slippageBps: number = 50
  ): Promise<Transaction> {
    // Check AMMs are not finalized
    this.checkAMMsFinalized(proposalId);
    
    return this.buildJupiterSwapTx(user, inputMint, outputMint, amount, slippageBps);
  }
  
  /**
   * Build Jupiter swap transaction
   */
  private async buildJupiterSwapTx(
    user: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BN,
    slippageBps: number
  ): Promise<Transaction> {
    try {
      // Get quote first
      const quoteParams = new URLSearchParams({
        inputMint: inputMint.toString(),
        outputMint: outputMint.toString(),
        amount: amount.toString(),
        slippageBps: slippageBps.toString()
      });
      
      const quoteResponse = await fetch(`${this.jupiterApi}/quote?${quoteParams}`);
      
      if (!quoteResponse.ok) {
        const error = await quoteResponse.text();
        throw new Error(`Jupiter quote failed: ${error}`);
      }
      
      const quoteData = await quoteResponse.json();
      
      // Get swap transaction
      const swapResponse = await fetch(`${this.jupiterApi}/swap`, {
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
      
      return transaction;
      
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

export function getSwapService(executionConfig: IExecutionConfig): SwapService {
  if (!instance) {
    instance = new SwapService(executionConfig);
  }
  return instance;
}