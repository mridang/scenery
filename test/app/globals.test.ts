import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

const POINTER_CURSOR_RULE =
  /(button:not\(:disabled\),[^{]*)\{\s*cursor: pointer;/u;
const BARE_BUTTON_SELECTOR = /(^|,)\s*button,/u;

const css = await readFile(
  path.join(process.cwd(), 'src', 'app', 'globals.css'),
  'utf8',
);

describe('globals.css', () => {
  describe('cursor', () => {
    const rule = POINTER_CURSOR_RULE.exec(css)?.[1];

    it('is the pointer for anything clickable, since Tailwind 4 no longer gives buttons one', () => {
      for (const selector of [
        'button:not(:disabled)',
        'summary',
        'select:not(:disabled)',
      ]) {
        expect(rule).toContain(selector);
      }
      expect(rule).toContain("[role='button']");
    });

    it('is left alone for disabled controls', () => {
      expect(rule).not.toMatch(BARE_BUTTON_SELECTOR);
      expect(rule).toContain(':not(:disabled)');
    });
  });
});
