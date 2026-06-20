/**
 * @packageDocumentation
 *
 * Types shared across the Web Push library: the subscription shape sent
 * by the browser and the per-message envelope.
 */

/** Subscription record as stored in D1. @public */
export interface PushSubscriptionRecord {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/** JSON payload the client service worker receives. @public */
export interface PushPayload {
  readonly title: string;
  readonly body: string;
  readonly image?: string;
  readonly tag?: string;
  readonly url?: string;
}

/** Outcome of one delivery attempt. @public */
export interface DeliveryResult {
  readonly endpoint: string;
  readonly status: number;
  /**
   * `true` when the push endpoint signalled the subscription is gone
   * (HTTP 404/410) and we should drop it from D1.
   */
  readonly gone: boolean;
}
