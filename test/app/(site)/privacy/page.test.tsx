import { describe, expect, it } from '@jest/globals';

import PrivacyPage, { metadata } from '@/app/(site)/privacy/page';
import { html } from '../../../components/render';

describe('PrivacyPage', () => {
  const out = html(<PrivacyPage />);

  it('has one heading, the policy’s title', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Privacy Policy<\/h1>/);
  });

  it('says when it last changed', () => {
    expect(out).toContain('Last updated: 1 November 2026');
  });

  it('has a section for each part of the policy', () => {
    for (const heading of [
      'What we access',
      'What we store',
      'Notifications',
      'Pictures and downloads',
      'Cookies and logs',
      'What we don’t do',
      'Deleting your data',
      'Contact',
    ]) {
      expect(out).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`));
    }
  });

  it('says there are no accounts and no cookies', () => {
    expect(out).toContain('It has no accounts and no sign-in');
    expect(out).toContain('Scenery sets no cookies');
  });

  it('names what a push subscription keeps and when it is deleted', () => {
    expect(out).toContain('your browser’s push subscription');
    expect(out).toContain('we delete your subscription then');
  });

  it('gives an address to write to', () => {
    expect(out).toContain('mridang.agarwalla@gmail.com');
  });

  it('links the terms and back home', () => {
    expect(out).toMatch(/<a [^>]*href="\/terms"[^>]*>terms of service<\/a>/);
    expect(out).toMatch(/<a [^>]*href="\/"[^>]*>.*Back to Scenery<\/a>/);
  });
});

describe('the privacy page’s metadata', () => {
  it('may be indexed', () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe('/privacy');
  });

  it('has its own social card', () => {
    expect(metadata.openGraph?.url).toBe('/privacy');
    expect(metadata.title).toBe('Privacy');
    expect(metadata.twitter?.title).toBe('Privacy · Scenery');
  });
});
