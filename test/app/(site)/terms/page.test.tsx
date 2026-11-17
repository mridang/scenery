import { describe, expect, it } from '@jest/globals';

import TermsPage, { metadata } from '@/app/(site)/terms/page';
import { html } from '../../../components/render';

const TERMS_OF_SERVICE_HEADING = /<h1[^>]*>Terms of Service<\/h1>/u;
const GITHUB_LINK =
  /<a [^>]*href="https:\/\/github\.com\/mridang\/scenery"[^>]*target="_blank"[^>]*>GitHub<\/a>/u;
const PRIVACY_POLICY_LINK =
  /<a [^>]*href="\/privacy"[^>]*>privacy policy<\/a>/u;
const BACK_TO_SCENERY_LINK = /<a [^>]*href="\/"[^>]*>.*Back to Scenery<\/a>/u;

describe('TermsPage', () => {
  const out = html(<TermsPage />);

  it('has one heading, the terms’ title', () => {
    expect(out.match(/<h1/gu)).toHaveLength(1);
    expect(out).toMatch(TERMS_OF_SERVICE_HEADING);
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
      expect(out).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`, 'u'));
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
    expect(out).toMatch(GITHUB_LINK);
  });

  it('points to the privacy policy for data', () => {
    expect(out).toMatch(PRIVACY_POLICY_LINK);
  });

  it('links back home', () => {
    expect(out).toMatch(BACK_TO_SCENERY_LINK);
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
