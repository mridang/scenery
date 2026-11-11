/**
 * @packageDocumentation
 *
 * Request/response models for the torrent providers: a Zod schema + type per
 * provider response, modelling each API's quirks.
 */

export { ApibayStreamSchema, ApibayResponseSchema } from './apibay-response';
export type { ApibayStream, ApibayResponse } from './apibay-response';
export {
  TorrentioStreamSchema,
  TorrentioResponseSchema,
} from './torrentio-response';
export type { TorrentioStream, TorrentioResponse } from './torrentio-response';
