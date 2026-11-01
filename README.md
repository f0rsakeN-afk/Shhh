# Shhh

Ephemeral two-person chat rooms that self-destruct. Create a room, share the
link, pick a name, and talk: when the hour is up (or either participant hits
destroy), the conversation and every Redis key behind it are gone.

## How it works

A room is a bundle of Redis keys with a shared 1 hour TTL:

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
- Only the author or sender of a message can edit, delete or read-receipt its
  own side; foreign tokens get 403, and delete broadcasts strip the author
  token before fanning out
- One reaction per user per message, enforced server-authoritatively: the
  full merge result travels to all participants, so racing clicks converge
- Content-Security-Policy locks the app to its own origins; emojis are
  rendered natively, no third-party images
- Message posting is flood-controlled per token: a fixed window caps bursts
  at 8 messages per 5 seconds, 429 otherwise
- Sessions self-heal: if the proxy recycles a token, API calls 401 and the
  client drops back to the join screen

## History windowing

The client keeps the newest 100 messages in React Query and pages back in
blocks through `GET /api/messages?roomId=...&limit=...&before={ts}` (newest
first, cursor exclusive, `hasMore` flag on every page). Older pages are kept
in local state; scrolling near the top silently prepends the previous page,
and viewport anchoring keeps the reader in place during prepends while new
messages still sink the view to the newest content.

## Getting started

```sh
bun install

# Configure Upstash (rooms persist nothing without it)
cp .env.example .env.local  # fill UPSTASH_REDIS_REST_URL and _TOKEN

bun run dev      # http://localhost:3000
```

- `npm` / `pnpm` / `yarn` equally work; the lockfile is Bun's
- `bun run build && bun run lint` are the gates; both are expected to pass
  with zero warnings

## Environment

| Variable                | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL` | REST endpoint of your Upstash database (required for rooms)   |
| `UPSTASH_REDIS_REST_TOKEN` | Matching REST token                                        |
| `NEXT_PUBLIC_SITE_URL`   | Canonical URL for links, sitemap and OG metadata              |
| `NEXT_PUBLIC_API_URL`    | API base for the client; defaults to the current origin       |

## Stack

- Next.js (App Router) + React Compiler
- Elysia route handlers behind `/api/[[...slugs]]`, typed client via Eden
- Upstash Redis (REST) for storage, Upstash Realtime for fan-out
- Zod schemas shared by server validation and client types
- Tailwind CSS with a small local UI kit (`components/ui`)
