# CLAUDE.md - Project Documentation & Standards

## Project Overview
Building a governance and prediction market protocol on Solana with TypeScript. The system allows users to create proposals that include prediction markets for pass/fail outcomes.

## Architecture Overview

### Core Components Implemented

#### 1. Moderator System (`app/moderator.ts`)
- **Purpose**: Manages the lifecycle of governance proposals
- **Key Methods**:
  - `createProposal()`: Creates and initializes new proposals
  - `finalizeProposal()`: Finalizes proposals after voting period
  - `executeProposal()`: Executes passed proposals
- **Storage**: Proposals stored in array indexed by ID
- **Status Tracking**: Uses proposal's internal status, not separate tracking

#### 2. Proposal System (`app/proposal.ts`)
- **Purpose**: Individual governance proposal with prediction markets
- **Components**:
  - Two AMMs (pAMM for pass, fAMM for fail)
  - Two Vaults (pVault for pass, fVault for fail)
  - TWAP Oracle for price tracking
  - Solana transaction to execute if passed
- **Status Flow**: Pending → (Passed|Failed) → Executed
- **Key Features**:
  - Auto-calculated `finalizedAt` timestamp
  - Private status field with public getter
  - Initialize method for blockchain setup

#### 3. TWAP Oracle (`app/twap-oracle.ts`)
- **Purpose**: Time-weighted average price tracking
- **Initialization**: Created during proposal construction
- **Key Fields**: 
  - `proposalId`: Links to parent proposal
  - `createdAt` & `finalizedAt`: Time boundaries
  - `passThresholdBps`: Basis points for pass threshold

#### 4. Supporting Classes
- **AMM** (`app/amm.ts`): Automated market maker for trading
- **Vault** (`app/vault.ts`): Token management with conditional tokens (implemented)
- **ExecutionService** (`app/services/execution.service.ts`): Handles Solana transaction execution

## Type System & Interfaces

### Naming Conventions
- **Interfaces**: Prefixed with `I` (e.g., `IProposal`, `IModerator`)
- **Private-like fields**: Double underscore prefix (e.g., `__pAMM`, `__fAMM`)
- **Private fields**: Single underscore prefix (e.g., `_status`)

### Key Types
- **ProposalStatus Enum**: `Pending | Passed | Failed | Executed`
- **IModeratorConfig**: Configuration object pattern for complex constructors
- **Solana Types**: Using `PublicKey` for mints, `Transaction` for operations

## Standard Practices

### Code Organization
```
app/
├── moderator.ts           # Main moderator class
├── proposal.ts            # Proposal implementation
├── twap-oracle.ts         # TWAP oracle
├── amm.ts                 # AMM implementation
├── vault.ts               # Vault implementation
├── services/              # Service layer
│   └── execution.service.ts  # Transaction execution
└── types/                 # All interfaces
    ├── moderator.interface.ts
    ├── proposal.interface.ts
    ├── twap-oracle.interface.ts
    ├── amm.interface.ts
    ├── vault.interface.ts
    └── execution.interface.ts
tests/
└── execute-proposal.ts    # Test script for proposal execution
```

### Error Handling Pattern
- Check preconditions and throw descriptive errors
- Example from `getAMMs()`:
```typescript
if (!this.__pAMM || !this.__fAMM) {
  throw new Error('Proposal AMMs are uninitialized');
}
```

### Async/Await Pattern
- All blockchain interactions are async
- Initialize method pattern for setup operations
- Example:
```typescript
const proposal = new Proposal(...);
await proposal.initialize();  // Blockchain setup
```

### Status Management
- Single source of truth: Proposal owns its status
- Moderator queries proposal.status, doesn't maintain separate state
- Status can only progress forward (no backwards transitions)

### Documentation Standards
- JSDoc comments for all public methods and classes
- Inline comments for complex logic
- TODO comments for unimplemented features
- Parameter descriptions include units (e.g., "in seconds", "in milliseconds")

## Current TODO Items

### High Priority
1. ✅ Execute transaction logic - Send Solana transaction for passed proposals
2. Implement finalization logic - Determine pass/fail based on TWAP  
3. Implement `Proposal.initialize()` - Deploy AMMs, Vaults to blockchain

### Medium Priority
1. Implement AMM methods (fetchPrice, addLiquidity, etc.)
2. Implement Vault methods (splitTokens, mergeTokens)
3. Implement TWAP Oracle methods (crankTWAP, fetchTWAP)

### Low Priority
1. Add event emission for state changes
2. Add detailed logging
3. Optimize gas costs

## Testing Approach
- Unit tests for each class
- Integration tests for proposal lifecycle
- Mock blockchain interactions during development

## Git Workflow
- Commit frequently with descriptive messages
- Use git-agent for commits when requested
- Push changes immediately when requested

## Dependencies
- `@solana/web3.js`: Solana blockchain interaction
- TypeScript with strict mode
- pnpm as package manager

## Key Decisions Made

1. **Status in Proposal**: Store status directly in Proposal class, not separately in Moderator
2. **PublicKey Type**: Use Solana's PublicKey type for all mint addresses, not strings
3. **Config Pattern**: Use config objects for complex constructors (IModeratorConfig)
4. **Field Privacy**: Use `__` prefix convention for fields that shouldn't be accessed directly
5. **Initialization Pattern**: Separate construction from initialization for async operations
6. **Error First**: Throw errors for invalid states rather than returning error codes

## Commands to Run
```bash
# Install dependencies
pnpm install

# Run TypeScript compiler
pnpm tsc

# Lint/Type checking (when implemented)
pnpm run lint
pnpm run typecheck
```

## Recent Updates (Transaction Execution)

### Implemented Features
1. **ExecutionService** - Complete transaction execution service
   - Loads keypairs from JSON files only
   - Sends and confirms transactions with 'confirmed' commitment
   - Pretty-printed JSON logging with Solscan links
   - Returns structured execution results

2. **Proposal.execute()** - Updated to use ExecutionService
   - Accepts signer keypair and execution config
   - Sets status to Executed regardless of transaction success/failure
   - Returns execution result with signature

3. **Test Infrastructure**
   - `tests/execute-proposal.ts` - Complete test script
   - Creates proposal through Moderator
   - Executes memo instruction on mainnet
   - Requires environment variables (no defaults)

### Environment Configuration
```bash
# .env file required with:
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_KEYPAIR_PATH=./wallet.json
```

## Notes for Next Session
- Finalization logic needs to check TWAP oracle for pass/fail determination
- The `initialize()` method in Proposal needs blockchain implementation
- All AMM methods need implementation
- Consider adding a "Cancelled" status for admin intervention

## Contact & Resources
- Report issues at: https://github.com/anthropics/claude-code/issues
- Solana Web3.js docs: https://solana-labs.github.io/solana-web3.js/