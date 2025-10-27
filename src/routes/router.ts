import { Router } from 'express';
import { requireApiKey } from '../middleware/auth';
import { RouterService } from '../../app/services/router.service';
import { PublicKey, Keypair } from '@solana/web3.js';
import { LoggerService } from '../../app/services/logger.service';

const router = Router();
const logger = new LoggerService('ROUTER_ROUTES');

/**
 * Get all moderators info (public endpoint)
 */
router.get('/moderators', async (_req, res, next) => {
  try {
    const routerService = RouterService.getInstance();
    const moderators = routerService.getAllModerators();

    // Collect info from all moderators
    const moderatorsInfo = [];
    for (const [id, moderator] of moderators) {
      try {
        const info = await moderator.info();
        moderatorsInfo.push(info);
      } catch (error) {
        logger.error('[GET /moderators] Failed to get info for moderator:', {
          moderatorId: id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other moderators even if one fails
      }
    }

    logger.info('[GET /moderators] Fetched moderators info', {
      count: moderatorsInfo.length
    });

    res.json({
      moderators: moderatorsInfo,
      count: moderatorsInfo.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new moderator (requires authentication)
 */
router.post('/moderators', requireApiKey, async (req, res, next) => {
  try {
    const {
      baseMint,
      quoteMint,
      baseDecimals,
      quoteDecimals,
      protocolName
    } = req.body;

    // Validate required fields
    if (!baseMint || !quoteMint || baseDecimals === undefined || quoteDecimals === undefined) {
      logger.warn('[POST /moderators] Missing required fields', {
        receivedFields: Object.keys(req.body)
      });
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['baseMint', 'quoteMint', 'baseDecimals', 'quoteDecimals']
      });
    }

    // Validate decimals
    if (typeof baseDecimals !== 'number' || typeof quoteDecimals !== 'number') {
      logger.warn('[POST /moderators] Invalid decimal types', {
        baseDecimalsType: typeof baseDecimals,
        quoteDecimalsType: typeof quoteDecimals
      });
      return res.status(400).json({
        error: 'baseDecimals and quoteDecimals must be numbers'
      });
    }

    if (baseDecimals < 0 || baseDecimals > 18 || quoteDecimals < 0 || quoteDecimals > 18) {
      logger.warn('[POST /moderators] Decimals out of range', {
        baseDecimals,
        quoteDecimals
      });
      return res.status(400).json({
        error: 'Decimals must be between 0 and 18'
      });
    }

    // Validate mint addresses
    let baseMintPubkey: PublicKey;
    let quoteMintPubkey: PublicKey;

    try {
      baseMintPubkey = new PublicKey(baseMint);
      quoteMintPubkey = new PublicKey(quoteMint);
    } catch (error) {
      logger.warn('[POST /moderators] Invalid mint address format', {
        baseMint,
        quoteMint,
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(400).json({
        error: 'Invalid mint address format'
      });
    }

    // Create the moderator
    const routerService = RouterService.getInstance();
    const { moderator, id } = await routerService.createModerator(
      baseMintPubkey,
      quoteMintPubkey,
      baseDecimals,
      quoteDecimals,
      protocolName
    );

    // Get the info for the newly created moderator
    const info = await moderator.info();

    logger.info('[POST /moderators] Created new moderator', {
      moderatorId: id,
      protocolName,
      baseMint,
      quoteMint,
      baseDecimals,
      quoteDecimals
    });

    res.status(201).json({
      success: true,
      moderator: info
    });
  } catch (error) {
    logger.error('[POST /moderators] Failed to create moderator', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });
    next(error);
  }
});

/**
 * Refresh the router service (requires authentication)
 * Reloads all moderators from the database
 */
router.post('/refresh', requireApiKey, async (_req, res, next) => {
  try {
    const routerService = RouterService.getInstance();

    logger.info('[POST /refresh] Starting router service refresh...');

    await routerService.refresh();

    // Get updated moderators info after refresh
    const moderators = routerService.getAllModerators();
    const moderatorsInfo = [];

    for (const [id, moderator] of moderators) {
      try {
        const info = await moderator.info();
        moderatorsInfo.push(info);
      } catch (error) {
        logger.error('[POST /refresh] Failed to get info for moderator after refresh', {
          moderatorId: id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logger.info('[POST /refresh] Router service refreshed successfully', {
      moderatorCount: moderatorsInfo.length
    });

    res.json({
      success: true,
      message: 'Router service refreshed successfully',
      moderators: moderatorsInfo
    });
  } catch (error) {
    logger.error('[POST /refresh] Failed to refresh router service', {
      error: error instanceof Error ? error.message : String(error)
    });
    next(error);
  }
});

/**
 * Get a specific moderator's info
 */
router.get('/moderators/:id', async (req, res, next) => {
  try {
    const moderatorId = parseInt(req.params.id);

    if (isNaN(moderatorId) || moderatorId < 0) {
      logger.warn('[GET /moderators/:id] Invalid moderator ID', {
        providedId: req.params.id
      });
      return res.status(400).json({ error: 'Invalid moderator ID' });
    }

    const routerService = RouterService.getInstance();
    const moderator = routerService.getModerator(moderatorId);

    if (!moderator) {
      logger.warn('[GET /moderators/:id] Moderator not found', {
        moderatorId
      });
      return res.status(404).json({ error: 'Moderator not found' });
    }

    const info = await moderator.info();

    logger.info('[GET /moderators/:id] Fetched moderator info', {
      moderatorId
    });

    res.json({
      moderator: info
    });
  } catch (error) {
    logger.error('[GET /moderators/:id] Failed to get moderator info', {
      moderatorId: req.params.id,
      error: error instanceof Error ? error.message : String(error)
    });
    next(error);
  }
});

export default router;