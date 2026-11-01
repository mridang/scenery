import { describe, expect, it } from '@jest/globals';

import { LegalFrame } from '@/app/(site)/privacy/_components/legal-frame';
import { html } from '../../../../components/render';

describe('LegalFrame', () => {
  const out = html(
    <LegalFrame>
      <p>The policy.</p>
    </LegalFrame>,
  );

  it('heads the page with the wordmark linking home', () => {
    expect(out).toMatch(/^<header[^>]*>.*<a href="\/"/);
    expect(out).toContain('Scenery');
  });

  it('puts its content in the main landmark the skip link jumps to', () => {
    expect(out).toMatch(/<main id="main">.*The policy\..*<\/main>/);
  });
});
