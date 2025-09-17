# CLAUDE.md - Percent Protocol Implementation Documentation

## Overview
A governance and prediction market protocol on Solana built with TypeScript. The system enables users to create proposals with integrated prediction markets for pass/fail outcomes, providing price discovery for governance decisions.

## Core Architecture

### System Design Principles
- **Conditional Token Model**: 1:1 split/merge mechanism (1 regular token → 1 pass + 1 fail token)
- **Dual AMM Structure**: Each proposal has two AMMs (pAMM for pass, fAMM for fail)
- **TWAP Oracle**: Time-weighted average price tracking for outcome determination
- **Vault System**: Manages token escrow and conditional token lifecycle
- **Database Persistence**: PostgreSQL for state management and historical data

## Implementation Details

### 1. **Moderator System** (`moderator.ts`)
**Purpose**: Central orchestrator managing proposal lifecycle

**Key Features**:
- Auto-incrementing proposal ID counter
- Database-first persistence (source of truth)
- Automatic scheduling of TWAP cranking and finalization
- Integration with SchedulerService for periodic tasks

**Architecture Choices**:
- Proposal state queried directly from proposals (no duplicate tracking)
- Configuration stored in database for recovery after restarts
- Singleton scheduler service for all automatic tasks

### 2. **Proposal System** (`proposal.ts`)
**Purpose**: Individual governance proposals with prediction markets

**Key Components**:
- Two AMMs (Meteora CP-AMM SDK integration)
- Two Vaults (base and quote token management)
- TWAP Oracle for price aggregation
- Transaction storage for execution

**Lifecycle**:
1. **Uninitialized** → Create vaults and mints
2. **Pending** → Active trading period
3. **Passed/Failed** → Determined by TWAP
4. **Executed** → Transaction sent to Solana

**Implementation Notes**:
- Private fields with underscore prefix (`_status`)
- Double underscore for "protected" fields (`__pAMM`)
- Automatic liquidity removal on finalization
- Authority token redemption after finalization

### 3. **AMM Implementation** (`amm.ts`)
**Purpose**: Constant product AMMs using Meteora SDK

**Features**:
- 10% base fee for prediction markets
- Liquidity provision with position NFTs
- Swap quote and execution separation
- State management (Uninitialized → Trading → Finalized)

**Technical Details**:
- Uses CP-AMM SDK for pool creation
- Position NFT tracks LP ownership
- Automatic liquidity removal on finalization
- Build/execute pattern for user transactions

### 4. **Vault System** (`vault.ts`)
**Purpose**: SPL token vault with conditional token management

**Core Operations**:
- **Split**: 1 regular → 1 pass + 1 fail
- **Merge**: 1 pass + 1 fail → 1 regular
- **Redeem**: Winning tokens → regular (after finalization)

**Security Features**:
- Deterministic escrow keypair generation
- Authority-controlled minting
- Escrow-owned regular token accounts
- Automatic account closure for rent recovery

**Architecture Decisions**:
- Separate build/execute methods for transactions
- User signs first, then authority/escrow adds signature
- Wrapped SOL support for mainnet operations
- Finalization locks split/merge, enables redemption only

### 5. **TWAP Oracle** (`twap-oracle.ts`)
**Purpose**: Price aggregation for outcome determination

**Features**:
- Configurable observation clamping (max change per update)
- Start delay before aggregation begins
- Pass threshold in basis points
- Time-weighted aggregation until finalization

**Implementation**:
- Observations track current prices (with optional clamping)
- Aggregations accumulate time-weighted observations
- Status determined by comparing pass vs fail TWAP

### 6. **Service Layer**

#### **ExecutionService** (`services/execution.service.ts`)
- Handles all Solana transaction execution
- Keypair loading from JSON files only
- Solscan link generation
- Structured JSON logging

#### **SPLTokenService** (`services/spl-token.service.ts`)
- Complete SPL token operations
- Wrapped SOL support
- Authority management
- Build/execute pattern for all operations

#### **PersistenceService** (`services/persistence.service.ts`)
- PostgreSQL integration
- Proposal serialization/deserialization
- Transaction instruction storage (not full transactions due to blockhash expiry)
- Moderator state management

