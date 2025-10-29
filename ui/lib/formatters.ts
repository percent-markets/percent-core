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
 * Format a USD amount with $ prefix and K/M/B abbreviations
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "$1.23M"
 */
export function formatUSD(value: number, decimals: number = 2): string {
  return `$${formatWithAbbreviation(value, decimals)}`;
}

/**
 * Format a number with K/M/B abbreviations (helper function for formatUSD)
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with abbreviation
 */
function formatWithAbbreviation(value: number, decimals: number = 2): string {
  if (value === 0) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // Helper to remove trailing zeros
  const removeTrailingZeros = (num: string): string => {
    return num.replace(/\.?0+$/, '');
  };

  if (absValue >= 1_000_000_000) {
    // Billions
    return `${sign}${removeTrailingZeros((absValue / 1_000_000_000).toFixed(decimals))}B`;
  } else if (absValue >= 1_000_000) {
    // Millions
    return `${sign}${removeTrailingZeros((absValue / 1_000_000).toFixed(decimals))}M`;
  } else if (absValue >= 1_000) {
    // Thousands
    return `${sign}${removeTrailingZeros((absValue / 1_000).toFixed(decimals))}K`;
  } else {
    // Less than 1000, show up to decimals places
    return `${sign}${removeTrailingZeros(absValue.toFixed(decimals))}`;
  }
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