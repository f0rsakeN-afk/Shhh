import type { NextConfig } from "next";

// CSP keywords must be single-quoted ('self', 'unsafe-inline', 'none').
// Unquoted values are parsed as hostnames and match nothing, which makes the
// browser block the app's own fonts, styles, scripts, and API calls.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  // WebSocket needed for chat; http://localhost:* keeps devtool/HMR endpoints working locally.
  "connect-src 'self' ws: wss:",
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
