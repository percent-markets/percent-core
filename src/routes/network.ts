import { Router } from 'express';

const router = Router();

/**
 * Get network information
 * GET /network
 * 
 * Returns whether we're on devnet or mainnet
 */
router.get('/', async (_req, res, next) => {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    
    // Determine network from RPC URL - simplified to just devnet or mainnet
    const network = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet';
    
    res.json({
      network
    });
  } catch (error) {
    next(error);
  }
});

export default router;