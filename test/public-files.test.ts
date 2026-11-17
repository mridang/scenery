import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from '@jest/globals';

import { BRAND_NAME, BRAND_URL, SECURITY_CONTACT } from '@/app/_brand';

const BLOCKQUOTE_LINE = /\n> .+/u;
const H2_LINE = /\n## .+/u;
const WHAT_TO_EXPECT_TEXT = /What to expect/u;
const IN_SCOPE_TEXT = /In scope/u;
const OUT_OF_SCOPE_TEXT = /Out of scope/u;
const GOOD_FAITH_TEXT = /good faith/u;

const read = async (name: string) =>
  readFile(path.join(process.cwd(), 'public', name), 'utf8');

/** Plain-text files are served without a charset, so they must be ASCII. */
const NON_ASCII = /[\u0080-￿]/u;

describe('public/llms.txt', () => {
  let text: string;
  /** The part before `## Optional`: what an assistant should read first. */
  let main: string;

  beforeAll(async () => {
    text = await read('llms.txt');
    main = text.split('\n## Optional', 1)[0] ?? '';
  });

  it('follows the llms.txt shape: a title, a summary and sections of links', () => {
    expect(text.startsWith(`# ${BRAND_NAME}\n`)).toBe(true);
    expect(text).toMatch(BLOCKQUOTE_LINE);
    expect(text).toMatch(H2_LINE);
  });

  it('links only to this site, outside the Optional section', () => {
    const links = Array.from(
      main.matchAll(/\]\((https?:[^)]+)\)/gu),
      (m) => m[1]!,
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.startsWith(`${BRAND_URL}/`)).toBe(true);
    }
  });

  it('points to the security contact and policy, under Optional', () => {
    const optional = text.split('\n## Optional', 2)[1] ?? '';
    expect(optional).toContain(`${BRAND_URL}/.well-known/security.txt`);
    expect(optional).toContain(`${BRAND_URL}/security-policy.txt`);
  });

  it('is ASCII, since it is served with no charset', () => {
    expect(text).not.toMatch(NON_ASCII);
  });
});

describe('public/security-policy.txt', () => {
  let text: string;

  beforeAll(async () => {
    text = await read('security-policy.txt');
  });

  it('names the app and its address', () => {
    expect(text.startsWith(`${BRAND_NAME} security policy\n`)).toBe(true);
    expect(text).toContain(BRAND_URL);
  });

  it('says where to report, with the same contact security.txt gives', () => {
    expect(text).toContain(SECURITY_CONTACT.replace('mailto:', ''));
  });

  it('says what to expect, what is in scope and that good faith is safe', () => {
    expect(text).toMatch(WHAT_TO_EXPECT_TEXT);
    expect(text).toMatch(IN_SCOPE_TEXT);
    expect(text).toMatch(OUT_OF_SCOPE_TEXT);
    expect(text).toMatch(GOOD_FAITH_TEXT);
  });

  it('is ASCII, since it is served with no charset', () => {
    expect(text).not.toMatch(NON_ASCII);
  });
});

describe('public/_headers', () => {
  let file: string;

  beforeAll(async () => {
    file = await read('_headers');
  });

  it('caches the security policy for a day and lets other sites fetch it', () => {
    const block = file.split('\n/security-policy.txt\n', 2)[1] ?? '';
    expect(block).toContain('Cache-Control: public, max-age=86400');
    expect(block).toContain('Cross-Origin-Resource-Policy: cross-origin');
  });

  it('lets other sites load the icons, and re-checks the service worker every time', () => {
    expect(file.split('\n/icons/*\n', 2)[1] ?? '').toContain(
      'Cross-Origin-Resource-Policy: cross-origin',
    );
    expect(file.split('\n/sw.js\n', 2)[1] ?? '').toContain(
      'Cache-Control: no-cache',
    );
  });
});
