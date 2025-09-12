export const mockProposals = [
  {
    id: 4,
    title: 'Proposal 4',
    description: 'Active proposal with liquidity',
    status: 'Active' as const,
    yesVotes: 1000000,
    noVotes: 500000,
    totalVotes: 1500000,
    volumeTraded: 2500000,
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    createdBy: 'Proposer',
    category: 'Governance' as const
  },
  {
    id: 0,
    title: 'Proposal 0',
    description: 'First test proposal',
    status: 'Active' as const,
    yesVotes: 800000,
    noVotes: 200000,
    totalVotes: 1000000,
    volumeTraded: 1500000,
    endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    createdBy: 'Proposer',
    category: 'Governance' as const
  },
  {
    id: 1,
    title: 'Proposal 1',
    description: 'Second test proposal',
    status: 'Active' as const,
    yesVotes: 600000,
    noVotes: 400000,
    totalVotes: 1000000,
    volumeTraded: 1000000,
    endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    createdBy: 'Proposer',
    category: 'Governance' as const
  }
];