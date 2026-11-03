import type { NextConfig } from "next";

// CSP keywords must be single-quoted ('self', 'unsafe-inline', 'none').
// Unquoted values are parsed as hostnames and match nothing, which makes the
// browser block the app's own fonts, styles, scripts, and API calls.
// Realtime transport is EventSource over the same origin, so production is
// locked to 'self'; only dev HMR needs a (localhost-scoped) WebSocket.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  // React 19's dev-mode debugging features (callstack reconstruction) and
  // Turbopack HMR evaluate code strings, so dev needs 'unsafe-eval'.
  // Production never does, and must never be granted it.
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  process.env.NODE_ENV === "development"
    ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
    : "connect-src 'self'",
  // Production is HTTPS-only (HSTS), so mixed-content upgrades are safe.
  ...(process.env.NODE_ENV === "development" ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: csp,
      },
      // Standard hardening alongside the CSP (which already pins
      // frame-ancestors 'none', only held for legacy user agents).
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      // Origin-only cross-site: keyword names must never ride an external
      // Referer header into another site's logs.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // The app uses no powerful features; close them all explicitly.
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
    ]

    // Ephemeral content must never be written to a browser, proxy, or CDN
    // cache. Room documents and every API response carry no-store alongside
    // the app-wide security headers.
    const ephemeralHeaders = [
      ...securityHeaders,
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, max-age=0",
      },
      { key: "Pragma", value: "no-cache" },
    ]

    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/room/:path*", headers: ephemeralHeaders },
      { source: "/api/:path*", headers: ephemeralHeaders },
    ]
  },
};

export default nextConfig;
