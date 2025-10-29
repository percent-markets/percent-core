import { Router } from 'express';
import { HistoryService } from '../../app/services/history.service';
import { requireModeratorId, getProposalId } from '@src/middleware/validation';
import { PersistenceService } from '@app/services/persistence.service';

const router = Router();
router.use(requireModeratorId); // require moderatorId for all history routes

/**
 * Get TWAP history for a proposal
 * GET /:id/twap?from=&to=
 * 
 * Query parameters:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 */
router.get('/:id/twap', async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = getProposalId(req);

    const { from, to } = req.query;
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    
    if (from && typeof from === 'string') {
      fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'Invalid from date format' });
      }
    }
    
    if (to && typeof to === 'string') {
      toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ error: 'Invalid to date format' });
      }
    }
    
    const twapData = await HistoryService.getTWAPHistory(
      moderatorId,
      proposalId,
      fromDate,
      toDate
    );
    
    res.json({
      moderatorId,
      proposalId,
      count: twapData.length,
      data: twapData.map(twap => ({
        id: twap.id,
        timestamp: twap.timestamp.toISOString(),
        passTwap: twap.passTwap.toString(),
        failTwap: twap.failTwap.toString(),
        passAggregation: twap.passAggregation.toString(),
        failAggregation: twap.failAggregation.toString(),
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get trade history for a proposal
 * GET /:id/trades?from=&to=&limit=
 * 
 * Query parameters:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - limit: number (optional, default 100)
 */
router.get('/:id/trades', async (req, res, next) => {
  try {
    const proposalId = getProposalId(req);
    const moderatorId = req.moderatorId;

    const { from, to, limit } = req.query;
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    let limitNum: number | undefined;
    
    if (from && typeof from === 'string') {
      fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'Invalid from date format' });
      }
    }
    
    if (to && typeof to === 'string') {
      toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ error: 'Invalid to date format' });
      }
    }
    
    if (limit && typeof limit === 'string') {
      limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum <= 0) {
        return res.status(400).json({ error: 'Invalid limit - must be a positive number' });
      }
    }
    
    const trades = await HistoryService.getTradeHistory(
      moderatorId,
      proposalId,
      fromDate,
      toDate,
      limitNum || 100
    );
    
    res.json({
      moderatorId,
      proposalId,
      count: trades.length,
      data: trades.map(trade => ({
        id: trade.id,
        timestamp: trade.timestamp.toISOString(),
        market: trade.market,
        userAddress: trade.userAddress,
        isBaseToQuote: trade.isBaseToQuote,
        amountIn: trade.amountIn.toString(),
        amountOut: trade.amountOut.toString(),
        price: trade.price.toString(),
        txSignature: trade.txSignature,
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get chart data for a proposal
 * GET /:id/chart?interval=&from=&to=
 * 
 * Query parameters:
 * - interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' (required)
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 */
router.get('/:id/chart', async (req, res, next) => {
  try {
    const proposalId = getProposalId(req);
    const moderatorId = req.moderatorId;
    
    const { interval, from, to } = req.query;
    
    if (!interval || typeof interval !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required interval parameter',
        validIntervals: ['1m', '5m', '15m', '1h', '4h', '1d']
      });
    }
    
    const validIntervals = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ 
        error: 'Invalid interval',
        validIntervals
      });
    }
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    
    if (from && typeof from === 'string') {
      fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'Invalid from date format' });
      }
    }
    
    if (to && typeof to === 'string') {
      toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ error: 'Invalid to date format' });
      }
    }
    
    const chartData = await HistoryService.getChartData(
      moderatorId,
      proposalId,
      interval as '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
      fromDate,
      toDate
    );

    // Get proposal to access totalSupply
    const persistenceService = new PersistenceService(moderatorId);
    const proposal = await persistenceService.getProposalForFrontend(proposalId);
    const totalSupply = proposal?.total_supply || 1000000000;

    // Get current SOL/USD price
    const { SolPriceService } = await import('../../app/services/sol-price.service');
    const solPriceService = SolPriceService.getInstance();
    const solPrice = await solPriceService.getSolPrice();

    // Transform data to USD market cap (price × total supply × SOL price) and ISO strings for JSON serialization
    // Note: Spot prices are already in USD market cap, so don't convert them
    const formattedData = chartData.map(point => {
      // Spot prices are already market cap USD, pass/fail need conversion
      const multiplier = point.market === 'spot' ? 1 : (totalSupply * solPrice);

      return {
        timestamp: new Date(point.timestamp).toISOString(),
        market: point.market,
        open: (point.open * multiplier).toString(),
        high: (point.high * multiplier).toString(),
        low: (point.low * multiplier).toString(),
        close: (point.close * multiplier).toString(),
        volume: point.volume?.toString() || '0'
      };
    });

    res.json({
      moderatorId,
      proposalId,
      interval,
      count: formattedData.length,
      data: formattedData
    });
  } catch (error) {
    next(error);
  }
});

export default router;