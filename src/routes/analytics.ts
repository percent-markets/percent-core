import { Router } from 'express';
import { requireApiKey } from '../middleware/auth';
import { getModerator } from '../services/moderator.service';
import { AMMState } from '../../app/types/amm.interface';
import { VaultState } from '../../app/types/vault.interface';
import { PersistenceService } from '../../app/services/persistence.service';

const router = Router();

router.get('/:id', requireApiKey, async (req, res, next) => {
  try {
    const moderator = await getModerator();
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 0) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    
    // Load proposal fresh from database to ensure we have the latest state
    const proposal = await moderator.getProposalFresh(id);
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    // Get AMMs and Vaults directly - they may be null if not initialized
    const pAMM = proposal.__pAMM;
    const fAMM = proposal.__fAMM;
    const baseVault = proposal.__baseVault;
    const quoteVault = proposal.__quoteVault;
    const twapOracle = proposal.twapOracle;
    
    // Get vault supply data if vaults are initialized
    let basePassSupply = '0';
    let baseFailSupply = '0';
    let baseEscrowSupply = '0';
    let quotePassSupply = '0';
    let quoteFailSupply = '0';
    let quoteEscrowSupply = '0';
    
    if (baseVault && baseVault.state !== VaultState.Uninitialized) {
      try {
        const [passSupply, failSupply, escrowSupply] = await Promise.all([
          baseVault.getPassConditionalTotalSupply(),
          baseVault.getFailConditionalTotalSupply(),
          baseVault.getTotalSupply()
        ]);
        basePassSupply = passSupply.toString();
        baseFailSupply = failSupply.toString();
        baseEscrowSupply = escrowSupply.toString();
      } catch (e) {
        console.error(`Failed to fetch base vault supplies for proposal #${id}:`, e);
      }
    }
    
    if (quoteVault && quoteVault.state !== VaultState.Uninitialized) {
      try {
        const [passSupply, failSupply, escrowSupply] = await Promise.all([
          quoteVault.getPassConditionalTotalSupply(),
          quoteVault.getFailConditionalTotalSupply(),
          quoteVault.getTotalSupply()
        ]);
        quotePassSupply = passSupply.toString();
        quoteFailSupply = failSupply.toString();
        quoteEscrowSupply = escrowSupply.toString();
      } catch (e) {
        console.error(`Failed to fetch quote vault supplies for proposal #${id}:`, e);
      }
    }
    
    // Get AMM prices if available
    let passPrice: number | null = null;
    let failPrice: number | null = null;
    
    if (pAMM && pAMM.state === AMMState.Trading) {
      try {
        const price = await pAMM.fetchPrice();
        passPrice = price.toNumber();
      } catch (e) {
        console.error(`Failed to fetch pass AMM price for proposal #${id}:`, e);
      }
    }
    
    if (fAMM && fAMM.state === AMMState.Trading) {
      try {
        const price = await fAMM.fetchPrice();
        failPrice = price.toNumber();
      } catch (e) {
        console.error(`Failed to fetch fail AMM price for proposal #${id}:`, e);
      }
    }
    
    // Get TWAP data if available
    let twapData = null;
    let twapStatus = null;
    
    try {
      const [twapValues, status] = await Promise.all([
        twapOracle.fetchTWAP(),
        twapOracle.fetchStatus()
      ]);
      twapData = twapValues;
      twapStatus = status;
    } catch (e) {
      console.error(`Failed to fetch TWAP data for proposal #${id}:`, e);
    }
    
    const response = {
      // Base proposal data
      id,
      description: proposal.description,
      status: proposal.status,
      createdAt: proposal.createdAt,
      finalizedAt: proposal.finalizedAt,
      proposalStatus: proposal.status,
      proposalLength: proposal.proposalLength,
      
      // Token configuration
      baseMint: moderator.config.baseMint.toBase58(),
      quoteMint: moderator.config.quoteMint.toBase58(),
      authority: moderator.config.authority.publicKey.toBase58(),
      
      // AMM configuration from proposal
      ammConfig: proposal.ammConfig ? {
        initialBaseAmount: proposal.ammConfig.initialBaseAmount.toString(),
        initialQuoteAmount: proposal.ammConfig.initialQuoteAmount.toString(),
      } : null,
      
      // Vaults data - organized by base/quote
      vaults: {
        base: baseVault ? {
          state: baseVault.state,
          passConditionalMint: baseVault.passConditionalMint.toBase58(),
          failConditionalMint: baseVault.failConditionalMint.toBase58(),
          escrow: baseVault.escrow.toBase58(),
          passConditionalSupply: basePassSupply,
          failConditionalSupply: baseFailSupply,
          escrowSupply: baseEscrowSupply,
        } : null,
        quote: quoteVault ? {
          state: quoteVault.state,
          passConditionalMint: quoteVault.passConditionalMint.toBase58(),
          failConditionalMint: quoteVault.failConditionalMint.toBase58(),
          escrow: quoteVault.escrow.toBase58(),
          passConditionalSupply: quotePassSupply,
          failConditionalSupply: quoteFailSupply,
          escrowSupply: quoteEscrowSupply,
        } : null,
      },
      
      // AMMs data
      amms: {
        pass: pAMM ? {
          state: pAMM.state,
          baseMint: pAMM.baseMint.toBase58(),
          quoteMint: pAMM.quoteMint.toBase58(),
          pool: pAMM.pool?.toBase58() || null,
          price: passPrice,
        } : null,
        fail: fAMM ? {
          state: fAMM.state,
          baseMint: fAMM.baseMint.toBase58(),
          quoteMint: fAMM.quoteMint.toBase58(),
          pool: fAMM.pool?.toBase58() || null,
          price: failPrice,
        } : null,
      },
      
      // TWAP Oracle data
      twap: {
        values: twapData ? {
          passTwap: twapData.passTwap.toNumber(),
          failTwap: twapData.failTwap.toNumber(),
          passAggregation: twapData.passAggregation,
          failAggregation: twapData.failAggregation,
        } : null,
        status: twapStatus,
        initialTwapValue: twapOracle.initialTwapValue,
        twapStartDelay: twapOracle.twapStartDelay,
        passThresholdBps: twapOracle.passThresholdBps,
        twapMaxObservationChangePerUpdate: twapOracle.twapMaxObservationChangePerUpdate,
      },
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;