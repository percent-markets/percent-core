import { IProposal } from '../types/proposal.interface';
import { IModerator } from '../types/moderator.interface';
import { ISchedulerService, IScheduledTask } from '../types/scheduler.interface';
import { HistoryService } from './history.service';
import { PersistenceService } from './persistence.service';
import { AMMState } from '../types/amm.interface';
import { Decimal } from 'decimal.js';

/**
 * Scheduler service for managing automatic TWAP cranking and proposal finalization
 * Handles periodic tasks for active proposals
 */
export class SchedulerService implements ISchedulerService {
  private tasks: Map<string, IScheduledTask> = new Map();
  private moderator: IModerator | null = null;
  private static instance: SchedulerService;

  private constructor() {}

  /**
   * Gets the singleton instance of the scheduler service
   */
  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  /**
   * Sets the moderator instance for accessing proposals
   * @param moderator - The moderator instance
   */
  setModerator(moderator: IModerator): void {
    this.moderator = moderator;
  }

  /**
   * Schedules automatic TWAP cranking for a proposal
   * @param proposalId - The proposal ID to crank TWAP for
   * @param intervalMs - Interval between cranks in milliseconds (default: 60000 = 1 minute)
   */
  scheduleTWAPCranking(proposalId: number, intervalMs: number = 60000): void {
    const taskId = `twap-${proposalId}`;
    
    if (this.tasks.has(taskId)) {
      console.log(`TWAP cranking already scheduled for proposal #${proposalId}`);
      return;
    }

    const task: IScheduledTask = {
      id: taskId,
      type: 'twap-crank',
      proposalId,
      interval: intervalMs,
      nextRunTime: Date.now() + intervalMs
    };

    // Start the periodic task
    task.timer = setInterval(async () => {
      await this.crankTWAPForProposal(proposalId);
    }, intervalMs);

    this.tasks.set(taskId, task);
    console.log(`Scheduled TWAP cranking for proposal #${proposalId} every ${intervalMs}ms`);
    
    // Also schedule price recording for this proposal
    this.schedulePriceRecording(proposalId, intervalMs);
  }
  
  /**
   * Schedules automatic price recording for a proposal
   * @param proposalId - The proposal ID to record prices for
   * @param intervalMs - Interval between recordings in milliseconds (default: 60000 = 1 minute)
   */
  schedulePriceRecording(proposalId: number, intervalMs: number = 60000): void {
    const taskId = `price-${proposalId}`;
    
    if (this.tasks.has(taskId)) {
      console.log(`Price recording already scheduled for proposal #${proposalId}`);
      return;
    }

    const task: IScheduledTask = {
      id: taskId,
      type: 'price-record',
      proposalId,
      interval: intervalMs,
      nextRunTime: Date.now() + intervalMs
    };

    // Start the periodic task
    task.timer = setInterval(async () => {
      await this.recordPricesForProposal(proposalId);
    }, intervalMs);

    this.tasks.set(taskId, task);
    console.log(`Scheduled price recording for proposal #${proposalId} every ${intervalMs}ms`);
  }

  /**
   * Schedules automatic finalization for a proposal
   * @param proposalId - The proposal ID to finalize
   * @param finalizeAt - Timestamp when to finalize the proposal
   */
  scheduleProposalFinalization(proposalId: number, finalizeAt: number): void {
    const taskId = `finalize-${proposalId}`;
    
    if (this.tasks.has(taskId)) {
      console.log(`Finalization already scheduled for proposal #${proposalId}`);
      return;
    }

    const delayMs = finalizeAt - Date.now();
    
    if (delayMs <= 0) {
      // Should finalize immediately
      this.finalizeProposal(proposalId);
      return;
    }

    const task: IScheduledTask = {
      id: taskId,
      type: 'proposal-finalize',
      proposalId,
      nextRunTime: finalizeAt
    };

    // Schedule one-time finalization
    task.timer = setTimeout(async () => {
      await this.finalizeProposal(proposalId);
      this.tasks.delete(taskId);
    }, delayMs);

    this.tasks.set(taskId, task);
    console.log(`Scheduled finalization for proposal #${proposalId} at ${new Date(finalizeAt).toISOString()}`);
  }

