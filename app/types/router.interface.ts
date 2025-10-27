import { Moderator } from '../moderator';
import { PublicKey, Keypair } from '@solana/web3.js';

/**
 * Router Service interface for managing multiple moderators
 */
export interface IRouterService {
  /**
   * Map of moderators by their ID
   */
  moderators: Map<number, Moderator>;

  /**
   * Load all moderators from the database
   */
  loadModerators(): Promise<void>;

  /**
   * Create a new moderator with unique ID
   * @param baseMint - Base token mint address
   * @param quoteMint - Quote token mint address
   * @param baseDecimals - Decimals for base token
   * @param quoteDecimals - Decimals for quote token
   * @param protocolName - Optional protocol name
   * @param authority - Optional authority keypair (loads from env if not provided)
   * @returns The newly created moderator and its assigned ID
   */
  createModerator(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    baseDecimals: number,
    quoteDecimals: number,
    protocolName?: string,
    authority?: Keypair
  ): Promise<{ moderator: Moderator; id: number }>;

  /**
   * Recover pending proposals for all moderators after server restart
   * Finalizes overdue proposals and reschedules tasks for active ones
   */
  recoverPendingProposals(): Promise<void>;

  /**
   * Get a moderator by ID
   * @param moderatorId - The ID of the moderator
   * @returns The moderator instance or null if not found
   */
  getModerator(moderatorId: number): Moderator | null;

  /**
   * Get all loaded moderators
   * @returns Map of all moderators keyed by ID
   */
  getAllModerators(): Map<number, Moderator>;

  /**
   * Refresh the router service by reloading all moderators from database
   * Clears current moderators and reloads them fresh
   */
  refresh(): Promise<void>;
}