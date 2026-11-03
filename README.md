# Shhh

Ephemeral chat rooms for up to ten people that self-destruct. Create a
room, pick a lifetime (15 minutes, 1 hour, or 24 hours), share the link,
pick a name, and talk: when the timer is up (or the room is destroyed), the
conversation and every Redis key behind it are gone.

## How it works

A room is a bundle of Redis keys sharing the lifetime chosen at creation
(stamped once on `meta`, then inherited by every other key):

- `meta:{roomId}`: connection registry and creation time; the expiry clock
- `msg:{roomId}`: HASH of message id to stored message (O(1) point access)
- `order:{roomId}`: ZSET of message id to timestamp (ordering for history)
- `users:{roomId}` / `presence:{roomId}`: participants and last-seen heartbeat
- `pending:{roomId}`: tokens waiting on the join handshake, tracked so page
  load cannot evict a user who is still picking a name

Realtime updates (new message, edits, reactions, typing, presence, destroy)
run over Upstash Realtime; the history, reactions, receipts, deletes and
flood control are plain REST calls against Next.js route handlers backed by
Elysia.

## Security model

- Identity comes from the server, not the client. Each page load gets an
  httpOnly, sameSite=strict `x-auth-token` cookie; username and avatar are
  looked up server-side from that token and request bodies carry none of it
- Room lifetime is fixed at creation (`ROOM_DURATIONS`: 15m / 1h / 24h);
  the TTL is stamped in one pipeline on `meta` and later keys inherit the
  remaining time, so no request can extend a room
- Rooms hold up to `MAX_ROOM_PARTICIPANTS` (10) participants, enforced
  identically from one constant: the proxy door redirects surplus visitors
  and the Lua join gate rejects tokens past the ceiling (403), so the two
  layers can never disagree about capacity
- Only the author or sender of a message can edit, delete or read-receipt its
  own side; foreign tokens get 403, and delete broadcasts strip the author
  token before fanning out. Edits are further bounded to `EDIT_WINDOW_MS`
  (5 minutes) after sending, so a late reader can trust what they saw — the
  client hides the affordance and the server enforces the same constant
- One reaction per user per message, enforced server-authoritatively: the
  full merge result travels to all participants, so racing clicks converge
- Content-Security-Policy locks the app to its own origins; emojis are
  rendered natively, no third-party images. The CSP ships with the standard
  companion set — `nosniff`, `X-Frame-Options: DENY`, a strict referrer
  policy, `Permissions-Policy` closing unused device APIs, COOP/CORP
  `same-origin`, and HSTS
- Message posting is flood-controlled per token: a fixed window caps bursts
  at 8 messages per 5 seconds, 429 otherwise
- Sessions self-heal: if the proxy recycles a token, API calls 401 and the
  client drops back to the join screen
- Read receipts are batched: the client coalesces each observation burst
  into at most one `POST /api/messages/read` with up to 50 ids, and the
  server attributes each from the cookie identity, skipping ids that
  vanished mid-scroll
- Realtime resilience: the SSE stream carries all live traffic, so when it
  blips the client resyncs on reconnect, on tab focus and — while the
  transport stays down (the provider gives up after 5 reconnect attempts)
  — falls back to a 10s REST poll until the stream recovers
- Realtime replay has two layers. Every SSE connection replays the
  channel's buffered stream server-side (`XRANGE` since the client's last
  ack), which closes gaps across the provider's routine connection
  rotations; each room's stream is trimmed to the last 50 events and
  expires after one hour (`history` config), so anything missed beyond
  that window is covered by the REST resync/poll instead — the two
  layers bound together: narrow gaps replay natively, wide ones converge
  via REST (24-hour rooms intentionally keep the shorter replay window;
  their missed events converge through REST)
- Server-side logging: an app-root error handler prints every unhandled 500
  with its stack, and security seams (creates, joins, flood gates) emit
  structured events; the level filters output
- Content-Security-Policy is scope-exact: realtime rides `EventSource` over
  the same origin, so production `connect-src` is `'self'` (dev adds only
  localhost HMR WebSockets)

## History windowing

The client keeps the newest 100 messages in React Query and pages back in
blocks through `GET /api/messages?roomId=...&limit=...&before={ts}` (newest
first, cursor exclusive, `hasMore` flag on every page). Older pages are kept
in local state; scrolling near the top silently prepends the previous page,
and viewport anchoring keeps the reader in place during prepends. New
messages sink the view to the newest content only while the reader is near
the bottom; scrolled-up readers get a "New messages" jump pill instead of
being yanked. The room auto-destruction shows a warning palette countdown
and announces expiry to screen readers.

## Getting started

```sh
bun install

# Configure Upstash (rooms persist nothing without it)
cp .env.example .env.local  # fill UPSTASH_REDIS_REST_URL and _TOKEN

bun run dev      # http://localhost:3000
```

- `npm` / `pnpm` / `yarn` equally work; the lockfile is Bun's
- `bun run build && bun run lint && bun run typecheck` are the gates; all
  are expected to pass clean

## Environment

| Variable                | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL` | REST endpoint of your Upstash database (required for rooms)   |
| `UPSTASH_REDIS_REST_TOKEN` | Matching REST token                                        |
| `NEXT_PUBLIC_SITE_URL`   | Canonical URL for links, sitemap and OG metadata              |
| `NEXT_PUBLIC_API_URL`    | API base for the client; defaults to the current origin       |
| `LOG_LEVEL`              | Server log threshold: `debug`, `info` (default), `warn`, `error` |

## Stack

- Next.js (App Router) + React Compiler
- Elysia route handlers behind `/api/[[...slugs]]`, typed client via Eden
- Upstash Redis (REST) for storage, Upstash Realtime for fan-out
- Zod schemas shared by server validation and client types
- Tailwind CSS with a small local UI kit (`components/ui`)
