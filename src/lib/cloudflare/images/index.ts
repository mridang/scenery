/**
 * @packageDocumentation
 *
 * The client-safe surface of the image proxy: building our own `/img`
 * addresses for pictures on other sites, and deciding which are ours to
 * proxy. This is pure render code with no platform binding — the server side
 * (the ImageService and the Cloudflare runtime) is in `./server`.
 */

export { imageSrc, imageSrcSet, isProxyableUrl } from './address';
