import { describe, expect, it } from '@jest/globals';

import { requestPage } from '@/lib/sources/request-page';

describe('requestPage', () => {
  it('returns ok with the body and headers on a 200', async () => {
    const transport = (() =>
      Promise.resolve(
        new Response('<html>ok</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )) as unknown as typeof fetch;

    const result = await requestPage(transport, 'https://example.test/');

    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.html).toBe('<html>ok</html>');
    expect(result.byteSize).toBe('<html>ok</html>'.length);
    expect(result.responseHeaders?.['content-type']).toBe('text/html');
    expect(result.error).toBeUndefined();
  });

  it('returns not-ok with the status and partial body on a non-2xx', async () => {
    const transport = (() =>
      Promise.resolve(
        new Response('blocked', { status: 403 }),
      )) as unknown as typeof fetch;

    const result = await requestPage(transport, 'https://example.test/');

    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(403);
    expect(result.error).toContain('403');
    expect(result.html).toBe('blocked');
    expect(result.byteSize).toBe('blocked'.length);
  });

  it('returns not-ok with the error message when the transport throws', async () => {
    const transport = (() =>
      Promise.reject(new Error('network down'))) as unknown as typeof fetch;

    const result = await requestPage(transport, 'https://example.test/');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('network down');
    expect(result.byteSize).toBe(0);
    expect(result.html).toBeUndefined();
  });

  it('stringifies non-Error throws', async () => {
    const transport = (() => Promise.reject('boom')) as unknown as typeof fetch;

    const result = await requestPage(transport, 'https://example.test/');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
    expect(result.byteSize).toBe(0);
  });
});
