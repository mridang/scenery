import type { ReactElement, ReactNode } from 'react';

import { SkipLink } from './skip-link';

/**
 * The frame shared by every page: the skip link, then the page. The header and
 * footer are drawn by the page itself, because both show what the page shows
 * (the search box, the counts and the freshness of the data), which a layout
 * cannot see. The page's `<main>` carries the `id="main"` the skip link jumps to.
 */
export function SiteShell({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <>
      <SkipLink />
      {children}
    </>
  );
}
