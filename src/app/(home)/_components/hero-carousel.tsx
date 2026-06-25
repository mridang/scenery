'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ScoredMovie } from '../../../lib/catalog';

import { Hero } from './hero';

/**
 * Client wrapper around {@link Hero} that paginates a small slate of
 * recent-with-torrent movies. Renders prev/next chevrons and a row of
 * three-style dots at the bottom; auto-advances every 8s but pauses
 * when the user takes manual control or focuses an arrow/dot.
 *
 * Server-rendered with the first slide so SEO scrapers and JS-disabled
 * visitors still see a useful hero — the client just takes over the
 * paging once it hydrates.
 */
export function HeroCarousel({ movies }: { movies: readonly ScoredMovie[] }) {
  const slides = movies.filter((movie) => movie.row.poster_path);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) {
        return;
      }
      setIndex(((next % count) + count) % count);
    },
    [count],
  );
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (paused || count <= 1) {
      return;
    }
    const handle = setTimeout(() => goTo(index + 1), 8000);
    return () => clearTimeout(handle);
  }, [paused, count, goTo, index]);

  if (count === 0) {
    return null;
  }

  return (
    <div
      className="relative h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Hero movie={slides[index] ?? null} />

      {count > 1 ? (
        <>
          <CarouselButton
            direction="prev"
            onClick={(event) => {
              event.preventDefault();
              prev();
            }}
          />
          <CarouselButton
            direction="next"
            onClick={(event) => {
              event.preventDefault();
              next();
            }}
          />
          <Dots count={count} index={index} onSelect={goTo} />
        </>
      ) : null}
    </div>
  );
}

function CarouselButton({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next';
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const sideCls =
    direction === 'prev'
      ? 'left-3 sm:left-5'
      : 'right-3 sm:right-5';
  const path =
    direction === 'prev' ? 'M14 6 L8 12 L14 18' : 'M10 6 L16 12 L10 18';
  return (
    <button
      type="button"
      aria-label={direction === 'prev' ? 'Previous' : 'Next'}
      onClick={onClick}
      className={`absolute top-1/2 z-20 -translate-y-1/2 ${sideCls} flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(9,9,11,0.55)] text-white backdrop-blur transition-colors hover:bg-[rgba(9,9,11,0.85)]`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    </button>
  );
}

function Dots({
  count,
  index,
  onSelect,
}: {
  count: number;
  index: number;
  onSelect: (next: number) => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
      {Array.from({ length: count }, (_, i) => i).map((slot) => {
        const active = slot === index;
        return (
          <button
            key={slot}
            type="button"
            aria-label={`Slide ${slot + 1}`}
            onClick={(event) => {
              event.preventDefault();
              onSelect(slot);
            }}
            className={`h-[7px] rounded-full transition-[width,background-color] duration-200 ${
              active ? 'w-7 bg-white' : 'w-[7px] bg-white/40 hover:bg-white/70'
            }`}
          />
        );
      })}
    </div>
  );
}
