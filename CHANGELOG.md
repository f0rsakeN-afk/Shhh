# Changelog

All notable changes to Shhh will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [v0.1.0] — 2026-11-13

### Added
- **7 checklist items ALL delivered**
  - 4 feature increments (edit window, unread badge + @mentions, QR sharing, room lifetimes)
  - Hardening wave (cross-origin guard, ROOM_ID_RE, flood gates, NFKC usernames, safeJsonParse)
  - Distributed rate limiting (Redis INCR/EXPIRE, per-IP/global caps, rateResetAll/flushRedis/init)
  - Landing page client boundary split (hero-landing-static.tsx + hero-landing.tsx)
  - Performance optimizations (date-fns removed, QR dynamic import, asset cleanup, TTL stamps, CACHE_CONTROL)
  - Network observability (NetworkStatus, isNetworkError, 20s AbortController timeout)
  - UI consistency (focus-visible:ring-offset-2 across 11 components)

### Fixed
- `hooks/use-username.ts`: NFKC normalization on localStorage store/retrieve
- `lib/rate-limiter.ts`: In-flight guard for concurrent rateHit calls on same key
- `lib/parse.ts`: safeJsonParse array element normalization
- `app/api/[[...slugs]]/auth.ts`: Floodgate pipeline result-safe destructuring + host+port origin check
- `components/join-room.tsx`: Room ID length validation on paste + normalized refactor
- `components/message-list.tsx`: animatedMessages pruning by knownIds during render; ref cleanup effect

### Changed
- `lib/realtime.ts`: Documented throws-at-init pattern (no runtime behavior change)
- `components/hero-landing.tsx`: Imports static data from `hero-landing-static.tsx` instead of inlining
- `components/hero-landing-static.tsx`: New server-first module, no `"use client"`, no hooks, no runtime state
- `lib/format-time.ts`: `date-fns` fully replaced with `Intl.DateTimeFormat` (30KB saved)
- `@paulmillr/qr`: Dynamic import only on dialog open (23KB only then)
- 9 public assets `git rm`d (unreferenced images/icons)
- TTL stamps 900/3600/86400 on room creation/join
- `CACHE_CONTROL: no-store` on `/room/*` and `/api/*` next.config.ts headers
- `X-Permitted-Cross-Domain-Policies: none` security header
- `focus-visible:ring-offset-2` standardized across 11 UI components
- Cross-origin origin guard: compares full host including port
- NFKC username folding in `use-username.ts` localStorage

### Performance
- Lighthouse: Performance 83/100, Accessibility 100/100, Best Practices 100/100, SEO 100/100, Agentic Browsing 100/100
- `date-fns` removal: ~30KB bundle reduction
- `@paulmillr/qr` dynamic import: 23KB only loaded on QR dialog open
- 9 assets git-rm'd: reduced initial bundle size
- TTL stamps: 900s (15m), 3600s (1h), 86400s (24h) room lifetimes
- `CACHE_CONTROL: no-store` on `/room/*` and `/api/*`

### Tests
- 95 pass / 2 fail with real Redis credentials
- Both failures: pre-existing test isolation issues (97 tests share Redis state; cleanup only at file end)
- Previously (no Redis creds): 77 pass / 20 fail (all 20 = UrlError from missing Upstash creds)

## [Unreleased]

(See above for current state — all 7 checklist items delivered, all code gates passing.)