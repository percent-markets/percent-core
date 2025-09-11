import { Router } from 'express';
import { HistoryService } from '../../app/services/history.service';

const router = Router();

/**
 * Get price history for a proposal
 * GET /:id/prices?from=&to=&interval=
 * 
 * Query parameters:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)  
 * - interval: string like '1m', '5m', '1h' (optional)
 */
router.get('/:id/prices', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    
    if (isNaN(proposalId) || proposalId < 0) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    
    const { from, to, interval } = req.query;
    
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
    
    const historyService = HistoryService.getInstance();
    const prices = await historyService.getPriceHistory(
      proposalId,
      fromDate,
      toDate,
      interval as string
    );
    
    res.json({
      proposalId,
      count: prices.length,
      data: prices.map(price => ({
        id: price.id,
        timestamp: price.timestamp.toISOString(),
        market: price.market,
        price: price.price.toString(),
        baseLiquidity: price.baseLiquidity?.toString(),
        quoteLiquidity: price.quoteLiquidity?.toString(),
      }))
    });
  } catch (error) {
    next(error);
  }
});

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
    const proposalId = parseInt(req.params.id);
    
    if (isNaN(proposalId) || proposalId < 0) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    
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
    
    const historyService = HistoryService.getInstance();
    const twapData = await historyService.getTWAPHistory(
      proposalId,
      fromDate,
      toDate
    );
    
    res.json({
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
    const proposalId = parseInt(req.params.id);
    
    if (isNaN(proposalId) || proposalId < 0) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    
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
    
    const historyService = HistoryService.getInstance();
    const trades = await historyService.getTradeHistory(
      proposalId,
      fromDate,
      toDate,
      limitNum || 100
    );
    
    res.json({
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
    const proposalId = parseInt(req.params.id);
    
    if (isNaN(proposalId) || proposalId < 0) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    
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
    
    const historyService = HistoryService.getInstance();
    const chartData = await historyService.getChartData(
      proposalId,
      interval as '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
      fromDate,
      toDate
    );
    
    res.json({
      proposalId,
      interval,
      count: chartData.length,
      data: chartData
    });
  } catch (error) {
    next(error);
  }
});

export default router;