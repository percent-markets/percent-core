/**
 * Format a number with comma separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with commas
 */
export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  // Format with decimals and add commas
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format a currency value with dollar sign and commas
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '$0';
  
  return `$${formatNumber(num, decimals)}`;
}

/**
 * Format large numbers with K, M, B suffixes
 * @param value - The number to format
 * @returns Formatted string with suffix
 */
export function formatCompact(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '0';

  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;

  return formatNumber(num, 2);
}

/**
 * Format volume with K, M, B notation and special handling for small values
 * @param value - The volume to format
 * @returns Formatted volume string with dollar sign
 */
export function formatVolume(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '$0';

  // For values >= $1B
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;

  // For values >= $1M
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;

  // For values >= $1K
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;

  // For values < $1, show up to 6 decimal places
  if (num < 1 && num > 0) {
    // Convert to string and remove trailing zeros
    const formatted = num.toFixed(6);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return `$${trimmed}`;
  }

  // For values between $1 and $999, show 2 decimal places
  return `$${num.toFixed(2)}`;
}