  /**
   * Cranks TWAP for a specific proposal
   * @param proposalId - The proposal ID
   */
  private async crankTWAPForProposal(proposalId: number): Promise<void> {
    if (!this.moderator) {
      throw new Error('Moderator not set in scheduler');
    }

    let proposal;
    try {
      proposal = await this.moderator.getProposal(proposalId);
    } catch (error) {
      console.error(`Failed to load proposal #${proposalId} for TWAP cranking:`, error);
      this.cancelTask(`twap-${proposalId}`);
      this.cancelTask(`price-${proposalId}`);
      this.cancelTask(`finalize-${proposalId}`);
      return; // Gracefully exit instead of throwing
    }
    
    if (!proposal) {
      console.warn(`Proposal #${proposalId} not found, cancelling TWAP cranking tasks`);
      this.cancelTask(`twap-${proposalId}`);
      this.cancelTask(`price-${proposalId}`);
      this.cancelTask(`finalize-${proposalId}`);
      return; // Gracefully exit instead of throwing
    }

    // Check if proposal has ended
    const now = Date.now();
    if (now >= proposal.finalizedAt) {
      console.log(`Proposal #${proposalId} has ended, stopping TWAP cranking`);
      this.cancelTask(`twap-${proposalId}`);
      this.cancelTask(`price-${proposalId}`);
      return;
    }

    // Get the TWAP oracle and crank it
    const twapOracle = proposal.twapOracle;
    await twapOracle.crankTWAP();
    console.log(`Cranked TWAP for proposal #${proposalId}`);
    
    // Record TWAP data to history
    const historyService = HistoryService.getInstance();
    const twapData = await twapOracle.fetchTWAP();
    
    await historyService.recordTWAP({
      proposalId,
      passTwap: new Decimal(twapData.passTwap.toString()),
      failTwap: new Decimal(twapData.failTwap.toString()),
      passAggregation: new Decimal(twapData.passAggregation.toString()),
      failAggregation: new Decimal(twapData.failAggregation.toString()),
    });
    
    // Save updated proposal state to database
    const persistenceService = PersistenceService.getInstance();
    await persistenceService.saveProposal(proposal);
    
    // Database is now the source of truth - no cache to invalidate
  }
  
  /**
   * Records prices for a specific proposal
   * @param proposalId - The proposal ID
   */
  private async recordPricesForProposal(proposalId: number): Promise<void> {
    if (!this.moderator) {
      throw new Error('Moderator not set in scheduler');
    }

    let proposal;
    try {
      proposal = await this.moderator.getProposal(proposalId);
    } catch (error) {
      console.error(`Failed to load proposal #${proposalId} for price recording:`, error);
      this.cancelTask(`twap-${proposalId}`);
      this.cancelTask(`price-${proposalId}`);
      this.cancelTask(`finalize-${proposalId}`);
      return; // Gracefully exit instead of throwing
    }
    
    if (!proposal) {
      console.warn(`Proposal #${proposalId} not found, cancelling price recording tasks`);
      this.cancelTask(`twap-${proposalId}`);
      this.cancelTask(`price-${proposalId}`);
      this.cancelTask(`finalize-${proposalId}`);
      return; // Gracefully exit instead of throwing
    }

    // Check if proposal has ended
    const now = Date.now();
    if (now >= proposal.finalizedAt) {
      console.log(`Proposal #${proposalId} has ended, stopping price recording`);
      this.cancelTask(`price-${proposalId}`);
      return;
    }

    const historyService = HistoryService.getInstance();
    const [pAMM, fAMM] = proposal.getAMMs();
    
    // Record pass market price if AMM is trading
    if (pAMM && pAMM.state === AMMState.Trading) {
      const passPrice = await pAMM.fetchPrice();
      await historyService.recordPrice({
        proposalId,
        market: 'pass',
        price: passPrice,
      });
    }
    
    // Record fail market price if AMM is trading
    if (fAMM && fAMM.state === AMMState.Trading) {
      const failPrice = await fAMM.fetchPrice();
      await historyService.recordPrice({
        proposalId,
        market: 'fail',
        price: failPrice,
      });
    }
    
    console.log(`Recorded prices for proposal #${proposalId}`);
  }

  /**
   * Finalizes a proposal
   * @param proposalId - The proposal ID
   */
  private async finalizeProposal(proposalId: number): Promise<void> {
    if (!this.moderator) {
      throw new Error('Moderator not set in scheduler');
    }

    console.log(`Auto-finalizing proposal #${proposalId}`);
    try {
      const status = await this.moderator.finalizeProposal(proposalId);
      console.log(`Proposal #${proposalId} finalized with status: ${status}`);
    } catch (error) {
      console.error(`Failed to finalize proposal #${proposalId}:`, error);
    }
    
    // Cancel TWAP cranking and price recording for this proposal regardless of finalization success
    this.cancelTask(`twap-${proposalId}`);
    this.cancelTask(`price-${proposalId}`);
    this.cancelTask(`finalize-${proposalId}`);
  }

  /**
   * Cancels a scheduled task
   * @param taskId - The task ID to cancel
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      if (task.timer) {
        if (task.type === 'twap-crank') {
          clearInterval(task.timer);
        } else {
          clearTimeout(task.timer);
        }
      }
      this.tasks.delete(taskId);
      console.log(`Cancelled task: ${taskId}`);
    }
  }

  /**
   * Cancels all tasks for a specific proposal
   * @param proposalId - The proposal ID
   */
  cancelProposalTasks(proposalId: number): void {
    this.cancelTask(`twap-${proposalId}`);
    this.cancelTask(`price-${proposalId}`);
    this.cancelTask(`finalize-${proposalId}`);
  }

  /**
   * Stops all scheduled tasks
   */
  stopAll(): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.timer) {
        if (task.type === 'twap-crank') {
          clearInterval(task.timer);
        } else {
          clearTimeout(task.timer);
        }
      }
    }
    this.tasks.clear();
    console.log('All scheduled tasks stopped');
  }

  /**
   * Gets information about all active tasks
   */
  getActiveTasks(): Array<{id: string; type: string; proposalId: number; nextRunTime: number}> {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      type: task.type,
      proposalId: task.proposalId,
      nextRunTime: task.nextRunTime
    }));
  }
}