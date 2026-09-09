import type { NextConfig } from 'next';
import path from 'node:path';
const api = process.env.API_INTERNAL_URL || 'http://127.0.0.1:5080';
const config: NextConfig = {
  // Vercel's adapter packages the app itself; standalone conflicts with Next 16.3 tracing.
  output: process.env.VERCEL === '1' ? undefined : 'standalone',
  turbopack: { root: path.resolve(import.meta.dirname) },
  async rewrites() {
    return [{ source: '/api/:path*', destination: api + '/api/:path*' }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${new URL(api).origin}; media-src 'self' blob:; frame-src https://www.instagram.com https://www.youtube-nocookie.com https://www.tiktok.com https://www.linkedin.com https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
};
export default config;
