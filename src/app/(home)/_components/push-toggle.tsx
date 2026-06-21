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
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

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
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError(`Permission ${permission}`);
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
      const postResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!postResponse.ok) {
        setError(`Server returned ${postResponse.status}`);
        return;
      }
      setState('subscribed');
    } catch (err) {
      setError(
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const onSendTest = useCallback(async () => {
    setBusy(true);
    setTestStatus(null);
    setError(null);
    try {
      const response = await fetch('/api/push/trigger', { method: 'POST' });
      const json = (await response.json()) as {
        ok: boolean;
        instanceId?: string;
        error?: string;
      };
      if (json.ok) {
        setTestStatus(`Sent (workflow ${json.instanceId?.slice(0, 8)})`);
      } else {
        setError(json.error ?? 'Trigger failed');
      }
    } catch (err) {
      setError(
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      );
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
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onUnsubscribe}
          disabled={busy}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
        >
          🔔 Subscribed
        </button>
        <button
          type="button"
          onClick={onSendTest}
          disabled={busy}
          className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
        >
          🚀 Send test
        </button>
        {testStatus ? (
          <span className="text-[11px] text-slate-500">{testStatus}</span>
        ) : null}
        {error ? (
          <span className="text-[11px] text-red-600" title={error}>
            ✗ {error.slice(0, 40)}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onSubscribe}
        disabled={busy}
        className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-60"
      >
        🔔 Notify
      </button>
      {error ? (
        <span className="text-[11px] text-red-600" title={error}>
          ✗ {error.slice(0, 40)}
        </span>
      ) : null}
    </span>
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
