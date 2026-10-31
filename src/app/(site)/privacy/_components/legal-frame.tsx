import type { ReactElement, ReactNode } from 'react';

import { Logo } from '@/components/site/logo';
import { Container } from '@/components/ui/layout';

/**
 * The frame of a legal page: the wordmark linking home, then the page's own
 * `<main>`. The catalog's header and footer show the catalog's counts, which a
 * legal page has no use for, so it draws this lighter strip instead.
 */
export function LegalFrame({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <>
      <header className="border-b border-line">
        <div className="flex w-full items-center p-4 sm:px-7 2xl:px-12">
          <Logo />
        </div>
      </header>
      <main id="main">
        <Container className="py-10 sm:py-16">{children}</Container>
      </main>
    </>
  );
}
