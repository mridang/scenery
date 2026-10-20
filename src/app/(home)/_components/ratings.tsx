/**
 * Scenery / IMDb / Metacritic / Rotten Tomatoes pills. Each renders only
 * when the underlying score is present, so a movie with one source still
 * shows a tidy single chip — no placeholders, no "N/A".
 *
 * They live in one component because they share a positional vocabulary
 * and because we want them rendered as a single horizontal flex line
 * wherever they appear (hero, uniform card, mosaic card). The brand
 * marks live in `public/icons/` (plus `/icon.svg` for the scenery
 * parallelogram) so the markup stays small and the icons render at any
 * size.
 */
export interface RatingsInput {
  /** Scenery's composite score (0-100ish, may exceed). Null hides the chip. */
  readonly sceneryScore: number | null;
  /** Scenery grade label (A/B/C/?). Rendered as a small suffix. */
  readonly sceneryTier: string | null;
  readonly imdbRating: number | null;
  readonly imdbVotes: number | null;
  readonly mcScore: number | null;
  readonly rtScore: number | null;
}

interface SizeProps {
  /** "sm" mirrors the card sizing; "md" mirrors the hero sizing. */
  size?: 'sm' | 'md';
}

export function RatingsRow({
  sceneryScore,
  sceneryTier,
  imdbRating,
  imdbVotes,
  mcScore,
  rtScore,
  size = 'sm',
}: RatingsInput & SizeProps) {
  // Vote count still gates IMDb visibility (a 9.5 with 3 votes is noise),
  // but we no longer render the number to keep the chip tidy.
  const showImdb = imdbRating !== null && (imdbVotes ?? 0) > 0;
  const hasAny =
    sceneryScore !== null || showImdb || mcScore !== null || rtScore !== null;
  if (!hasAny) {
    return null;
  }
  const big = size === 'md';
  const cls = big
    ? 'mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-[#e8e8ec]'
    : 'mt-[1px] flex flex-wrap items-center gap-x-[9px] gap-y-[3px] font-mono text-[10px] leading-[1.5] text-[#c3c3cc]';
  const itemCls = 'inline-flex items-center gap-[5px] whitespace-nowrap';
  const iconSize = big ? 'h-4 w-auto' : 'h-3 w-auto';
  return (
    <div className={cls}>
      {sceneryScore !== null ? (
        <span className={itemCls}>
          <img
            src="/icon.svg"
            alt="scenery"
            className={`inline-block ${big ? 'size-4' : 'size-3'}`}
            width={big ? 16 : 12}
            height={big ? 16 : 12}
          />
          <span className="font-semibold">
            {Math.round(sceneryScore)}
            {sceneryTier && sceneryTier !== '?' ? (
              <span
                className={`ml-1 font-medium tracking-[0.06em] text-[#a1a1aa] ${
                  big ? 'text-[10px]' : 'text-[8.5px]'
                }`}
              >
                {sceneryTier}
              </span>
            ) : null}
          </span>
        </span>
      ) : null}
      {showImdb ? (
        <span className={itemCls}>
          <img
            src="/icons/imdb.svg"
            alt="IMDb"
            className={`inline-block ${iconSize}`}
            width={big ? 28 : 22}
            height={big ? 16 : 12}
          />
          <span className="font-semibold">{imdbRating!.toFixed(1)}</span>
        </span>
      ) : null}
      {mcScore !== null ? (
        <span className={itemCls}>
          <img
            src="/icons/metacritic.svg"
            alt="Metacritic"
            className={`inline-block ${big ? 'size-4' : 'size-3'}`}
            width={big ? 16 : 12}
            height={big ? 16 : 12}
          />
          <span className="font-semibold">{mcScore}</span>
        </span>
      ) : null}
      {rtScore !== null ? (
        <span className={itemCls}>
          <img
            src="/icons/rotten-tomatoes.svg"
            alt="Rotten Tomatoes"
            className={`inline-block ${big ? 'size-4' : 'size-3'}`}
            width={big ? 16 : 12}
            height={big ? 16 : 12}
          />
          <span className="font-semibold">{rtScore}%</span>
        </span>
      ) : null}
    </div>
  );
}
