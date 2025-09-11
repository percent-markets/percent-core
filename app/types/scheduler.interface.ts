import { IModerator } from './moderator.interface';

export interface IScheduledTask {
  id: string;
  type: 'twap-crank' | 'proposal-finalize' | 'price-record';
  proposalId: number;
  interval?: number;
  nextRunTime: number;
  timer?: NodeJS.Timeout;
}

export interface ISchedulerService {
  /**
   * Sets the moderator instance for accessing proposals
   * @param moderator - The moderator instance
   */
  setModerator(moderator: IModerator): void;

  /**
   * Schedules automatic TWAP cranking for a proposal
   * @param proposalId - The proposal ID to crank TWAP for
   * @param intervalMs - Interval between cranks in milliseconds (default: 60000 = 1 minute)
   */
  scheduleTWAPCranking(proposalId: number, intervalMs?: number): void;

  /**
   * Schedules automatic finalization for a proposal
   * @param proposalId - The proposal ID to finalize
   * @param finalizeAt - Timestamp when to finalize the proposal
   */
  scheduleProposalFinalization(proposalId: number, finalizeAt: number): void;

  /**
   * Cancels a scheduled task
   * @param taskId - The task ID to cancel
   */
  cancelTask(taskId: string): void;

  /**
   * Cancels all tasks for a specific proposal
   * @param proposalId - The proposal ID
   */
  cancelProposalTasks(proposalId: number): void;

  /**
   * Stops all scheduled tasks
   */
  stopAll(): void;

  /**
   * Gets information about all active tasks
   */
  getActiveTasks(): Array<{
    id: string;
    type: string;
    proposalId: number;
    nextRunTime: number;
  }>;
}