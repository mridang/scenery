import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/**
 * One apibay stream row. apibay sends every field as a string (sizes, seeder
 * counts and epochs included); the schema models that quirk as strings and the
 * provider does the numeric mapping with its null guards. @public
 */
export const ApibayStreamSchema = z.object({
  info_hash: z.string(),
  name: z.string(),
  size: z.string().optional(),
  seeders: z.string().optional(),
});
export type ApibayStream = z.infer<typeof ApibayStreamSchema> & ApiModel;

/** apibay's `q.php` response: a bare array of streams. @public */
export const ApibayResponseSchema = z.array(ApibayStreamSchema);
export type ApibayResponse = z.infer<typeof ApibayResponseSchema>;
