#!/usr/bin/env ts-node

import { CreateModeratorRequest } from '@src/routes/router';
import { encryptKeypair } from '@app/utils/crypto';
import { ExecutionService } from '@app/services/execution.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function createModerator() {
  const API_URL = process.env.API_URL || 'http://localhost:3001';
  const API_KEY = process.env.API_KEY;
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }

  if (!ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY environment variable is required');
    process.exit(1);
  }

  // Load authority keypair
  const keypairPath = process.env.SOLANA_KEYPAIR_PATH || './wallet.json';
  console.log(`Loading keypair from: ${keypairPath}`);

  try {
    const authority = ExecutionService.loadKeypair(keypairPath);
    console.log(`Authority: ${authority.publicKey.toBase58()}`);

    // Encrypt the keypair
    const encryptedAuthority = encryptKeypair(authority, ENCRYPTION_KEY);

    // Token configuration
    // ZC token address (you'll need to replace this with actual ZC token address)
    const BASE_MINT = ''; // Replace with actual ZC token mint
    const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL

    const request: CreateModeratorRequest = {
      baseMint: BASE_MINT,      // ZC token
      quoteMint: SOL_MINT,    // SOL
      baseDecimals: 6,        // ZC decimals
      quoteDecimals: 9,       // SOL decimals
      authority: encryptedAuthority,
      protocolName: 'Percent Protocol'
    };

    console.log('\nRequest:');
    console.log(JSON.stringify(request, null, 2));

    const response = await fetch(`${API_URL}/api/router/moderators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('\nError:', (error as { error?: string }).error || 'Failed to create moderator');
      process.exit(1);
    }

    const data = await response.json();
    console.log('\n✅ Moderator created successfully');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createModerator();
}

export { createModerator };