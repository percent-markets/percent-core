# Conditional AMM System Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [Conditional Token Mechanics](#conditional-token-mechanics)
5. [AMM Implementation](#amm-implementation)
6. [Trading & Price Discovery](#trading--price-discovery)
7. [Complete Lifecycle Walkthrough](#complete-lifecycle-walkthrough)

---

## Introduction

### What are Conditional AMMs?

The Percent Protocol uses **two independent Automated Market Makers (AMMs)** for each governance proposal to enable prediction market functionality. These AMMs facilitate price discovery for binary outcomes (pass/fail) by allowing users to trade conditional tokens that represent different future states.

### Why Two Separate AMMs?

Instead of a single AMM trading regular tokens, we use **two parallel AMMs**:
- **pAMM (Pass AMM)**: Trades pass conditional tokens (pBase/pQuote)
- **fAMM (Fail AMM)**: Trades fail conditional tokens (fBase/fQuote)

This dual-AMM architecture provides:
1. **Independent Price Discovery**: Each outcome has its own market with supply/demand dynamics
2. **Market Efficiency**: Traders can express directional views by trading on either market
3. **Capital Efficiency**: Users can hold positions in one outcome without requiring the other
4. **Clear Position Management**: Users can easily accumulate winning conditional tokens

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PROPOSAL                                 │
│                                                                  │
│  ┌──────────────┐                        ┌──────────────┐      │
│  │  Base Vault  │                        │ Quote Vault  │      │
│  │              │                        │              │      │
│  │ Regular: ZC  │                        │ Regular: SOL │      │
│  │ Pass:   pZC  │                        │ Pass:   pSOL │      │
│  │ Fail:   fZC  │                        │ Fail:   fSOL │      │
│  └──────────────┘                        └──────────────┘      │
│         │                                        │              │
│         └────────────┬───────────────────────────┘              │
│                      │                                          │
│         ┌────────────┴────────────┐                            │
│         │                         │                            │
│    ┌────▼─────┐            ┌─────▼────┐                       │
│    │   pAMM   │            │   fAMM   │                       │
│    │          │            │          │                       │
│    │ Pool:    │            │ Pool:    │                       │
│    │ pZC/pSOL │            │ fZC/fSOL │                       │
│    └──────────┘            └──────────┘                       │
│                                                                 │
│  Two independent AMMs enable price discovery for both outcomes │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Dual AMM Structure

Each proposal maintains **two independent constant product AMMs**:

| Component | pAMM (Pass Market) | fAMM (Fail Market) |
|-----------|-------------------|-------------------|
| Base Token | pBase (e.g., pZC) | fBase (e.g., fZC) |
| Quote Token | pQuote (e.g., pSOL) | fQuote (e.g., fSOL) |
| Initial Price | 1.0 (equal liquidity) | 1.0 (equal liquidity) |
| Pool Fee | 10% base fee | 10% base fee |
| SDK | Meteora CP-AMM | Meteora CP-AMM |

### 2. Vault Integration

Two vaults manage the conditional token lifecycle:

**Base Vault** (e.g., for ZC):
- Regular Mint: `ZC`
- Pass Conditional Mint: `pZC`
- Fail Conditional Mint: `fZC`

**Quote Vault** (e.g., for SOL):
- Regular Mint: `SOL`
- Pass Conditional Mint: `pSOL` (minted when proposal passes)
- Fail Conditional Mint: `fSOL` (minted when proposal fails)

### 3. Token Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TOKEN LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────┘

1. INITIALIZATION
   Authority: 100 ZC + 100 SOL
                  │
                  ├──► Base Vault Split: 100 ZC → 100 pZC + 100 fZC
                  └──► Quote Vault Split: 100 SOL → 100 pSOL + 100 fSOL

2. AMM SEEDING
   pAMM: 100 pZC + 100 pSOL  (Initial liquidity)
   fAMM: 100 fZC + 100 fSOL  (Initial liquidity)

3. USER TRADING
   User: 10 ZC
           │
           ├──► Split: 10 ZC → 10 pZC + 10 fZC
           │
           ├──► Trade on pAMM: 10 pZC → ~9 pSOL (after fees)
           │    (Now holding: ~9 pSOL + 10 fZC)
           │
           └──► If bullish on pass, user accumulates pZC/pSOL

4. FINALIZATION
   Proposal Passes:
     - pZC + pSOL are "winning tokens"
     - Users redeem: 10 pZC → 10 ZC (1:1)
     - fZC + fSOL become worthless
```

---

## Conditional Token Mechanics

### Split Operation

The split operation converts regular tokens into **BOTH** pass and fail conditional tokens at a **1:1:1 ratio**:

```
Input:  1 regular token
Output: 1 pass token + 1 fail token
```

**Example**:
- User splits 100 ZC
- After split, user receives:
  - 100 pZC (pass conditional ZC)
  - 100 fZC (fail conditional ZC)

**Why equal amounts?** This ensures conservation of value:
- Before split: 1 ZC = 1 ZC
- After split: 1 pZC + 1 fZC = 1 ZC (exactly one outcome occurs)

### Merge Operation

The merge operation is the **inverse of split** - it burns equal amounts of both conditional tokens to recover regular tokens:

```
Input:  1 pass token + 1 fail token
Output: 1 regular token
```

This is only available **before finalization**. After finalization, users must use the **redeem** operation for winning tokens only.

### Redeem Operation

After finalization, only **winning conditional tokens** can be redeemed 1:1 for regular tokens:

```
If proposal PASSED:
  Input:  1 pZC (pass token)
  Output: 1 ZC (regular token)
  Note:   fZC (fail tokens) become worthless

If proposal FAILED:
  Input:  1 fZC (fail token)
  Output: 1 ZC (regular token)
  Note:   pZC (pass tokens) become worthless
```

---

## AMM Implementation

### Meteora CP-AMM Integration

Each AMM uses the Meteora Constant Product AMM SDK with the following configuration:
- **Fee Structure**: 10% base fee (10M / 100M basis points)
- **Fee Schedule**: Linear with no decay
- **Dynamic Fees**: None
- **Fee Collection**: In both tokens

### Initial Liquidity Provision

Both AMMs receive **equal initial liquidity** from the authority's conditional tokens:
- **pAMM**: Initialized with equal amounts of pZC (base) and pSOL (quote)
- **fAMM**: Initialized with equal amounts of fZC (base) and fSOL (quote)

This creates an **initial 1:1 price** on both markets, allowing the market to discover the true probability through trading.

### State Lifecycle

Each AMM progresses through distinct states:

```
┌──────────────────┐
│  Uninitialized   │  Initial state, no pool exists
└────────┬─────────┘
         │
         │ initialize()
         ▼
┌──────────────────┐
│     Trading      │  Pool active, swaps allowed
└────────┬─────────┘
         │
         │ removeLiquidity()
         ▼
┌──────────────────┐
│    Finalized     │  Pool closed, no more swaps
└──────────────────┘
```

### Transaction Pattern: Build/Execute

All AMM operations follow a **build → sign → execute** pattern:

1. **Build**: Create unsigned transaction with all instructions
2. **Sign**: User reviews and signs the transaction
3. **Execute**: Submit signed transaction to the network

This pattern allows the user to review and approve transactions before execution.

---

## Trading & Price Discovery

### How Users Trade on Each Market

Users can trade on either the **pass market** (pAMM) or **fail market** (fAMM) independently:

#### Buying Pass Tokens (Bullish on Proposal)

```
1. Split regular tokens to get conditional tokens
   100 ZC → 100 pZC + 100 fZC

2. Swap on pAMM to accumulate pass tokens
   Trade pZC for pSOL

3. Result: User holds more pass tokens (pZC/pSOL)
   (betting proposal will pass)
```

#### Buying Fail Tokens (Bearish on Proposal)

```
1. Split regular tokens to get conditional tokens
   100 ZC → 100 pZC + 100 fZC

2. Swap on fAMM to accumulate fail tokens
   Trade fZC for fSOL

3. Result: User holds more fail tokens (fZC/fSOL)
   (betting proposal will fail)
```

### Independent Price Discovery

Each AMM maintains its own price based on **supply and demand** in that specific market:

```
Initial State (equal liquidity):
  pAMM: 100 pZC / 100 pSOL = 1.0 price
  fAMM: 100 fZC / 100 fSOL = 1.0 price

After Bullish Trading:
  pAMM: 80 pZC / 120 pSOL = 1.5 price  (pZC more expensive)
  fAMM: 120 fZC / 80 fSOL = 0.67 price (fZC less expensive)

Interpretation: Market believes proposal more likely to pass
```

### What Drives Prices?

**pAMM Price Increases When**:
- More traders buy pass tokens (pZC/pSOL)
- Bullish sentiment on proposal passing
- Higher confidence in positive outcome

**fAMM Price Increases When**:
- More traders buy fail tokens (fZC/fSOL)
- Bearish sentiment on proposal passing
- Higher confidence in negative outcome

**Market Equilibrium**:
The relative prices between pAMM and fAMM reflect the market's **probability assessment** of the proposal passing.

### Getting Quotes

Before executing a swap, users can get a quote with price impact and slippage protection:

**Quote Information Includes**:
- **swapOutAmount**: Expected output tokens
- **minSwapOutAmount**: Minimum output (with slippage protection)
- **totalFee**: 10% fee in this market
- **priceImpact**: How much the trade affects the price

---

## Complete Lifecycle Walkthrough

### Phase 1: Initialization

**Step 1: Create Vaults**
- Base vault creates conditional ZC mints (pZC and fZC)
- Quote vault creates conditional SOL mints (pSOL and fSOL)
- Both vaults are initialized on-chain

**Step 2: Split Tokens for Initial Liquidity**
- Authority splits 100 ZC → 100 pZC + 100 fZC
- Authority splits 100 SOL → 100 pSOL + 100 fSOL
- Split gives authority equal amounts of pass and fail tokens

**Step 3: Initialize AMMs**
- Seed pAMM with 100 pZC (base) + 100 pSOL (quote)
- Seed fAMM with 100 fZC (base) + 100 fSOL (quote)
- Both AMMs are now live with 1:1 initial prices

### Phase 2: Trading Period

**User Journey: Going Long on Pass**

1. **User splits 50 ZC** into conditional tokens
   - Result: 50 pZC + 50 fZC

2. **User swaps on pAMM** to accumulate pass tokens
   - Trade pZC for pSOL
   - Result: User holds more pass tokens (e.g., 45 pSOL + 50 fZC after fees)

3. **User position**: Holding pass tokens (pSOL/pZC), betting proposal will pass

**Market Impact**:
- pAMM: If users buy pass tokens, price increases (bullish signal)
- fAMM: If users buy fail tokens, price increases (bearish signal)
- Independent price discovery on each market

### Phase 3: Finalization

**Step 1: Determine Outcome**
- Proposal outcome is determined (Pass or Fail)
- Based on external oracle or governance mechanism

**Step 2: Remove Liquidity from AMMs**
- All liquidity removed from both pAMM and fAMM
- Pools are closed, no more trading allowed
- Position NFTs are closed

**Step 3: Finalize Vaults**
- Vaults store the final outcome (Passed or Failed)
- Split/merge operations are blocked
- Only redemption is allowed for winning tokens
- Authority redeems their winning conditional tokens

### Phase 4: User Redemption

**If Proposal Passed (User Held Pass Tokens)**:
- User redeems pZC for regular ZC (1:1)
- Example: 50 pZC → 50 ZC
- Their fZC tokens become worthless and cannot be redeemed

**If Proposal Failed (User Held Fail Tokens)**:
- User redeems fZC for regular ZC (1:1)
- Example: 50 fZC → 50 ZC
- Their pZC tokens become worthless and cannot be redeemed
