import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { genericTransport } from '@/lib/transport/providers/generic';

const realFetch = globalThis.fetch;

type FetchStub = jest.Mock<typeof fetch>;

function stubFetch(): FetchStub {
  const stub = jest.fn<typeof fetch>(() => Promise.resolve(new Response('ok')));
  globalThis.fetch = stub;
  return stub;
}

function capturedInit(stub: FetchStub): RequestInit {
  const init = stub.mock.calls[0]?.[1];
  expect(init).toBeDefined();
  return init ?? {};
}

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('genericTransport', () => {
  it('returns a fetch-like that delegates to globalThis.fetch', async () => {
    const stub = stubFetch();

    const transport = genericTransport();
    await transport('https://example.test');

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub.mock.calls[0]?.[0]).toBe('https://example.test');
  });

  it('supplies a default AbortSignal timeout when none is given', async () => {
    const stub = stubFetch();

    const transport = genericTransport();
    await transport('https://example.test');

    const init = capturedInit(stub);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves a caller-provided signal instead of the default timeout', async () => {
    const stub = stubFetch();

    const controller = new AbortController();
    const transport = genericTransport();
    await transport('https://example.test', { signal: controller.signal });

    const init = capturedInit(stub);
    expect(init.signal).toBe(controller.signal);
  });

  it('spreads through other init options (e.g. method, headers)', async () => {
    const stub = stubFetch();

    const transport = genericTransport();
    await transport('https://example.test', {
      method: 'POST',
      headers: { 'x-test': '1' },
    });

    const init = capturedInit(stub);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-test': '1' });
  });

  it('honours a custom timeout option (still an AbortSignal)', async () => {
    const stub = stubFetch();

    const transport = genericTransport({ timeoutMs: 1 });
    await transport('https://example.test');

    const init = capturedInit(stub);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
