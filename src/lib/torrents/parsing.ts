// Shared helpers for deriving quality/HDR/remux flags from a torrent name.
// Used by every provider so the rest of the code can rely on a consistent representation.

import type { Quality } from './types';

const RESOLUTION_2160P = /(?:^|\W)(?:2160p|4K|UHD)(?:\W|$)/i;
const RESOLUTION_1080P = /(?:^|\W)1080p(?:\W|$)/i;
const RESOLUTION_720P = /(?:^|\W)720p(?:\W|$)/i;
const RESOLUTION_480P = /(?:^|\W)480p(?:\W|$)/i;
const HDR_MARKER = /\bHDR\b|\bDV\b|Dolby\s*Vision/i;
const REMUX_MARKER = /\bREMUX\b/i;

export function detectQuality(haystack: string): Quality | null {
  if (RESOLUTION_2160P.test(haystack)) {
    return '2160p';
  }
  if (RESOLUTION_1080P.test(haystack)) {
    return '1080p';
  }
  if (RESOLUTION_720P.test(haystack)) {
    return '720p';
  }
  if (RESOLUTION_480P.test(haystack)) {
    return '480p';
  }
  return null;
}

export function detectHdr(haystack: string): boolean {
  return HDR_MARKER.test(haystack);
}

export function detectRemux(haystack: string): boolean {
  return REMUX_MARKER.test(haystack);
}