#### **SchedulerService** (`services/scheduler.service.ts`)
- Automatic TWAP cranking (configurable intervals)
- Price recording for historical data
- Proposal finalization scheduling
- Task cancellation on errors

#### **HistoryService** (`services/history.service.ts`)
- Price history recording
- TWAP snapshots
- Trade history tracking
- Chart data aggregation

#### **DatabaseService** (`services/database.service.ts`)
- PostgreSQL connection pooling
- Environment-based configuration
- Graceful shutdown support

## Code Style & Conventions

### Naming Patterns
- **Interfaces**: `I` prefix (e.g., `IProposal`, `IAMM`)
- **Private fields**: Single underscore (`_status`)
- **Protected-like fields**: Double underscore (`__pAMM`)
- **Enums**: PascalCase with string values
- **Config objects**: `I{Component}Config` pattern

### TypeScript Patterns
```typescript
// Build/Execute pattern for transactions
const tx = await vault.buildSplitTx(user, amount);
tx.sign(user);
await vault.executeSplitTx(tx);

// Readonly getters for private fields
private _state: VaultState;
get state(): VaultState { return this._state; }

// Config object pattern for complex constructors
const config: IProposalConfig = { /* ... */ };
const proposal = new Proposal(config);
```

### Error Handling
- Descriptive error messages with context
- Check preconditions early
- Throw errors for invalid states
- Log errors with structured JSON

### Async/Await Patterns
- All blockchain operations are async
- Separate initialize() method for async setup
- Promise.all() for parallel operations
- Proper error propagation

## Database Schema

### Key Tables
- `proposals`: Complete proposal state with serialized components
- `moderator_state`: Proposal counter and configuration
- `price_history`: AMM price snapshots
- `twap_history`: TWAP oracle snapshots
- `trade_history`: User swap records

### Serialization Strategy
- Instructions stored separately from transactions (blockhash expiry)
- PublicKeys stored as base58 strings
- BN/BigInt values stored as strings
- JSON serialization for complex objects

## Blockchain Integration

### Solana Patterns
- Connection with 'confirmed' commitment
- Transaction preflight disabled for reliability
- Blockhash refresh for expired transactions
- Partial signing for multi-signature operations

### Authority Management
- Single authority keypair for minting
- Escrow keypairs own token accounts
- Deterministic keypair generation for recovery
- Authority revocation for losing vaults

## Testing Infrastructure

### Test Patterns
- Deterministic keypair generation
- Test-only methods prefixed with `__`
- Environment-based configuration switching
- Mock transaction execution for unit tests

## Security Considerations

1. **No credential storage in code**
2. **Environment variables for sensitive data**
3. **Authority keypair from JSON file only**
4. **No hardcoded private keys or mnemonics**
5. **Rent recovery for closed accounts**
6. **Proper signature verification**

## Current Implementation Status

### ✅ Fully Implemented
- Moderator system with proposal management
- Vault system with split/merge/redeem
- SPL token service with authority management
- Execution service with logging
- Database persistence and recovery
- TWAP oracle with aggregation
- AMM integration with Meteora SDK
- Scheduler for automatic tasks
- History tracking and chart data

### 🚧 TODO Items
- Event emission for state changes
- Advanced gas optimization
- Governance token integration
- Multi-signature proposals
- Proposal cancellation mechanism
- Redemption deadlines

## Performance Optimizations

1. **Database connection pooling**
2. **Batch token operations**
3. **Parallel promise execution**
4. **Efficient TWAP aggregation**
5. **Transaction preflight skipping**
6. **Deterministic keypair caching**

## Deployment Considerations

### Environment Variables
```bash
DB_URL=postgresql://...
SOLANA_RPC_URL=https://...
SOLANA_KEYPAIR_PATH=./wallet.json
NODE_ENV=production
```

### Commands
```bash
pnpm install       # Install dependencies
pnpm tsc          # TypeScript compilation
pnpm test         # Run tests
pnpm start        # Start server
```

## Dependencies

### Core
- `@solana/web3.js`: Solana blockchain interaction
- `@meteora-ag/cp-amm-sdk`: Constant product AMM
- `@solana/spl-token`: SPL token operations
- `@coral-xyz/anchor`: BN and utility types

