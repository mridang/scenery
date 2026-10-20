import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { scrapingAntTransport } from '../../../../src/lib/transport/providers/scrapingant';

const realFetch = globalThis.fetch;
const ENDPOINT = 'https://api.scrapingant.com/v2/general';

type FetchStub = jest.Mock<typeof fetch>;

function stubFetch(): FetchStub {
  const stub = jest.fn<typeof fetch>(() => Promise.resolve(new Response('ok')));
  globalThis.fetch = stub;
  return stub;
}

function capturedUrl(stub: FetchStub): URL {
  const input = stub.mock.calls[0]?.[0];
  expect(input).toBeInstanceOf(URL);
  return input as URL;
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

describe('scrapingAntTransport', () => {
  it('throws when the API key is empty', () => {
    expect(() => scrapingAntTransport('')).toThrow(/API key/);
  });

  it('builds a ScrapingAnt URL with the target as the url param', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY');

    await transport('https://upstream.test/path?q=1');

    const url = capturedUrl(stub);
    expect(`${url.origin}${url.pathname}`).toBe(ENDPOINT);
    expect(url.searchParams.get('url')).toBe('https://upstream.test/path?q=1');
  });

  it('defaults browser mode to false', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY');

    await transport('https://upstream.test');

    expect(capturedUrl(stub).searchParams.get('browser')).toBe('false');
  });

  it('sets browser=true when the browser tier is requested', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY', { browser: true });

    await transport('https://upstream.test');

    expect(capturedUrl(stub).searchParams.get('browser')).toBe('true');
  });

  it('sends the api key as the x-api-key header with a GET method', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('SECRET');

    await transport('https://upstream.test');

    const init = capturedInit(stub);
    expect(init.method).toBe('GET');
    const headers = init.headers as Headers;
    expect(headers.get('x-api-key')).toBe('SECRET');
  });

  it('appends extra params to the ScrapingAnt URL', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY', {
      extraParams: { proxy_type: 'residential' },
    });

    await transport('https://upstream.test');

    expect(capturedUrl(stub).searchParams.get('proxy_type')).toBe(
      'residential',
    );
  });

  it('honours a custom endpoint override', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY', {
      endpoint: 'https://proxy.example/v2/x',
    });

    await transport('https://upstream.test');

    const url = capturedUrl(stub);
    expect(url.origin).toBe('https://proxy.example');
    expect(url.pathname).toBe('/v2/x');
  });

  it('resolves the target from a URL input', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY');

    await transport(new URL('https://upstream.test/x'));

    expect(capturedUrl(stub).searchParams.get('url')).toBe(
      'https://upstream.test/x',
    );
  });

  it('resolves the target from a Request input', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY');

    await transport(new Request('https://upstream.test/req'));

    expect(capturedUrl(stub).searchParams.get('url')).toBe(
      'https://upstream.test/req',
    );
  });

  it('uses a default AbortSignal timeout when none is provided', async () => {
    const stub = stubFetch();
    const transport = scrapingAntTransport('KEY');

    await transport('https://upstream.test');

    const init = capturedInit(stub);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves a caller-provided signal', async () => {
    const stub = stubFetch();
    const controller = new AbortController();
    const transport = scrapingAntTransport('KEY');

    await transport('https://upstream.test', { signal: controller.signal });

    const init = capturedInit(stub);
    expect(init.signal).toBe(controller.signal);
  });
});
