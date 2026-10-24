import { describe, expect, it } from '@jest/globals';

import { InstallButton } from '@/components/site/install-button';
import { html } from '../../components/render';

describe('InstallButton', () => {
  // Rendered on the server there is no browser to ask: nothing is offered until
  // the browser says the app can be installed, and the iOS tip is never shown
  // there (see install-ios-hint.test.tsx).
  it('offers nothing until the browser says the app can be installed', () => {
    expect(html(<InstallButton />)).toBe('');
  });
});
