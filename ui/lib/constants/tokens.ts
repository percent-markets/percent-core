/**
 * Token configuration and utility functions
 */

export const TOKEN_DECIMALS = {
  SOL: 9,
  OOGWAY: 6,
} as const;

export const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  OOGWAY: 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC',
} as const;

/**
 * Convert human-readable amount to smallest token units
 * @param amount - The human-readable amount (e.g., 1.5 SOL)
 * @param token - The token type ('sol' or 'oogway')
 * @returns The amount in smallest units (e.g., 1500000000 for 1.5 SOL)
 */
export function toSmallestUnits(amount: number, token: 'sol' | 'oogway'): number {
  const decimals = token === 'sol' ? TOKEN_DECIMALS.SOL : TOKEN_DECIMALS.OOGWAY;
  return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Convert smallest token units to human-readable decimal amount
 * @param amount - The amount in smallest units
 * @param token - The token type ('sol' or 'oogway')
 * @returns The human-readable amount (e.g., 1.5 for 1500000000)
 */
export function toDecimal(amount: number, token: 'sol' | 'oogway'): number {
  const decimals = token === 'sol' ? TOKEN_DECIMALS.SOL : TOKEN_DECIMALS.OOGWAY;
  return amount / Math.pow(10, decimals);
}

/**
 * Get the decimal places for a given token
 * @param token - The token type ('sol' or 'oogway')
 * @returns The number of decimal places
 */
export function getDecimals(token: 'sol' | 'oogway'): number {
  return token === 'sol' ? TOKEN_DECIMALS.SOL : TOKEN_DECIMALS.OOGWAY;
}
