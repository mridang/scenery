// Shared helpers for deriving quality/HDR/remux flags from a torrent name.
// Used by every provider so the rest of the code can rely on a consistent representation.

import type { Quality } from './types';

const RESOLUTION_2160P = /(?:^|\W)(?:2160p|4K|UHD)(?:\W|$)/iu;
const RESOLUTION_1080P = /(?:^|\W)1080p(?:\W|$)/iu;
const RESOLUTION_720P = /(?:^|\W)720p(?:\W|$)/iu;
const RESOLUTION_480P = /(?:^|\W)480p(?:\W|$)/iu;
const HDR_MARKER = /\bHDR\b|\bDV\b|Dolby\s*Vision/iu;
const REMUX_MARKER = /\bREMUX\b/iu;

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
