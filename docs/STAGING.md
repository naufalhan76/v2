# MSN ERP V2 — Staging Deployment Guide

Local Docker staging for V2 features before merging to V1 (production on Vercel). V2 runs alongside V1 on the same VPS, exposed via Cloudflare tunnel at `v2.nufnh.my.id`. **Same Supabase database** as V1 — no schema changes required for staging.

## Architecture

```
Browser → Cloudflare → tunnel hermes-stack → 127.0.0.1:3001 → Docker (msn-erp-v2)
                                                                       │
                                                                       └─ same Supabase as V1 prod
V1 (production) → Vercel → same Supabase (untouched)
```

V1 keeps serving production traffic. V2 only changes the application layer; database schema is shared and read/write-compatible because Phase 0 migrations were strictly additive (added enum values, new tables; nothing dropped).

## First-time setup

### 1. Provide secrets

Copy V1's Vercel env vars into a local file:

```bash
cp .env.staging.example .env.staging
vim .env.staging  # fill in real values
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL` — same as V1
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same as V1
- `SUPABASE_SERVICE_ROLE_KEY` — same as V1
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — if push enabled. Generate via `npm run vapid:gen` if not yet.
- `VAPID_SUBJECT` — `mailto:admin@nufnh.my.id`

### 2. Apply database migrations (only once, shared with V1)

The Phase 0 SQL migration adds new enum values + tables. Apply it via Supabase Dashboard → SQL Editor:

```bash
cat supabase/migrations/20260526000000_add_pending_completed_service_reports_push.sql
```

Or via Supabase CLI if linked:
```bash
supabase db push
```

If V1 already shares this DB and you're worried about V1 breaking — don't be. Phase 0 was designed additive; V1 won't see the new states because its UI never emits them.

### 3. Create storage buckets (manual, in Supabase Dashboard)

- `service-photos` — public read, 5MB max, MIME: `image/jpeg, image/png, image/webp`
- `signatures` — private, 1MB max, MIME: `image/png`

Storage policies as documented in `docs/superpowers/specs/2026-05-26-msn-erp-v2-design.md` §4.4.

### 4. Start the container

```bash
./scripts/staging.sh start
```

This builds the image (with `NEXT_PUBLIC_*` baked in) and runs it on `127.0.0.1:3001`.

### 5. Expose via Cloudflare tunnel

```bash
./scripts/staging.sh tunnel
```

This:
- Adds DNS CNAME `v2.nufnh.my.id` to the existing `hermes-stack` tunnel
- Inserts ingress rule into `~/.cloudflared/config.yml`
- Restarts the tunnel

After ~30s DNS propagation, V2 is live at **https://v2.nufnh.my.id**.

## Day-to-day commands

```bash
./scripts/staging.sh status   # check container + tunnel health
./scripts/staging.sh logs     # tail logs
./scripts/staging.sh restart  # rebuild + restart (after pulling new commits)
./scripts/staging.sh stop     # shutdown
```

## Updating V2

```bash
git pull
./scripts/staging.sh restart
```

The script runs `docker compose build` (with cached layers when only source changed) then restarts the container.

## Why port 3001?

V1 is on Vercel — VPS port 3000 might still be free, but 3001 leaves room for any local dev server you might run on 3000 later. Cloudflare tunnel maps `v2.nufnh.my.id` → `127.0.0.1:3001`.

## Why bake `NEXT_PUBLIC_*` at build time?

Next.js inlines `NEXT_PUBLIC_*` env vars into the client JavaScript bundle during `next build`. They cannot be changed at container start without rebuilding. The Dockerfile uses `ARG` + `ENV` to receive them as build args, and `docker-compose.yml` passes them via `build.args`.

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`) stay as runtime env — they're read fresh on each request.

## Differences vs V1 (production)

| Concern | V1 (Vercel) | V2 (Docker staging) |
|---------|-------------|---------------------|
| Hostname | (Vercel domain or custom) | v2.nufnh.my.id |
| Hosting | Vercel serverless | Docker on VPS |
| Database | Same Supabase project | Same Supabase project |
| Storage buckets | Same | Same |
| Auth | Same Supabase Auth | Same Supabase Auth |
| Build | Vercel | Docker (`Dockerfile`) |
| Restart | Auto | `./scripts/staging.sh restart` |

Logged-in users persist across V1 and V2 because both share the same Supabase Auth.

## Promoting V2 → V1 (production)

When ready to merge:
1. Test thoroughly on https://v2.nufnh.my.id
2. Push branch to GitHub → trigger Vercel deploy preview
3. Verify preview against same DB
4. Merge to main → Vercel deploys to production
5. Stop V2 staging: `./scripts/staging.sh stop`

## Rollback

If V2 has issues but is exposed publicly:
```bash
./scripts/staging.sh stop
```

The tunnel stays up but `v2.nufnh.my.id` returns 502 until container restarts. Optionally remove the ingress rule from `~/.cloudflared/config.yml` and restart cloudflared to take the subdomain offline entirely.

## Troubleshooting

**Build fails with "Cannot find module" for NEXT_PUBLIC_* vars:**
The build args weren't passed. Check `.env.staging` exists and has values, then `./scripts/staging.sh restart`.

**Container starts but `https://v2.nufnh.my.id` returns 502:**
- Check container is healthy: `./scripts/staging.sh status`
- Check tunnel is running: `pgrep -f "cloudflared tunnel run"`
- Check tunnel logs: `tail -f ~/cf-hermes-stack.log`

**Push notifications don't work:**
- Verify VAPID env vars are set in `.env.staging`
- VAPID public key is baked at build time — restart container after changing
- Service worker requires HTTPS — must access via `https://v2.nufnh.my.id`, not `http://localhost:3001`

**Auth redirects to wrong URL:**
Supabase Auth redirect URLs are set in Supabase Dashboard → Auth → URL Configuration. Add `https://v2.nufnh.my.id` to the allow-list as a "Redirect URL" (alongside V1's URL).