### Infrastructure
- `pg`: PostgreSQL client
- `decimal.js`: Precise decimal arithmetic
- `dotenv`: Environment configuration
- TypeScript with strict mode enabled

## API Layer (`/src/`)

### 1. **REST API Architecture**

#### **Route Structure** (`routes/`)
Modular endpoint organization with clear separation:
- `proposals.ts` - Proposal CRUD operations
- `analytics.ts` - Detailed proposal analytics
- `twap.ts` - TWAP oracle operations
- `vaults.ts` - Token split/merge/redeem operations  
- `swap.ts` - AMM swap operations (conditional & Jupiter)
- `history.ts` - Historical data queries
- `network.ts` - Network detection (mainnet/devnet)

#### **Key API Patterns**
```typescript
// Build/Execute pattern for user operations
POST /:id/:type/buildSplitTx    // Returns unsigned transaction
POST /:id/:type/executeSplitTx  // Executes signed transaction

// Quote/Execute pattern for swaps
GET /:id/:market/quote           // Get quote
POST /:id/executeSwapTx          // Execute swap
```

### 2. **Server Infrastructure**

#### **Main Server** (`server.ts`)
- Express + CORS setup
- API key authentication middleware
- Automatic moderator initialization
- Database state recovery on startup
- Pending proposal recovery mechanism

#### **Test Server** (`test/server.test.ts`)
- Devnet-only operation
- Automatic test token creation (TEST-USDC, TEST-SOL)
- Deterministic wallet generation
- Pre-funded test accounts

### 3. **Service Layer** (`services/`)

#### **ModeratorService**
- Singleton pattern implementation
- Database state persistence/recovery
- Automatic proposal recovery after restart
- Test/production mode switching

#### **SwapService**
- Jupiter aggregator integration
- AMM finalization checks
- Build/execute transaction pattern
- Batch quote fetching

### 4. **Middleware**

#### **Authentication** (`middleware/auth.ts`)
- API key validation (`x-api-key` header)
- Optional authentication for public endpoints
- Request authentication state tracking

#### **Error Handler** (`middleware/errorHandler.ts`)
- Global error catching
- Structured error responses
- Stack trace logging

### 5. **WebSocket Infrastructure** (`/server/`)

#### **Price WebSocket Server** (`price-websocket-server.ts`)
**Purpose**: Real-time price updates and trade notifications

**Features**:
- Multi-source price aggregation (DexScreener, AMMs)
- Real-time pool monitoring for devnet
- Trade event broadcasting
- PostgreSQL LISTEN/NOTIFY integration

**Architecture**:
```typescript
// Client subscription model
{
  type: 'SUBSCRIBE',
  tokens: [{ address: string, poolAddress?: string }]
}

// Price update broadcast
{
  type: 'PRICE_UPDATE',
  data: { tokenAddress, price, priceUsd, timestamp }
}

// Trade event broadcast
{
  type: 'TRADE',
  proposalId, market, userAddress, amountIn, amountOut
}
```

#### **Price Services**
- **DevnetPriceService**: Meteora pool monitoring on devnet
- **MainnetPriceService**: Production AMM price fetching
- Automatic network detection and routing
- 5-second cache duration
- SOL/USD price conversion

### 6. **API Endpoints**

#### **Proposal Management**
```
GET  /api/proposals              - List all proposals
GET  /api/proposals/:id          - Get proposal details
POST /api/proposals              - Create proposal (protected)
POST /api/proposals/:id/finalize - Finalize proposal
POST /api/proposals/:id/execute  - Execute proposal
```

#### **Trading Operations**
```
POST /api/swap/:id/buildSwapTx     - Build AMM swap
POST /api/swap/:id/executeSwapTx   - Execute AMM swap
GET  /api/swap/:id/:market/quote   - Get AMM quote
POST /api/swap/:id/jupiter/*       - Jupiter integration
```

#### **Vault Operations**
```
POST /api/vaults/:id/:type/buildSplitTx    - Build split transaction
POST /api/vaults/:id/:type/buildMergeTx    - Build merge transaction
POST /api/vaults/:id/:type/buildRedeemTx   - Build redemption
GET  /api/vaults/:id/getUserBalances       - Get all balances
```

