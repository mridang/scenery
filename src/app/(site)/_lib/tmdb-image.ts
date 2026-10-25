/**
 * Same-origin TMDB image URL builders. Every poster and backdrop on the
 * page is funneled through the `/img` proxy (which scales it with the
 * Cloudflare Images binding and keeps a copy at the edge), so the strict
 * CSP can keep `img-src` at `'self'`. Picking the right pixel width here
 * keeps page weight tight: the smallest size that still looks crisp at the
 * slot wins.
 */
import { imageSrc } from '@/lib/cloudflare/images';

/** TMDB size token → integer pixel width the proxy understands. */
const POSTER_WIDTHS = {
  w92: 92,
  w185: 185,
  w342: 342,
  w500: 500,
  w780: 780,
} as const;

/**
 * Allowed poster sizes. Each one matches a TMDB native size AND a width
 * the proxy will accept.
 *
 * @public
 */
export type PosterSize = keyof typeof POSTER_WIDTHS;

/**
 * Build a same-origin poster URL routed through `/img`, or `null` if
 * there's no poster path. The returned URL is a relative path.
 *
 * @public
 */
export function posterUrl(
  posterPath: string | null,
  size: PosterSize,
): string | null {
  if (!posterPath) {
    return null;
  }
  const src = `https://image.tmdb.org/t/p/original${posterPath}`;
  return imageSrc(src, POSTER_WIDTHS[size]);
}

/**
 * Backdrop pixel widths. Bigger than posters because the hero spans the
 * full content width; the largest size matches the proxy's biggest
 * allowed render width.
 *
 * @public
 */
export type BackdropSize =
  | 'w300'
  | 'w780'
  | 'w1280'
  | 'w1920'
  | 'w2560'
  | 'w3840';

const BACKDROP_WIDTHS: Record<BackdropSize, number> = {
  w300: 342, // closest poster width — also one the proxy permits
  w780: 780,
  w1280: 1280,
  w1920: 1920,
  w2560: 2560,
  w3840: 3840, // 2× the widest hero viewport — keeps Retina laptops crisp
};

/**
 * Build a same-origin backdrop URL. Backdrops are the 16:9 stills meant
 * for hero banners — distinct from the 2:3 portrait posters. Falls back
 * to the poster path so the hero never paints a blank rectangle when
 * only the poster is available.
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
  const src = `https://image.tmdb.org/t/p/original${path}`;
  return imageSrc(src, BACKDROP_WIDTHS[size]);
}
