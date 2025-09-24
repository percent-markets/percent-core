import { Router } from 'express';
import { getModerator } from '../services/moderator.service';
import { ProposalStatus } from '../../app/types/moderator.interface';
import { SchedulerService } from '../../app/services/scheduler.service';
import { optionalApiKey } from '../middleware/auth';
import { PersistenceService } from '../../app/services/persistence.service';

const router = Router();

router.get('/:proposalId', optionalApiKey, async (req, res) => {
  try {
    const proposalId = parseInt(req.params.proposalId);
    
    if (isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }

    const moderator = await getModerator();
    // Get proposal from database (always fresh data)
    const proposal = await moderator.getProposal(proposalId);
    
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

export default router;