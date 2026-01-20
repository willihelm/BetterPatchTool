/**
 * Increments the trailing number in a string.
 * If the string ends with a number, increments it by 1.
 * If no trailing number exists, returns the original string.
 *
 * @example
 * incrementTrailingNumber("Vocal 1") // "Vocal 2"
 * incrementTrailingNumber("Guitar") // "Guitar"
 * incrementTrailingNumber("Tom 10") // "Tom 11"
 */
export function incrementTrailingNumber(value: string): string {
  const match = value.match(/^(.*?)(\d+)$/);
  if (match) {
    const [, prefix, numStr] = match;
    const num = parseInt(numStr, 10) + 1;
    return prefix + num;
  }
  return value;
}
