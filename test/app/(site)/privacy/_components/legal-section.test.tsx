import { describe, expect, it } from '@jest/globals';

import {
  LegalFrame,
  LegalItem,
  LegalSection,
  longDate,
} from '@/app/(site)/privacy/_components/legal-section';
import { classOf, html } from '../../../../components/render';

describe('LegalFrame', () => {
  const out = html(
    <LegalFrame>
      <p>The policy.</p>
    </LegalFrame>,
  );

  it('heads the page with the wordmark linking home', () => {
    expect(out).toMatch(/^<header[^>]*>.*<a href="\/"/);
    expect(out).toContain('scenery');
  });

  it('puts its content in the main landmark the skip link jumps to', () => {
    expect(out).toMatch(/<main id="main">.*The policy\..*<\/main>/);
  });
});

describe('LegalSection', () => {
  it('is a section headed by its title, followed by its content', () => {
    const out = html(
      <LegalSection title="What we store">
        <p>Your subscription.</p>
      </LegalSection>,
    );
    expect(out).toContain('<section>');
    expect(out).toMatch(/<h2[^>]*>What we store<\/h2>/);
    expect(out.indexOf('What we store')).toBeLessThan(
      out.indexOf('Your subscription.'),
    );
  });
});

describe('LegalItem', () => {
  it('is a list item with a decorative marker hidden from assistive technology', () => {
    const out = html(<LegalItem>Your keys.</LegalItem>);
    expect(out).toContain('<li');
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('Your keys.');
    expect(classOf(out, 'span')).toContain('bg-brand');
  });
});

describe('longDate', () => {
  it('writes an ISO day as day, month name and year', () => {
    expect(longDate('2026-11-01')).toBe('1 November 2026');
  });

  it('reads the day in UTC, so it never slips to the day before', () => {
    expect(longDate('2026-01-01')).toBe('1 January 2026');
  });
});
