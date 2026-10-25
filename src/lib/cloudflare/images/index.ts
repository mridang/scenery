/**
 * @packageDocumentation
 *
 * Cloudflare image proxy: build our own `/img` addresses for pictures on other
 * sites (pure), fetch + resize them through the `IMAGES` binding and keep them
 * in the edge cache (the platform runtime), and serve one request. This vendor
 * package is the one place in `lib` that reaches for Cloudflare bindings.
 */

export { imageSrc, imageSrcSet } from './address';
export { serveImage } from './service';
export type { ImageAccess, ImageServiceDeps } from './service';
export { imagesBinding, imageCache, runInBackground } from './runtime';
export * as access from './access';
