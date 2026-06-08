/**
 * @packageDocumentation
 *
 * Magnet-link construction and the dynamic tracker list. A standalone
 * concern: it turns a torrent's info hash into a `magnet:` URI and is
 * consumed by the UI (home page, RSS feed, the /magnet endpoint). It is
 * deliberately separate from `lib/torrents`, which is about *finding and
 * persisting* torrents — different responsibility, no shared state.
 */

export {
  buildMagnet,
  magnetPath,
  bestTrackers,
  isValidInfoHash,
} from './magnet';
