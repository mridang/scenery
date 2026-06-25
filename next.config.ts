import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/**
 * Strict Content-Security-Policy. Everything renders from this origin —
 * posters and future media flow through `/api/img` which 301s to
 * `/cdn-cgi/image/...` (same origin to the browser), the static icons
 * are local SVGs under `/icons/`, the service worker is at `/sw.js`,
 * scripts/styles ship from `/_next/static/...`.
 *
 * Tailwind v4 inlines theme variables and Next inlines some runtime
 * bootstrap shims, so `style-src` and `script-src` accept
 * `'unsafe-inline'`. Everything that fetches data from a different
 * origin (TMDB, IMDb, OMDB, FCM, ScrapingAnt) runs server-side inside
 * the Worker, never from the page.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

void initOpenNextCloudflareForDev();

export default nextConfig;
