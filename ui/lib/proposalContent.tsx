import React from 'react';
import { formatDescription } from './formatDescription';

interface ProposalContent {
  id: number;
  title: string;
  content: React.ReactNode;
}

export const proposalContentMap: Record<number, ProposalContent> = {
  0: {
    id: 0,
    title: "What is the price of $ZC after OOG-1 settles?",
    content: (
      <div className="space-y-4 text-gray-300">
        <p>
          Mint 5,000,000 $ZC, stake them in the $ZC vault and distribute staked tokens proportionally based on wallet volume to all traders of this decision market.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">How is volume calculated?</h3>
          <p>
            All trading volume on the pass and fail markets occurring before the implied resolution on either the pass or fail markets is counted towards the reward calculation. Volume is calculated as if both pass and fail markets resolve.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">What is implied resolution?</h3>
          <p>
            Implied resolution occurs once the pass-fail gap is sufficiently large such that no additional price movement can change the outcome of the market. This is an anti-manipulation feature.
          </p>
        </div>

        <p>
          The proposal passes if pass-fail gap &gt; 3%. Pass-fail gap is calculated using TWAP
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our telegram: <a href="https://t.me/oogwayexperimentportal" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://t.me/oogwayexperimentportal</a>
          </p>
        </div>
      </div>
    )
  },
  2: {
    id: 2,
    title: "ZC-1: Update Staking Vault Rewards & Parameters",
    content: (
      <div className="space-y-4 text-gray-300">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Summary</h3>
          <p>
            Adjust the $ZC staking vault to align incentives with longer-term staking and simplify user operations.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Changes Proposed</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Epoch length:</strong> increase from 14 days to 30 days (monthly withdrawal period)</li>
            <li><strong>Emissions:</strong> increase from 14M $ZC / 14 days to 60M $ZC / 30 days</li>
            <li><strong>One-time early exit window:</strong> upon execution, open withdrawals for 36 hours, then close until the first monthly epoch end</li>
            <li><strong>Passing criterion:</strong> proposal passes only if the pass–fail gap TWAP &gt; 0% over the voting period</li>
            <li><strong>Reward pause during window:</strong> pause reward emissions (no accrual) during the 36-hour withdrawal window</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Motivation</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Longer commitment, clearer cadence:</strong> monthly epochs reduce operational churn vs biweekly</li>
            <li><strong>Strengthen incentives:</strong> doubles daily emissions to reward long-term participation and increase the staked share</li>
            <li><strong>Graceful transition:</strong> an early withdrawal window plus an emissions pause prevents "trapped" liquidity and removes timing edge cases</li>
          </ul>
        </div>

        <p>
          The proposal passes if pass-fail gap &gt; 0%. Pass-fail gap is calculated using TWAP.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our Discord: <a href="https://discord.gg/Vf38Mqhxu5" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://discord.gg/Vf38Mqhxu5</a>
          </p>
        </div>
      </div>
    )
  },
  3: {
    id: 3,
    title: "ZC-1: Update Staking Vault Rewards & Parameters",
    content: (
      <div className="space-y-4 text-gray-300">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Summary</h3>
          <p>
            Adjust the $ZC staking vault to align incentives with longer-term staking and simplify user operations.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Changes Proposed</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Epoch length:</strong> increase from 14 days to 30 days (monthly withdrawal period)</li>
            <li><strong>Emissions:</strong> increase from 14M $ZC / 14 days to 60M $ZC / 30 days</li>
            <li><strong>One-time early exit window:</strong> upon execution, open withdrawals for 36 hours, then close until the first monthly epoch end</li>
            <li><strong>Passing criterion:</strong> proposal passes only if the pass–fail gap TWAP &gt; 0% over the voting period</li>
            <li><strong>Reward pause during window:</strong> pause reward emissions (no accrual) during the 36-hour withdrawal window</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Motivation</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Longer commitment, clearer cadence:</strong> monthly epochs reduce operational churn vs biweekly</li>
            <li><strong>Strengthen incentives:</strong> doubles daily emissions to reward long-term participation and increase the staked share</li>
            <li><strong>Graceful transition:</strong> an early withdrawal window plus an emissions pause prevents "trapped" liquidity and removes timing edge cases</li>
          </ul>
        </div>

        <p>
          The proposal passes if pass-fail gap &gt; 0%. Pass-fail gap is calculated using TWAP.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our Discord: <a href="https://discord.gg/Vf38Mqhxu5" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://discord.gg/Vf38Mqhxu5</a>
          </p>
        </div>
      </div>
    )
  },
  4: {
    id: 4,
    title: "SolPay Retroactive Holder Redistribution (ZC-2)",
    content: (
      <div className="space-y-4 text-gray-300">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Summary</h3>
          <p>
            This proposal authorizes the ZCombinatorio Protocol to execute a controlled redistribution of the SolPay ($SP) token supply in response to a recent exploitative accumulation event. The goal is to preserve the integrity of the $SP network and restore fair ownership distribution.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Actions Authorized</h3>
          <p className="mb-2">If passed, this proposal permits the Protocol to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Pull liquidity from the existing SP–SOL Meteora DAMM v2 pool to secure assets prior to redistribution.</li>
            <li>Snapshot the total circulating supply and tokenholder distribution of $SP at the time of execution.</li>
            <li>Deploy a new token, $SP (v2), with a total supply of 1 billion tokens, and create a new liquidity pool seeded with the SOL portion withdrawn from the DAMM pool.</li>
            <li>
              Exclude the following wallet addresses from eligibility in the redistribution. Any amount transferred from these wallets is ineligible for the redistribution:
              <ul className="list-none ml-6 mt-1 space-y-0.5 font-mono text-sm">
                <li>Fve2mSodYe6oPgX2GNx8PwcELjFkKkGVVNSkYa2LtqAo</li>
                <li>J7qUXWS8N2tyjsdWkW91dca5M2JqcMEt98fR6qeWRv7o</li>
                <li>8x69juM1Qg6eWbtTyChNnFhX1foFkA2ZDeQtufMNPN14</li>
                <li>AiLwAtCzPnQh6GnJ1UiMi9vqNniV3QyTM4rueKYNjPwN</li>
              </ul>
            </li>
            <li>Airdrop the entire circulating of $SP supply proportionally to eligible holders based on the adjusted snapshot distribution, effectively restoring balances to aligned participants.</li>
          </ul>
          <p className="mt-2">In the case that the wallets exit prior to snapshot, no actions will be taken.</p>
          <p className="mt-2">Once the actions are authorized, the decision to execute actions will be given to Bennie the Dev.</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Rationale</h3>
          <p className="mb-2">
            Following the SolPay launch, a significant percentage of $SP supply was acquired by a single actor through aggressive sniping behavior. This concentration of ownership undermines:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Price discovery, by reducing market depth and liquidity efficiency;</li>
            <li>User acquisition, by discouraging organic participation and inflating volatility;</li>
            <li>Protocol alignment, as the affected actor has demonstrated behavior inconsistent with the long-term goals of the project.</li>
          </ul>
          <p className="mt-2">
            The SolPay developer and ZCombinatorio community deem this redistribution necessary to ensure the network&apos;s sustainability and equitable token distribution.
          </p>
        </div>

        <p>
          The proposal passes if pass-fail gap &gt; 0%. Pass-fail gap is calculated using TWAP.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our Discord: <a href="https://discord.gg/Vf38Mqhxu5" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://discord.gg/Vf38Mqhxu5</a>
          </p>
        </div>
      </div>
    )
  },
  5: {
    id: 5,
    title: "Decision Market Proposal: Percent Pre-Sale Mechanics Adjustment (ZC-3)",
    content: (
      <div className="space-y-4 text-gray-300">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Executive Summary</h3>
          <p>
            Due to higher-than-anticipated demand, the current pre-sale structure would result in an unsustainable 20x price appreciation with only 3% liquidity at launch. This proposal seeks market approval to modify the mechanics for a healthier market launch.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Current Situation</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Problem:</strong> Pre-sale participants would see 20x returns, but the pool would be illiquid (3% liquidity)</li>
            <li><strong>Risk:</strong> Price volatility, difficulty in trading, potential cascade of sells with insufficient buy-side liquidity</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Proposed Solution</h3>
          <p className="mb-2">Adjust the pre-sale mechanics to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use pre-sale funds to pair with 20% of $PERC tokens on an Automated Market Maker (AMM)</li>
            <li>Early backers allocation remains unchanged</li>
            <li>If passing, the pre-sale would still blind close within the max deadline</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Examples (Assuming 70M ZC deposited in presale)</h3>

          <div className="mt-3">
            <h4 className="font-semibold text-white mb-1">Proposed Mechanics:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>627,900,000 PERC sold for 70,000,000 ZC</li>
              <li>200,000,000 PERC deposited to AMM</li>
              <li>With ZC at ~$2.5M market cap, $PERC opens public trading at a $820k market cap</li>
              <li>20% liquidity</li>
              <li>Results in 3x markup for pre-sale participants</li>
            </ul>
          </div>

          <div className="mt-3">
            <h4 className="font-semibold text-white mb-1">Current Mechanics:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>795,840,286 PERC sold for 70,000,000 ZC</li>
              <li>33,000,000 PERC deposited to AMM</li>
              <li>$PERC opens at a $5.5m market cap</li>
              <li>3% liquidity</li>
              <li>Results in 20x markup for pre-sale participants</li>
            </ul>
          </div>
        </div>

        <p>
          The proposal passes if pass-fail gap &gt; 0%. Pass-fail gap is calculated using TWAP.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our Discord: <a href="https://discord.gg/Vf38Mqhxu5" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://discord.gg/Vf38Mqhxu5</a>
          </p>
        </div>
      </div>
    )
  },
  6: {
    id: 6,
    title: "What is the price of $ZC after OOG-1 settles?",
    content: (
      <div className="space-y-4 text-gray-300">
        <p>
          Mint 5,000,000 $ZC, stake them in the $ZC vault and distribute staked tokens proportionally based on wallet volume to all traders of this decision market.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">How is volume calculated?</h3>
          <p>
            All trading volume on the pass and fail markets occurring before the implied resolution on either the pass or fail markets is counted towards the reward calculation. Volume is calculated as if both pass and fail markets resolve.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">What is implied resolution?</h3>
          <p>
            Implied resolution occurs once the pass-fail gap is sufficiently large such that no additional price movement can change the outcome of the market. This is an anti-manipulation feature.
          </p>
        </div>

        <p>
          The proposal passes if pass-fail gap &gt; 3%. Pass-fail gap is calculated using TWAP
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our telegram: <a href="https://t.me/oogwayexperimentportal" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://t.me/oogwayexperimentportal</a>
          </p>
        </div>
      </div>
    )
  },
  7: {
    id: 7,
    title: "What will the price of $ZC be after the OOG-2 market resolves?",
    content: (
      <div className="space-y-4 text-gray-300">
        <p className="font-semibold">
          OOG-2: Create an $ZC-sZC LP via meteora DAMM V2
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Mint</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>40,000,000 $ZC for the purpose of creating a liquid sZC token</li>
            <li>10,000,000 $ZC to be distributed to traders of this market. distribution will be volume based and in the form of staked ZC</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Pros:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>$ZC stakers, who no longer want to signal commitment, can exit at a discount to $ZC.</li>
            <li>$ZC holders interested in signaling commitment, can purchase $ZC at discounts by purchasing staked $ZC</li>
            <li>decision markets can be set up on staked $ZC instead of $ZC</li>
            <li>removes deferred selling upon end of staking period</li>
            <li>increased volume on the native trading pool</li>
            <li>pricing of staked $ZC APY is more accurate</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Cons:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>staking market becomes less restrictive</li>
            <li>complicated mechanisms increase overhead</li>
          </ul>
        </div>

        <p className="text-sm italic">
          Trading this decision market incurs financial risk.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">How is volume calculated?</h3>
          <p>
            All trading volume on the pass and fail markets occurring before the implied resolution on either the pass or fail markets is counted towards the reward calculation. Volume is calculated as if both pass and fail markets resolve.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">What is implied resolution?</h3>
          <p>
            Implied resolution occurs once the pass-fail gap is sufficiently large such that no additional price movement can change the outcome of the market. This is an anti-manipulation feature.
          </p>
        </div>

        <p>
          The proposal passes if pass-fail gap &gt; 1%. Pass-fail gap is calculated using TWAP.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our telegram: <a href="https://t.me/oogwayexperimentportal" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://t.me/oogwayexperimentportal</a>
          </p>
        </div>
      </div>
    )
  },
  8: {
    id: 8,
    title: "ZC Application Redesign by Shirtless (ZC-4)",
    content: (
      <div className="space-y-4 text-gray-300">
        <p>
          Should ZC merge PR #13 into main?
        </p>

        <p>
          The proposal passes if pass-fail gap &gt; 0%. Pass-fail gap is calculated using TWAP.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Links</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>
              GitHub PR: <a href="https://github.com/zcombinatorio/zcombinator/pull/13" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://github.com/zcombinatorio/zcombinator/pull/13</a>
            </li>
            <li>
              Discord Discussion: <a href="https://discord.com/channels/1419789513382826006/1424768819330682993" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">View Discussion</a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">I need help - who can I talk to?</h3>
          <p>
            Come join our Discord: <a href="https://discord.gg/Vf38Mqhxu5" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://discord.gg/Vf38Mqhxu5</a>
          </p>
        </div>
      </div>
    )
  },
  9: {
    id: 9,
    title: "Standardized ZC emissions to Percent, ZTORIO, and SolPay by Hands (ZC-5)",
    content: (
      <div className="space-y-4 text-gray-300">
        <p>
          Should ZC merge PR #17 into main?
        </p>

        <p>
          The proposal passes if TWAP Pass-Fail Gap &gt; 0%.
        </p>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Links</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>
              GitHub PR: <a href="https://github.com/zcombinatorio/zcombinator/pull/17" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">https://github.com/zcombinatorio/zcombinator/pull/17</a>
            </li>
            <li>
              Discord Discussion: <a href="discord.gg/MQfcX9QM2r" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">View Discussion</a>
            </li>
          </ul>
        </div>
      </div>
    )
  }
};

export function getProposalContent(
  proposalId: number,
  title: string,
  description: string,
  moderatorId?: string
) {
  // Only use hardcoded content for moderator ID 2
  if (moderatorId === '2') {
    const content = proposalContentMap[proposalId];
    if (content) {
      return {
        title: content.title,
        content: content.content
      };
    }
  }

  // For all other moderators, use database title/description
  return {
    title: title,
    content: description ? (
      <div className="space-y-4 text-gray-300 whitespace-pre-wrap">
        {formatDescription(description)}
      </div>
    ) : null
  };
}
