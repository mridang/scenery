import type { ReactElement, ReactNode } from 'react';

import { Logo } from '@/components/site/logo';
import { Container, Heading } from '@/components/ui/layout';

/** A day as people write it, from an ISO date: "1 November 2026". */
export function longDate(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

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

/** A titled block of a legal page: a heading, then its text or list. */
export function LegalSection({
  title,
  children,
}: Readonly<{
  title: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <section>
      <Heading variant="h3" className="text-ink">
        {title}
      </Heading>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A list item with a marker in the brand colour, so lists read as part of the brand. */
export function LegalItem({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-[0.65rem] size-1.5 shrink-0 rounded-full bg-brand"
      />
      <span>{children}</span>
    </li>
  );
}
