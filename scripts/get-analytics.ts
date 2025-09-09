#!/usr/bin/env ts-node

import dotenv from 'dotenv';

dotenv.config();

async function getAnalytics() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY;
  
  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }
  
  const proposalId = process.argv[2];
  
  if (!proposalId) {
    console.error('Usage: npm run get-analytics <proposal-id>');
    process.exit(1);
  }
  
  const id = parseInt(proposalId);
  if (isNaN(id)) {
    console.error('Invalid proposal ID. Must be a number.');
    process.exit(1);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/analytics/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
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
  getAnalytics();
}

export { getAnalytics };