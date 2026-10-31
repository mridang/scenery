import { describe, expect, it } from '@jest/globals';

import { LEGAL_LINKS, SiteFooter } from '@/components/site/site-footer';
import { html } from '../render';

describe('SiteFooter', () => {
  const out = html(
    <SiteFooter
      count={3}
      total={5}
      avgScore={71}
      lastUpdate={{
        scrapeAt: null,
        scrapeSource: null,
        enrichAt: null,
        torrentsAt: null,
        torrentsProvider: null,
      }}
      nowMs={0}
    />,
  );

  it('links the privacy policy and the terms', () => {
    expect(LEGAL_LINKS.map((link) => link.href)).toEqual([
      '/privacy',
      '/terms',
    ]);
    expect(out).toMatch(/<a [^>]*href="\/privacy"[^>]*>Privacy<\/a>/);
    expect(out).toMatch(/<a [^>]*href="\/terms"[^>]*>Terms<\/a>/);
  });

  it('shows how many movies are shown of how many', () => {
    expect(out).toMatch(/>3<\/span> of\s*5\s*shown/);
  });
});
