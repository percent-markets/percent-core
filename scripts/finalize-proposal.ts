#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';

dotenv.config();

async function finalizeProposal(proposalId?: number) {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  
  // Get proposal ID from command line argument or environment variable
  const id = proposalId ?? parseInt(process.argv[2] || process.env.PROPOSAL_ID || '');
  
  if (isNaN(id) || id < 0) {
    console.error('Valid proposal ID is required');
    console.error('Usage: ts-node scripts/finalize-proposal.ts <proposal-id>');
    console.error('Or set PROPOSAL_ID environment variable');
    process.exit(1);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/proposals/${id}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error(JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  finalizeProposal();
}

export { finalizeProposal };