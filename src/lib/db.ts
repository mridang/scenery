import { getCloudflareContext } from '@opennextjs/cloudflare';

export function getDB(): D1Database {
  return getCloudflareContext().env.DB;
}

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}
