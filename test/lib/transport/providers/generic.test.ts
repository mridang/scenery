import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { genericTransport } from '../../../../src/lib/transport/providers/generic';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('genericTransport', () => {
  it('returns a fetch-like that delegates to globalThis.fetch', async () => {
    const stub = jest.fn(() => Promise.resolve(new Response('ok')));
    globalThis.fetch = stub as unknown as typeof fetch;

    const transport = genericTransport();
    await transport('https://example.test');

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub.mock.calls[0][0]).toBe('https://example.test');
  });

  it('supplies a default AbortSignal timeout when none is given', async () => {
    const stub = jest.fn(() => Promise.resolve(new Response('ok')));
    globalThis.fetch = stub as unknown as typeof fetch;

    const transport = genericTransport();
    await transport('https://example.test');

    const init = stub.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves a caller-provided signal instead of the default timeout', async () => {
    const stub = jest.fn(() => Promise.resolve(new Response('ok')));
    globalThis.fetch = stub as unknown as typeof fetch;

    const controller = new AbortController();
    const transport = genericTransport();
    await transport('https://example.test', { signal: controller.signal });

    const init = stub.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it('spreads through other init options (e.g. method, headers)', async () => {
    const stub = jest.fn(() => Promise.resolve(new Response('ok')));
    globalThis.fetch = stub as unknown as typeof fetch;

    const transport = genericTransport();
    await transport('https://example.test', {
      method: 'POST',
      headers: { 'x-test': '1' },
    });

    const init = stub.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-test': '1' });
  });

  it('honours a custom timeout option (still an AbortSignal)', async () => {
    const stub = jest.fn(() => Promise.resolve(new Response('ok')));
    globalThis.fetch = stub as unknown as typeof fetch;

    const transport = genericTransport({ timeoutMs: 1 });
    await transport('https://example.test');

    const init = stub.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
