/**
 * @packageDocumentation
 *
 * The server side of the image proxy: the {@link ImageService} handle that
 * answers one `/img` request, plus the Cloudflare runtime accessors it is fed
 * (the `IMAGES` binding, the edge cache, the after-response hook). Each
 * accessor comes back empty where the runtime has none (plain Node, tests), so
 * the proxy still works there, just without scaling or a cache. Client/render
 * code imports the package index instead; this module pulls in the platform.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';

import { isImagesBinding, type ImagesLike } from './proxy';
import { serveImage, type ImageCache, type ImageServiceDeps } from './service';

export type { ImageAccess } from './service';
export * as access from './access';

/** The Images binding, where the deployment has one. */
export function imagesBinding(): ImagesLike | undefined {
  try {
    const binding: unknown = Reflect.get(getCloudflareContext().env, 'IMAGES');
    return isImagesBinding(binding) ? binding : undefined;
  } catch {
    return undefined;
  }
}

/** Whether a value can be used as the edge cache: it answers `match` and `put`. */
function isCache(value: unknown): value is ImageCache {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'match') === 'function' &&
    typeof Reflect.get(value, 'put') === 'function'
  );
}

/** Cloudflare's per-location cache; absent when running under plain Node. */
export function imageCache(): ImageCache | undefined {
  const store: unknown = Reflect.get(globalThis, 'caches');
  const cache: unknown =
    typeof store === 'object' && store !== null
      ? Reflect.get(store, 'default')
      : undefined;
  return isCache(cache) ? cache : undefined;
}

/**
 * Run work after the response has been sent, without blocking it. A failure is
 * logged and swallowed, because storing a copy must never turn a good answer
 * into an error. Outside a Workers request the promise simply runs on its own.
 */
export function runInBackground(work: Promise<unknown>): void {
  const guarded = work.catch((err: unknown) => {
    console.error('image background task failed', err);
  });
  try {
    getCloudflareContext().ctx.waitUntil(guarded);
  } catch {
    // No request context: the promise already runs; nothing to extend.
  }
}

/**
 * Answers one `/img` request. Build it with the app's access rules and the
 * runtime pieces (the Images binding, the edge cache, the after-response hook),
 * then `serve` each request. A thin handle over {@link serveImage}.
 */
export class ImageService {
  public constructor(private readonly deps: ImageServiceDeps) {}

  /** Serve the picture named by the request's `url` and `w` params. */
  public serve(request: Request): Promise<Response> {
    return serveImage(request, this.deps);
  }
}
