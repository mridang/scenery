import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** One Torrentio stream; the human `title` carries the emoji-delimited metadata. @public */
export const TorrentioStreamSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  infoHash: z.string().optional(),
});
export type TorrentioStream = z.infer<typeof TorrentioStreamSchema> & ApiModel;

/** Torrentio's `/stream/movie/{id}.json` response. @public */
export const TorrentioResponseSchema = z.object({
  streams: z.array(TorrentioStreamSchema).optional(),
});
export type TorrentioResponse = z.infer<typeof TorrentioResponseSchema> &
  ApiModel;
