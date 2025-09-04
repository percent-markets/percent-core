import { PublicKey, Keypair } from '@solana/web3.js';
import { Vault } from './app/vault';
import { VaultType, TokenType, ISplitRequest, IMergeRequest } from './app/types/vault.interface';

async function testVaultOperations() {
  console.log('Testing Vault Operations\n');
  
  // Create mock mints for testing
  const baseMint = Keypair.generate().publicKey;
  const quoteMint = Keypair.generate().publicKey;
  
  // Create a pass vault
  const vault = new Vault({
    proposalId: 1,
    vaultType: VaultType.Pass,
    baseMint: baseMint,
    quoteMint: quoteMint
  });
  
  console.log('Vault Created:');
  console.log('  Proposal ID:', vault.proposalId);
  console.log('  Vault Type:', vault.vaultType);
  console.log('  Base Mint:', vault.baseMint.toBase58());
  console.log('  Quote Mint:', vault.quoteMint.toBase58());
  console.log('  Conditional Base Mint (pBASE):', vault.conditionalBaseMint.toBase58());
  console.log('  Conditional Quote Mint (pQUOTE):', vault.conditionalQuoteMint.toBase58());
  console.log();
  
  // Create test user
  const user = Keypair.generate().publicKey;
  console.log('Test User:', user.toBase58());
  console.log();
  
  // Deposit some tokens for testing
  console.log('Depositing 1000 base tokens and 500 quote tokens...');
  vault.depositTokens(user, TokenType.Base, 1000n);
  vault.depositTokens(user, TokenType.Quote, 500n);
  
  // Check initial balances
  let balances = vault.getUserBalances(user);
  console.log('Initial Balances:');
  console.log('  Base:', balances.base.toString());
  console.log('  Quote:', balances.quote.toString());
  console.log('  Conditional Base:', balances.conditionalBase.toString());
  console.log('  Conditional Quote:', balances.conditionalQuote.toString());
  console.log();
  
  // Test split operation for base tokens
  console.log('Splitting 300 base tokens into conditional tokens...');
  const splitRequest: ISplitRequest = {
    user: user,
    tokenType: TokenType.Base,
    amount: 300n
  };
  await vault.splitTokens(splitRequest);
  
  balances = vault.getUserBalances(user);
  console.log('After Split:');
  console.log('  Base:', balances.base.toString());
  console.log('  Quote:', balances.quote.toString());
  console.log('  Conditional Base:', balances.conditionalBase.toString());
  console.log('  Conditional Quote:', balances.conditionalQuote.toString());
  console.log();
  
  // Test split operation for quote tokens
  console.log('Splitting 200 quote tokens into conditional tokens...');
  const splitQuoteRequest: ISplitRequest = {
    user: user,
    tokenType: TokenType.Quote,
    amount: 200n
  };
  await vault.splitTokens(splitQuoteRequest);
  
  balances = vault.getUserBalances(user);
  console.log('After Second Split:');
  console.log('  Base:', balances.base.toString());
  console.log('  Quote:', balances.quote.toString());
  console.log('  Conditional Base:', balances.conditionalBase.toString());
  console.log('  Conditional Quote:', balances.conditionalQuote.toString());
  console.log();
  
  // Test merge operation
  console.log('Merging 100 conditional base tokens back to regular tokens...');
  const mergeRequest: IMergeRequest = {
    user: user,
    tokenType: TokenType.Base,
    amount: 100n
  };
  await vault.mergeTokens(mergeRequest);
  
  balances = vault.getUserBalances(user);
  console.log('After Merge:');
  console.log('  Base:', balances.base.toString());
  console.log('  Quote:', balances.quote.toString());
  console.log('  Conditional Base:', balances.conditionalBase.toString());
  console.log('  Conditional Quote:', balances.conditionalQuote.toString());
  console.log();
  
  // Check total supplies
  console.log('Total Supplies:');
  console.log('  Base tokens in vault:', vault.getTotalSupply(TokenType.Base).toString());
  console.log('  Quote tokens in vault:', vault.getTotalSupply(TokenType.Quote).toString());
  console.log('  Conditional base tokens issued:', vault.getConditionalTotalSupply(TokenType.Base).toString());
  console.log('  Conditional quote tokens issued:', vault.getConditionalTotalSupply(TokenType.Quote).toString());
  console.log();
  
  // Test error handling
  console.log('Testing Error Handling:');
  try {
    console.log('  Attempting to split more tokens than available...');
    await vault.splitTokens({
      user: user,
      tokenType: TokenType.Base,
      amount: 10000n
    });
  } catch (error: any) {
    console.log('  Error caught:', error.message);
  }
  
  try {
    console.log('  Attempting to merge more conditional tokens than available...');
    await vault.mergeTokens({
      user: user,
      tokenType: TokenType.Quote,
      amount: 10000n
    });
  } catch (error: any) {
    console.log('  Error caught:', error.message);
  }
  
  console.log('\nVault test completed successfully!');
}

// Run the test
testVaultOperations().catch(console.error);