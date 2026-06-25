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

/**
 * Wide 16:9 backdrop sizes. `w1280` is what TMDB recommends for hero
 * banners; smaller sizes are useful for thumbnails or low-bandwidth.
 *
 * @public
 */
export type BackdropSize = 'w300' | 'w780' | 'w1280' | 'original';

/**
 * Build a TMDB backdrop URL. Backdrops are the 16:9 stills meant for
 * hero banners — distinct from the 2:3 portrait posters. Falls back to
 * a poster (scaled to the backdrop URL pattern) so the hero never paints
 * a blank rectangle when only the poster is available.
 *
 * @public
 */
export function backdropUrl(
  backdropPath: string | null,
  posterPath: string | null,
  size: BackdropSize,
): string | null {
  const path = backdropPath ?? posterPath;
  if (!path) {
    return null;
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