#### **Analytics & History**
```
GET /api/analytics/:id           - Detailed proposal metrics
GET /api/history/:id/prices      - Price history
GET /api/history/:id/twap        - TWAP history
GET /api/history/:id/trades      - Trade history
GET /api/history/:id/chart       - Chart data
```

### 7. **Special Features**

#### **Wrapped SOL Handling**
Automatic SOL wrapping/unwrapping for mainnet operations:
- Detection of quote vault with NATIVE_MINT
- Prepend wrap instructions on split
- Append unwrap instructions on merge/redeem

#### **Database Integration**
- PostgreSQL LISTEN/NOTIFY for real-time events
- Trade history persistence
- Price history recording
- Proposal state saving after operations

#### **Test Mode Features**
- Deterministic wallet generation
- Automatic token minting and distribution
- Test wallet funding (Authority, Alice, Bob, Aelix, Dylan)
- Environment variable wallet loading

### 8. **Error Handling Patterns**

```typescript
// Graceful pool not found handling
if (error.message?.includes('not found')) {
  return null; // Return null instead of throwing
}

// API validation with detailed errors
if (!required.every(field => body[field])) {
  return res.status(400).json({ 
    error: 'Missing required fields',
    required: ['field1', 'field2']
  });
}

// Transaction failure handling
if (result.status === 'failed') {
  throw new Error(`Operation failed: ${result.error}`);
}
```

### 9. **Performance Optimizations**

#### **API Layer**
- Parallel promise execution for analytics
- Batch price fetching
- Response caching (5-second duration)
- Connection pooling

#### **WebSocket Layer**
- Subscription-based updates (only send to interested clients)
- Debounced price updates (0.01% threshold)
- Real-time monitoring for active pools only
- Efficient broadcast mechanisms

## UI Layer (`/ui/`)

### 1. **Next.js Application Architecture**

#### **Technology Stack**
- **Framework**: Next.js 15.5.2 with App Router and Turbopack
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS v4 with custom design system
- **Authentication**: Privy for Web3 wallet integration
- **State Management**: React hooks and context
- **Notifications**: react-hot-toast for user feedback

#### **Application Structure**
```
ui/
├── app/                     # Next.js app router pages
│   ├── page.tsx            # Main trading interface
│   ├── layout.tsx          # Root layout with providers
│   └── analytics/[id]/     # Analytics dashboard
├── components/             # Reusable React components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions and API clients
├── providers/              # Context providers
└── services/               # Service layer for API integration
```

### 2. **Core Components**

#### **TradingInterface** (`components/TradingInterface.tsx`)
**Purpose**: Primary trading interface for opening/closing positions

**Features**:
- Pass/Fail market selection
- Position management (increase/decrease)
- SOL/OOGWAY input modes with currency toggle
- Dynamic payout calculations
- Customizable quick amount buttons (persistent via localStorage)
- Real-time position tracking
- Claim functionality for finished proposals

**State Management**:
- Position detection from user balances
- Automatic mode switching based on position status
- Input validation with percentage limits

#### **LivePriceDisplay** (`components/LivePriceDisplay.tsx`)
**Purpose**: Real-time price monitoring and TWAP display

**Features**:
- WebSocket connection for live price updates
- TWAP (Time-Weighted Average Price) calculations
- Pass/Fail price tracking
- Visual indicators for price movements
- Auto-reconnection on connection loss

#### **Sidebar** (`components/Sidebar.tsx`)
**Purpose**: Proposal navigation and overview

**Features**:
- Proposal list with status indicators
- Live/Passed/Failed state badges
- Countdown timers for active proposals
- Search and filter capabilities

#### **Header** (`components/Header.tsx`)
**Purpose**: Wallet connection and balance display

**Features**:
- Privy wallet integration
- SOL and OOGWAY balance display
- Network indicator (mainnet/devnet)
- Settings modal access

### 3. **Custom Hooks**

#### **usePrivyWallet** (`hooks/usePrivyWallet.ts`)
- Manages Privy authentication state
- Extracts Solana wallet address
- Handles embedded and linked wallets

#### **useProposals** (`hooks/useProposals.ts`)
- Fetches and manages proposal data
- Auto-refresh on timer expiry
- Sorting and filtering utilities

#### **useUserBalances** (`hooks/useUserBalances.ts`)
- Tracks user's conditional token balances
- Calculates position status
- Real-time balance updates

