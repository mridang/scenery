import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { Eyebrow, Heading } from '@/components/ui/layout';
import { CONTACT_EMAIL, SOURCE_URL, TERMS_LAST_UPDATED } from '@/utils/site';

import {
  LegalFrame,
  LegalItem,
  LegalSection,
  longDate,
} from '@/app/(site)/privacy/_components/legal-section';

/**
 * A public page: it may be indexed, and it carries its own social card (the
 * image comes from the site-wide one).
 */
export const metadata: Metadata = pageMetadata({
  title: 'Terms',
  description:
    'The terms for using scenery: it lists what others publish, hosts no files, and comes without warranty.',
  path: '/terms',
  index: true,
});

/**
 * Terms of service. Short and plain, in the same layout as the privacy policy.
 */
export default function TermsPage(): ReactElement {
  return (
    <LegalFrame>
      <div className="max-w-2xl">
        <Eyebrow>Terms</Eyebrow>
        <Heading as="h1" variant="h1" className="mt-2 text-ink">
          Terms of Service
        </Heading>
        <p className="mt-3 text-sm text-muted">
          Last updated: {longDate(TERMS_LAST_UPDATED)}
        </p>

        <div className="mt-8 space-y-9 text-lg leading-relaxed text-muted">
          <p>
            scenery is a free tracker of new movie releases. By using it you
            agree to these terms. If you don’t, please don’t use it.
          </p>

          <LegalSection title="Using scenery">
            <ul className="space-y-2">
              <LegalItem>
                scenery lists what others publish: ratings and details from
                public databases, and links that torrent indexes make public. It
                hosts no files, and it neither makes nor checks what those links
                point to.
              </LegalItem>
              <LegalItem>
                Whether you may download or share a film depends on the law
                where you are and on who holds its rights. That is for you to
                check, and what you download is your responsibility.
              </LegalItem>
              <LegalItem>
                Don’t use scenery to attack or overload it or the sites it reads
                from, or to get around its limits. The server limits how often
                anyone can call it.
              </LegalItem>
            </ul>
          </LegalSection>

          <LegalSection title="The scores">
            <p>
              Scores and rankings come from public ratings and a few simple
              rules. They are a guide, not a judgement of any film, and the data
              behind them can be late or wrong.
            </p>
          </LegalSection>

          <LegalSection title="The service">
            <p>
              scenery is provided as it is, without warranty of any kind. It may
              change, be unavailable or stop at any time, and as far as the law
              allows we are not liable for any loss from using it.
            </p>
          </LegalSection>

          <LegalSection title="Open source">
            <p>
              scenery’s code is open source under the Apache 2.0 licence, and is
              on{' '}
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring rounded-sm text-accent underline underline-offset-4 hover:text-ink"
              >
                GitHub
              </a>
              . That licence, not these terms, covers the code.
            </p>
          </LegalSection>

          <LegalSection title="Your data">
            <p>
              What scenery keeps, and how to delete it, is in the{' '}
              <Link
                href="/privacy"
                className="focus-ring rounded-sm text-accent underline underline-offset-4 hover:text-ink"
              >
                privacy policy
              </Link>
              .
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>{CONTACT_EMAIL}</p>
          </LegalSection>
        </div>

        <Link
          href="/"
          className="focus-ring mt-12 inline-flex h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          Back to scenery
        </Link>
      </div>
    </LegalFrame>
  );
}
