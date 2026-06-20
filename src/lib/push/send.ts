/**
 * @packageDocumentation
 *
 * Composes a single Web Push delivery: encrypt the payload, sign the
 * VAPID JWT, POST to the subscription endpoint, classify the response.
 */

import { bs } from './encode';
import { encryptPayload } from './encrypt';
import { signVapidAuthHeader } from './vapid';
import type {
  DeliveryResult,
  PushPayload,
  PushSubscriptionRecord,
} from './types';

/** VAPID identity configuration. @public */
export interface VapidConfig {
  /** Application server public key (uncompressed P-256, base64url). */
  readonly publicKey: string;
  /** Application server private key (`d` scalar, base64url). */
  readonly privateKey: string;
  /** `mailto:` or `https://` contact URL the push service can reach. */
  readonly subject: string;
}

/**
 * Send one Web Push notification. The TTL controls how long the push
 * service may queue the message if the device is offline; we use one
 * hour, which is sensible for a daily timely update (the next one will
 * supersede a stale undelivered one anyway).
 *
 * @public
 */
export async function sendPush(opts: {
  readonly subscription: PushSubscriptionRecord;
  readonly payload: PushPayload;
  readonly vapid: VapidConfig;
  readonly ttlSeconds?: number;
  readonly nowSeconds?: number;
  readonly fetcher?: typeof fetch;
}): Promise<DeliveryResult> {
  const endpoint = opts.subscription.endpoint;
  const audience = new URL(endpoint).origin;
  const nowSeconds = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const fetcher = opts.fetcher ?? globalThis.fetch;

  const plaintext = new TextEncoder().encode(JSON.stringify(opts.payload));
  const encrypted = await encryptPayload({
    plaintext,
    subscriberPublicKeyB64u: opts.subscription.p256dh,
    subscriberAuthB64u: opts.subscription.auth,
  });

  const authorization = await signVapidAuthHeader({
    audience,
    subject: opts.vapid.subject,
    publicKeyB64u: opts.vapid.publicKey,
    privateKeyB64u: opts.vapid.privateKey,
    nowSeconds,
  });

  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttlSeconds ?? 3600),
      Urgency: 'normal',
    },
    body: bs(encrypted.body),
  });

  return {
    endpoint,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
  };
}
