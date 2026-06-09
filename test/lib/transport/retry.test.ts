import { describe, expect, it, jest } from '@jest/globals';

import { isRetryableStatus, withRetry } from '@/lib/transport/retry';

const FAST = { baseDelayMs: 0, jitterMs: 0 } as const;

function res(status: number): Response {
  return new Response('', { status });
}

describe('isRetryableStatus', () => {
  it('retries 408, 429 and 5xx', () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });

  it('does not retry 2xx/3xx/4xx that are not 408/429, nor 6xx', () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(301)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(600)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns on the first successful attempt without retrying', async () => {
    const transport = jest.fn(() =>
      Promise.resolve(res(200)),
    ) as unknown as jest.Mock & typeof fetch;
    const wrapped = withRetry(transport as unknown as typeof fetch, FAST);

    const response = await wrapped('https://x');

    expect(response.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('retries on a retryable status then succeeds', async () => {
    const transport = jest
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    const wrapped = withRetry(transport as unknown as typeof fetch, FAST);

    const response = await wrapped('https://x');

    expect(response.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('retries on a thrown network error then succeeds', async () => {
    const transport = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(res(200));
    const wrapped = withRetry(transport as unknown as typeof fetch, FAST);

    const response = await wrapped('https://x');

    expect(response.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('gives up after the max attempts and returns the last response', async () => {
    const transport = jest.fn().mockResolvedValue(res(500));
    const wrapped = withRetry(transport as unknown as typeof fetch, {
      ...FAST,
      attempts: 3,
    });

    const response = await wrapped('https://x');

    expect(response.status).toBe(500);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('re-throws the error when all attempts throw', async () => {
    const transport = jest.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withRetry(transport as unknown as typeof fetch, {
      ...FAST,
      attempts: 2,
    });

    await expect(wrapped('https://x')).rejects.toThrow('boom');
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable status', async () => {
    const transport = jest.fn().mockResolvedValue(res(404));
    const wrapped = withRetry(transport as unknown as typeof fetch, FAST);

    const response = await wrapped('https://x');

    expect(response.status).toBe(404);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('clamps attempts to a minimum of one', async () => {
    const transport = jest.fn().mockResolvedValue(res(500));
    const wrapped = withRetry(transport as unknown as typeof fetch, {
      ...FAST,
      attempts: 0,
    });

    const response = await wrapped('https://x');

    expect(response.status).toBe(500);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('forwards input and init to the underlying transport', async () => {
    const transport = jest.fn().mockResolvedValue(res(200));
    const wrapped = withRetry(transport as unknown as typeof fetch, FAST);

    const init = { method: 'POST' };
    await wrapped('https://x', init);

    expect(transport).toHaveBeenCalledWith('https://x', init);
  });
});
