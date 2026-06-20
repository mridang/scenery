'use client';

import { useCallback, useEffect, useState } from 'react';

type SubscriptionState = 'unknown' | 'unsupported' | 'idle' | 'subscribed';

/**
 * The "🔔 Notify" pill in the header. Three states from the user's
 * perspective:
 *
 *  - `unsupported` — the browser has no Push API (or notifications are
 *    blocked at the system level). We render the pill disabled with a
 *    short hint.
 *  - `idle` — push works but no subscription yet. Click subscribes,
 *    which triggers the OS permission prompt.
 *  - `subscribed` — already opted in. Click unsubscribes.
 *
 * The service worker is registered lazily on the first click so we
 * don't slow down the page render with an SW registration the user may
 * never need.
 */
export function PushToggle() {
  const [state, setState] = useState<SubscriptionState>(detectInitial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state !== 'unknown') {
      // Already resolved synchronously at mount (SSR'd 'unknown' branch
      // is gone). No async work needed.
      return;
    }
    void hasSubscription().then((subscribed) =>
      setState(subscribed ? 'subscribed' : 'idle'),
    );
  }, [state]);

  const onSubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setBusy(false);
        return;
      }
      const keyResponse = await fetch('/api/push/key');
      const { vapidPublicKey } = (await keyResponse.json()) as {
        vapidPublicKey: string;
      };
      const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
      // The PushSubscriptionOptions type wants BufferSource, but the
      // generic Uint8Array<T> trips strict TS because T could be a
      // SharedArrayBuffer. The runtime check is just "is it a typed
      // array" so the narrowing here is purely cosmetic.
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes as unknown as BufferSource,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      setState('subscribed');
    } finally {
      setBusy(false);
    }
  }, []);

  const onUnsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState('idle');
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === 'unknown') {
    return null;
  }
  if (state === 'unsupported') {
    return (
      <span
        title="Your browser doesn't support Web Push (iOS needs the site added to Home Screen first)."
        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-400"
      >
        🔕 Notify
      </span>
    );
  }
  if (state === 'subscribed') {
    return (
      <button
        type="button"
        onClick={onUnsubscribe}
        disabled={busy}
        className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
      >
        🔔 Subscribed
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSubscribe}
      disabled={busy}
      className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-60"
    >
      🔔 Notify
    </button>
  );
}

/**
 * Synchronous browser-support check. SSR returns 'unknown' (the only
 * stable initial value); a client-side mount returns 'unsupported'
 * immediately if any of the required APIs is missing, leaving 'unknown'
 * only when the second async subscription probe is still needed.
 */
function detectInitial(): SubscriptionState {
  if (typeof window === 'undefined') {
    return 'unknown';
  }
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported';
  }
  return 'unknown';
}

async function hasSubscription(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      return false;
    }
    const subscription = await reg.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * The browser PushManager wants the VAPID key as a `Uint8Array`, not a
 * base64url string — translate.
 */
function urlBase64ToUint8Array(input: string): Uint8Array {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const std = padded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}
