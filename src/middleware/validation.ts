import { Request, Response, NextFunction } from 'express';
import { RouterService } from '../../app/services/router.service';
import { Moderator } from '../../app/moderator';
import { LoggerService } from '../../app/services/logger.service';

const logger = new LoggerService('api');

// Extend Express Request type to include moderatorId and proposalId
declare global {
  namespace Express {
    interface Request {
      moderatorId: number;
      proposalId?: number;
    }
  }
}

/**
 * Middleware that validates and attaches moderatorId to the request
 * Defaults to moderator ID 1 if not specified
 */
export const attachModerator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract moderatorId from query params, default to 1
    const moderatorId = req.query.moderatorId
      ? parseInt(req.query.moderatorId as string)
      : 1;

    // Validate moderatorId is a valid number
    if (isNaN(moderatorId) || moderatorId < 0) {
      logger.warn(`[${req.method} ${req.path}] Invalid moderatorId provided`, {
        providedId: req.query.moderatorId
      });
      res.status(400).json({ error: 'Invalid moderatorId format' });
      return;
    }

    // Verify the moderator exists
    const router = RouterService.getInstance();
    const moderator = router.getModerator(moderatorId);

    if (!moderator) {
      logger.warn(`[${req.method} ${req.path}] Moderator not found`, {
        moderatorId
      });
      res.status(404).json({ error: `Moderator ${moderatorId} not found` });
      return;
    }

    // Log if using default moderator
    if (!req.query.moderatorId) {
      logger.debug(`[${req.method} ${req.path}] Using default moderator`, {
        moderatorId: 1
      });
    }

    // Attach the moderatorId to the request
    req.moderatorId = moderatorId;

    next();
  } catch (error) {
    logger.error(`[${req.method} ${req.path}] Error in moderator middleware`, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ error: 'Failed to resolve moderator' });
  }
};

/**
 * Middleware that requires an explicit moderatorId (no default)
 * Used for critical operations like creating proposals or financial transactions
 */
export const requireModeratorId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.query.moderatorId) {
    logger.warn(`[${req.method} ${req.path}] moderatorId required but not provided`);
    res.status(400).json({
      error: 'moderatorId query parameter is required for this operation',
      example: `${req.path}?moderatorId=1`
    });
    return;
  }

  // Delegate to attachModerator for actual resolution
  await attachModerator(req, res, next);
};

/**
 * Middleware that requires and validates proposalId from route params
 * No fallback - always requires a valid proposalId
 * Used for routes with :id parameter that represent proposal IDs
 */
export const requireProposalId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const proposalId = parseInt(req.params.id);

    // Validate proposalId
    if (isNaN(proposalId) || proposalId < 0) {
      logger.warn(`[${req.method} ${req.path}] Invalid proposalId`, {
        providedId: req.params.id
      });
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    // Attach the proposalId to the request
    req.proposalId = proposalId;

    logger.debug(`[${req.method} ${req.path}] ProposalId validated`, {
      proposalId
    });

    next();
  } catch (error) {
    logger.error(`[${req.method} ${req.path}] Error in requireProposalId middleware`, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ error: 'Failed to validate proposal ID' });
  }
};

/**
 * Helper function to get moderator by ID from RouterService
 * @param moderatorId - The ID of the moderator to get
 * @throws Error if moderator not found
 */
export function getModerator(moderatorId: number): Moderator {
  const router = RouterService.getInstance();
  const moderator = router.getModerator(moderatorId);

  if (!moderator) {
    throw new Error(`Moderator ${moderatorId} not found`);
  }

  return moderator;
}