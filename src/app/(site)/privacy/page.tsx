import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { CONTACT_EMAIL, PRIVACY_LAST_UPDATED } from '@/utils/site';

import {
  LegalItem,
  LegalLink,
  LegalPage,
  LegalSection,
} from '@/app/(site)/privacy/_components/legal-section';
import { LegalFrame } from '@/app/(site)/privacy/_components/legal-frame';

/**
 * A public page: it may be indexed, and it carries its own social card (the
 * image comes from the site-wide one).
 */
export const metadata: Metadata = pageMetadata({
  title: 'Privacy',
  description:
    'What scenery keeps about you: no accounts, no tracking, and only the push subscription you choose to give it.',
  path: '/privacy',
  index: true,
});

/**
 * Privacy policy: a plain statement of what scenery keeps about the people who
 * use it, which is very little, as it has no accounts. Kept short and concrete.
 */
export default function PrivacyPage(): ReactElement {
  return (
    <LegalFrame>
      <LegalPage
        eyebrow="Privacy"
        title="Privacy Policy"
        updated={PRIVACY_LAST_UPDATED}
      >
        <p>
          scenery is a personal tracker of new movie releases. It has no
          accounts and no sign-in: everyone sees the same catalog. This policy
          explains the little it keeps about the people who use it.
        </p>

        <LegalSection title="What we access">
          <p>
            Nothing about you. scenery has no accounts and no sign-in, and asks
            no other service for anything about the people who use it.
          </p>
        </LegalSection>

        <LegalSection title="What we store">
          <ul className="space-y-2">
            <LegalItem>
              The catalog itself: movies, their ratings and the downloads found
              for them, gathered from public sources. None of it is about you.
            </LegalItem>
            <LegalItem>
              Only if you turn on notifications: your browser’s push
              subscription (the address of your browser’s push service and the
              two keys that encrypt messages to it), when it was made, and when
              we last sent to it. It is used for one notification a day at 17:00
              UTC with the five best new movies, and holds nothing else about
              you.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="Notifications">
          <p>
            Notifications reach you through the push service of your browser’s
            maker (Google, Apple or Mozilla, for example), which sees that a
            message was sent but cannot read it. When you turn notifications
            off, the push service tells us the next time we send, and we delete
            your subscription then.
          </p>
        </LegalSection>

        <LegalSection title="Pictures and downloads">
          <p>
            Posters and other pictures are fetched by scenery’s server and
            passed on to you, so the sites they come from see a request from
            scenery rather than from your browser. A download link opens a
            magnet link in your own torrent client: from then on your client
            talks to other people directly, and scenery is not involved.
          </p>
        </LegalSection>

        <LegalSection title="Cookies and logs">
          <ul className="space-y-2">
            <LegalItem>
              scenery sets no cookies, and has no advertising, analytics or
              trackers.
            </LegalItem>
            <LegalItem>
              On an iPhone or iPad, your browser remembers in its own storage
              that you dismissed the tip on adding scenery to the home screen.
              That stays on your device and is never sent to us.
            </LegalItem>
            <LegalItem>
              A service worker lets scenery be installed and show notifications.
              It keeps only the page shown when you are offline.
            </LegalItem>
            <LegalItem>
              Cloudflare, which hosts scenery, records each request (the address
              it came from, the page asked for, the time and the result) in logs
              that we use to keep the service running and secure. Search text is
              stripped from the addresses before they are logged. The logs are
              kept for a short time and are not used to profile you.
            </LegalItem>
            <LegalItem>
              The number of requests from each network address is counted for a
              minute at a time, to stop any one caller from overloading the
              service.
            </LegalItem>
            <LegalItem>
              When your browser blocks something on a page for security, it may
              send us a report of what it blocked. We log it to fix the page.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="What we don’t do">
          <p>
            We don’t sell or share anything about you, or show ads. scenery runs
            on Cloudflare, which processes the data above for us. Looking up
            movies sends only their titles and identifiers to The Movie
            Database, OMDb and the torrent indexes, never anything about you.
          </p>
        </LegalSection>

        <LegalSection title="Deleting your data">
          <p>
            Turn notifications off in your browser at any time: the push service
            tells us the next time we send, and we delete your subscription
            then. There is nothing else about you to delete. The terms of using
            scenery are in the{' '}
            <LegalLink href="/terms">terms of service</LegalLink>.
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>{CONTACT_EMAIL}</p>
        </LegalSection>
      </LegalPage>
    </LegalFrame>
  );
}
