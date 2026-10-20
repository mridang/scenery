'use client';

import type { ReactElement } from 'react';

import { InstallIosHint } from './install-ios-hint';
import { useInstallPrompt } from './use-install-prompt';

/**
 * "Install app" in the header's menu: shown only where the browser can
 * install the app (Chrome and Edge, until it is installed), with the
 * "Add to Home Screen" tip in its place for Safari on an iPhone or iPad, which
 * has no install button to offer.
 */
export function InstallButton(): ReactElement {
  const { install } = useInstallPrompt();
  return (
    <>
      {install ? (
        <button
          type="button"
          onClick={() => void install()}
          className="rounded-md px-3 py-2 text-left text-[12.5px] font-medium text-[#d4d4d8] hover:bg-white/5"
        >
          Install app
        </button>
      ) : null}
      <InstallIosHint />
    </>
  );
}
