import { Router } from 'express';
import { getModerator } from '../services/moderator.service';
import { ProposalStatus } from '../../app/types/moderator.interface';
import { SchedulerService } from '../../app/services/scheduler.service';
import { requireApiKey, optionalApiKey } from '../middleware/auth';

const router = Router();

router.get('/:proposalId', optionalApiKey, async (req, res) => {
  try {
    const proposalId = parseInt(req.params.proposalId);
    
    if (isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }

    const moderator = getModerator();
    const proposal = moderator.proposals[proposalId];
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.status === ProposalStatus.Uninitialized) {
      return res.status(400).json({ error: 'Proposal is uninitialized' });
    }

    const twapOracle = proposal.twapOracle;
    const [twapData, status] = await Promise.all([
      twapOracle.fetchTWAP(),
      twapOracle.fetchStatus()
    ]);

    res.json({
      proposalId,
      twap: twapData,
      status
    });
  } catch (error) {
    console.error('Error fetching TWAP data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch TWAP data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:proposalId/crank', requireApiKey, async (req, res) => {
  try {
    const proposalId = parseInt(req.params.proposalId);
    
    if (isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }

    const moderator = getModerator();
    const proposal = moderator.proposals[proposalId];
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.status === ProposalStatus.Uninitialized) {
      return res.status(400).json({ error: 'Proposal is uninitialized' });
    }

    const twapOracle = proposal.twapOracle;
    await twapOracle.crankTWAP();

    res.json({
      proposalId,
      message: 'TWAP cranked successfully'
    });
  } catch (error) {
    console.error('Error cranking TWAP:', error);
    res.status(500).json({ 
      error: 'Failed to crank TWAP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/scheduler/active-tasks', requireApiKey, async (_req, res) => {
  try {
    const scheduler = SchedulerService.getInstance();
    const activeTasks = scheduler.getActiveTasks();

    res.json({
      activeTasks,
      count: activeTasks.length
    });
  } catch (error) {
    console.error('Error fetching active tasks:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active tasks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;