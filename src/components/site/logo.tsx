import type { ReactElement } from 'react';

import { BRAND_NAME } from '@/app/_brand';
import { cn } from '@/components/ui/cn';

/**
 * The app's mark: two stacked parallelograms, the second a little fainter.
 * Drawn inline so it sits on the same paint pass as the wordmark and never
 * flashes a missing-icon gap. Size it with a class (`size-14`); it takes the
 * brand colour unless a class sets another.
 */
export function BrandMark({
  className,
}: Readonly<{ className?: string }>): ReactElement {
  return (
    <svg
      viewBox="0 0 32 28"
      fill="currentColor"
      aria-hidden="true"
      className={cn('block text-brand', className)}
    >
      <path d="M9 3 L26 3 L20 13 L3 13 Z" />
      <path d="M12 15 L29 15 L23 25 L6 25 Z" opacity={0.72} />
    </svg>
  );
}

/** The wordmark: the mark and the name, linking home. Used in the site header. */
export function Logo({
  className,
}: Readonly<{ className?: string }>): ReactElement {
  return (
    <a
      href="/"
      className={cn(
        'flex items-center gap-[13px] text-inherit no-underline',
        className,
      )}
    >
      <BrandMark className="h-10 w-[46px]" />
      <span className="text-[29px] font-bold tracking-[-0.03em]">
        {BRAND_NAME}
      </span>
    </a>
  );
}
