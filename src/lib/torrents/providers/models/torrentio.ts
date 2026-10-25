import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** One Torrentio stream; the human `title` carries the emoji-delimited metadata. @public */
export const torrentioStreamSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  infoHash: z.string().optional(),
});
export type TorrentioStream = z.infer<typeof torrentioStreamSchema> & ApiModel;

/** Torrentio's `/stream/movie/{id}.json` response. @public */
export const torrentioResponseSchema = z.object({
  streams: z.array(torrentioStreamSchema).optional(),
});
export type TorrentioResponse = z.infer<typeof torrentioResponseSchema> &
  ApiModel;
