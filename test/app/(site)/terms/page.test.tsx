import { describe, expect, it } from '@jest/globals';

import TermsPage, { metadata } from '@/app/(site)/terms/page';
import { html } from '../../../components/render';

describe('TermsPage', () => {
  const out = html(<TermsPage />);

  it('has one heading, the terms’ title', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Terms of Service<\/h1>/);
  });

  it('says when it last changed', () => {
    expect(out).toContain('Last updated: 1 November 2026');
  });

  it('has a section for each part of the terms', () => {
    for (const heading of [
      'Using Scenery',
      'The scores',
      'The service',
      'Open source',
      'Your data',
      'Contact',
    ]) {
      expect(out).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`));
    }
  });

  it('says Scenery hosts no files and downloads are the reader’s responsibility', () => {
    expect(out).toContain('It hosts no files');
    expect(out).toContain('what you download is your responsibility');
  });

  it('says the service has no warranty', () => {
    expect(out).toContain('without warranty of any kind');
  });

  it('links the source in a new tab', () => {
    expect(out).toMatch(
      /<a [^>]*href="https:\/\/github\.com\/mridang\/scenery"[^>]*target="_blank"[^>]*>GitHub<\/a>/,
    );
  });

  it('points to the privacy policy for data', () => {
    expect(out).toMatch(/<a [^>]*href="\/privacy"[^>]*>privacy policy<\/a>/);
  });

  it('links back home', () => {
    expect(out).toMatch(/<a [^>]*href="\/"[^>]*>.*Back to Scenery<\/a>/);
  });
});

describe('the terms page’s metadata', () => {
  it('may be indexed', () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe('/terms');
  });

  it('has its own social card', () => {
    expect(metadata.openGraph?.url).toBe('/terms');
    expect(metadata.title).toBe('Terms');
    expect(metadata.twitter?.title).toBe('Terms · Scenery');
  });
});
