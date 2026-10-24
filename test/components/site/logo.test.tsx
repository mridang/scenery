import { describe, expect, it } from '@jest/globals';

import { BRAND_NAME } from '@/app/_brand';
import { BrandMark, Logo } from '@/components/site/logo';
import { classOf, html } from '@test/components/render';

describe('Logo', () => {
  it('is the mark and the name, linking home', () => {
    const out = html(<Logo />);
    expect(out).toContain('href="/"');
    expect(out).toContain('<svg');
    expect(out).toContain(BRAND_NAME);
  });

  it('accepts extra classes', () => {
    expect(classOf(html(<Logo className="mt-2" />), 'a')).toContain('mt-2');
  });
});

describe('BrandMark', () => {
  it('is a decorative drawing in the brand colour, sized by its class', () => {
    const out = html(<BrandMark className="size-14" />);
    expect(out).toContain('aria-hidden="true"');
    expect(classOf(out, 'svg')).toContain('text-brand');
    expect(classOf(out, 'svg')).toContain('size-14');
  });
});
