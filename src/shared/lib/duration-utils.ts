/**
 * Duration conversion utilities
 * Converts various duration formats to seconds (integer)
 */

/**
 * Convert duration string (e.g., "01:46" or "02:15:30") to total seconds
 * Also handles milliseconds (number) conversion
 * @param duration Duration in various formats: "MM:SS", "HH:MM:SS", number (milliseconds), or number (seconds)
 * @returns Total duration in seconds (integer), or undefined if invalid
 */
export function parseDurationToSeconds(
  duration: string | number | undefined | null
): number | undefined {
  if (duration === undefined || duration === null) {
    return undefined;
  }

  // If it's already a number
  if (typeof duration === 'number') {
    // If number is greater than 100000, assume it's milliseconds
    // (TikTok videoDuration is typically in milliseconds, e.g., 15200ms = 15.2s)
    if (duration > 100000) {
      return Math.floor(duration / 1000); // Convert milliseconds to seconds
    }
    // Otherwise assume it's already in seconds
    return Math.floor(duration);
  }

  // If it's a string
  if (typeof duration === 'string') {
    const trimmed = duration.trim();
    
    // If it's a pure number string, parse it
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      // If number is very large, assume milliseconds
      if (num > 100000) {
        return Math.floor(num / 1000);
      }
      return num;
    }

    // Try to parse time format "MM:SS" or "HH:MM:SS"
    const parts = trimmed.split(':').map((part) => {
      const num = parseInt(part.trim(), 10);
      return isNaN(num) ? 0 : num;
    });

    if (parts.length === 2) {
      // Format: MM:SS
      const [minutes, seconds] = parts;
      return minutes * 60 + seconds;
    } else if (parts.length === 3) {
      // Format: HH:MM:SS
      const [hours, minutes, seconds] = parts;
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  // Invalid format, return undefined
  return undefined;
}

/**
 * Truncate URL to maximum length (for database VARCHAR fields)
 * @param url Original URL
 * @param maxLength Maximum length (default: 1000 characters)
 * @returns Truncated URL
 */
export function truncateUrl(url: string | undefined | null, maxLength: number = 1000): string | undefined {
  if (!url) {
    return undefined;
  }
  
  if (url.length <= maxLength) {
    return url;
  }
  
  // Truncate and add ellipsis
  return url.substring(0, maxLength - 3) + '...';
}
