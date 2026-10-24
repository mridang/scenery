import { describe, expect, it } from '@jest/globals';

import { ApiController, Problem, type RouteContext } from '@/core/api';
import { problems } from '@/lib/rest-json/problem';

const req = (method = 'GET') => new Request('https://x/thing', { method });

describe('ApiController', () => {
  it('defaults to a 200 JSON response of the handled output', async () => {
    const { GET } = new ApiController()
      .on({ method: 'GET', handle: () => ({ hello: 'world' }) })
      .handlers();
    const res = await GET!(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: 'world' });
  });

  it('honours a custom status, body and headers from encode', async () => {
    const { POST } = new ApiController()
      .on({
        method: 'POST',
        handle: () => ({ id: '7', secret: 'kept-out' }),
        encode: (out: { id: string }) => ({
          status: 201,
          body: { id: out.id },
          headers: { Location: `/thing/${out.id}` },
        }),
      })
      .handlers();
    const res = await POST!(req('POST'));
    expect(res.status).toBe(201);
    expect(res.headers.get('location')).toBe('/thing/7');
    expect(await res.json()).toEqual({ id: '7' });
  });

  it('sends an empty 204 when the output is undefined', async () => {
    const { DELETE } = new ApiController()
      .on({ method: 'DELETE', handle: () => undefined })
      .handlers();
    const res = await DELETE!(req('DELETE'));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('sends a thrown Problem from decode as its response', async () => {
    const { POST } = new ApiController()
      .on({
        method: 'POST',
        decode: () => {
          throw new Problem(problems.badRequest('nope'));
        },
        handle: () => ({ unreached: true }),
      })
      .handlers();
    const res = await POST!(req('POST'));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain(
      'application/problem+json',
    );
  });

  it('rejects via a Problem thrown while building the context', async () => {
    const { GET } = new ApiController({
      context: () => {
        throw new Problem(problems.unauthorized());
      },
    })
      .on({ method: 'GET', handle: () => ({ ok: true }) })
      .handlers();
    const res = await GET!(req());
    expect(res.status).toBe(401);
  });

  it('maps an unexpected error to a 500 problem by default', async () => {
    const { GET } = new ApiController()
      .on({
        method: 'GET',
        handle: () => {
          throw new Error('boom');
        },
      })
      .handlers();
    const res = await GET!(req());
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain(
      'application/problem+json',
    );
  });

  it('passes the dynamic-segment params through to the handler context', async () => {
    let seen = '';
    const { GET } = new ApiController<RouteContext>()
      .on({
        method: 'GET',
        handle: async (_input, ctx) => {
          seen = (await ctx.params)['id'] ?? '';
          return { seen };
        },
      })
      .handlers();
    await GET!(req(), { params: Promise.resolve({ id: 'abc' }) });
    expect(seen).toBe('abc');
  });
});
