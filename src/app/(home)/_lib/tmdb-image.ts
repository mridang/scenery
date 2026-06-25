/**
 * TMDB serves the same poster art at a fixed set of widths. Use the
 * smallest size that still looks crisp at the slot we're rendering into,
 * so the page weight stays light on the mosaic and the hero stays sharp.
 *
 * @public
 */
export type PosterSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780';

/** Build a TMDB poster URL, or `null` if there's no poster path. */
export function posterUrl(
  posterPath: string | null,
  size: PosterSize,
): string | null {
  if (!posterPath) {
    return null;
  }
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}
