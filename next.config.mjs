import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import withSerwistInit from "@serwist/next";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const isDev = process.env.NODE_ENV === 'development'

// CSP: restrictive baseline, loosened only where the audio pipeline requires it.
// 'unsafe-eval' is dev-only (webpack eval source maps); production strips it.
const cspValue = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  isDev ? "connect-src 'self' ws:" : "connect-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "font-src 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspValue },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'microphone=(self), camera=(), geolocation=()',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  turbopack: {},
  webpack(config) {
    // OpenSSL 3.x (Node 18+) disables md4. Webpack's WASM fallback crashes
    // on Windows. Use sha256 instead — universally supported.
    config.output.hashFunction = 'sha256'
    return config
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    unoptimized: true,
  },
}

export default withSerwist(nextConfig)
