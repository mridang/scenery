// Shared helpers for deriving quality/HDR/remux flags from a torrent name.
// Used by every provider so the rest of the code can rely on a consistent
// representation.

export function detectQuality(haystack: string): string | null {
  if (/(?:^|\W)(?:2160p|4K|UHD)(?:\W|$)/i.test(haystack)) return '2160p';
  if (/(?:^|\W)1080p(?:\W|$)/i.test(haystack)) return '1080p';
  if (/(?:^|\W)720p(?:\W|$)/i.test(haystack)) return '720p';
  if (/(?:^|\W)480p(?:\W|$)/i.test(haystack)) return '480p';
  return null;
}

export function detectHdr(haystack: string): boolean {
  return /\bHDR\b|\bDV\b|Dolby\s*Vision/i.test(haystack);
}

export function detectRemux(haystack: string): boolean {
  return /\bREMUX\b/i.test(haystack);
}