#### **useTokenPrices** (`hooks/useTokenPrices.ts`)
- SOL and OOGWAY price fetching
- Price caching with TTL
- USD conversion calculations

#### **useTradeHistory** (`hooks/useTradeHistory.ts`)
- Fetches trade history for proposals
- Formatting utilities (time, addresses, volumes)
- Real-time trade updates via polling

#### **useWalletBalances** (`hooks/useWalletBalances.ts`)
- Native wallet balance tracking
- SOL and OOGWAY token balances
- Automatic refresh on transactions

### 4. **Trading Library** (`lib/trading.ts`)

#### **Position Management**
```typescript
// Open a new position
openPosition({
  proposalId,
  positionType: 'pass' | 'fail',
  inputAmount,
  inputCurrency: 'sol' | 'oogway',
  userAddress,
  signTransaction
})

// Close existing position
closePosition({
  proposalId,
  positionType,
  percentageToClose,
  userAddress,
  signTransaction
})

// Claim winnings
claimWinnings({
  proposalId,
  proposalStatus,
  userPosition,
  userAddress,
  signTransaction
})
```

#### **Trading Flow**
1. **Opening Positions**:
   - 50/50 split of input currency
   - Split tokens into conditional pairs
   - Execute market swaps based on position type
   
2. **Closing Positions**:
   - Calculate percentage-based amounts
   - Execute reverse swaps
   - Merge conditional tokens back

3. **Network-Aware Swaps**:
   - Devnet: Simulated 1:1 exchange rates
   - Mainnet: Real Jupiter aggregator integration

### 5. **API Integration**

#### **REST API Clients**
- Proposal management (`/api/proposals`)
- Vault operations (`/api/vaults`)
- Swap execution (`/api/swap`)
- Analytics data (`/api/analytics`)
- Trade history (`/api/history`)

#### **WebSocket Services**
- Real-time price updates
- Trade event broadcasting
- TWAP oracle updates
- Connection management with auto-reconnect

### 6. **UI/UX Patterns**

#### **Loading States**
- Skeleton screens for initial loads
- Inline spinners for actions
- Toast notifications for feedback

#### **Error Handling**
- Graceful error boundaries
- User-friendly error messages
- Retry mechanisms for failed requests

#### **Responsive Design**
- Mobile-first approach
- Adaptive layouts for different screens
- Touch-optimized interactions

#### **Dark Theme**
- Consistent color palette (#181818 background)
- High contrast for readability
- Accent colors for market types (emerald/rose)

### 7. **State Management Strategy**

#### **Local State**
- Component-level state for UI interactions
- Form inputs and validation
- Modal/dropdown visibility

#### **Global State**
- User authentication (Privy context)
- Wallet connection status
- Network configuration

#### **Server State**
- Proposals data with caching
- User balances with polling
- Price data via WebSocket

### 8. **Performance Optimizations**

#### **Code Splitting**
- Dynamic imports for heavy components
- Route-based code splitting
- Lazy loading of analytics views

#### **Memoization**
- React.memo for expensive components
- useMemo for computed values
- useCallback for event handlers

#### **Data Fetching**
- SWR-like caching strategies
- Optimistic updates for transactions
- Batch API requests where possible

### 9. **Security Considerations**

#### **Wallet Security**
- No private key storage
- Transaction signing via Privy
- User confirmation for all operations

#### **Input Validation**
- Amount validation (decimals, ranges)
- Percentage limits (0-100%)
- Address validation

#### **API Security**
- CORS configuration
- Rate limiting awareness
- Error message sanitization

## Architecture Philosophy

1. **Separation of Concerns**: Clear boundaries between layers
2. **Database as Source of Truth**: All state persisted immediately
3. **Fail-Safe Design**: Graceful degradation on errors
4. **Explicit Over Implicit**: Clear method signatures and types
5. **Testability**: Dependency injection and interface-based design
6. **Security First**: Multiple validation layers and access controls
7. **Real-time First**: WebSocket for live updates, REST for operations
8. **Network Agnostic**: Automatic mainnet/devnet detection
9. **User-Centric Design**: Intuitive interfaces with clear feedback
- Add to memory. Very important. Never run any server or script. Ask the user to do so and then they will give you back results.