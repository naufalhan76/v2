# AC Service Dashboard

Web-based management dashboard for AC service operations. Built with Next.js 15, React 19, TypeScript, Supabase, and shadcn/ui.

## Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Language**: TypeScript
- **DB / Auth**: Supabase (Postgres + RLS)
- **UI**: Tailwind CSS + shadcn/ui (Radix primitives)
- **Data**: TanStack Query, TanStack Table
- **Forms**: React Hook Form + Zod
- **PDF / Email**: jsPDF, html2canvas, Resend

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL

# 3. Run DB migrations (run files in /migrations against your Supabase project)

# 4. Dev server
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with autofix |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |
| `npm run clean` | Remove `.next` and Next cache |

## Project Structure

```
src/
  app/                  # Next.js routes (App Router)
    (auth)/             # Login, confirm email
    api/                # REST API routes
    dashboard/          # Authenticated dashboard pages
  components/           # Shared components (incl. shadcn/ui)
  hooks/                # React hooks
  lib/                  # Supabase clients, server actions, utils
    actions/            # Server actions per domain
  styles/               # Global CSS
  types/                # Shared TS types
migrations/             # SQL migrations
docs/                   # Reference docs (api.md, ...)
```

## Features

- Dashboard KPIs and revenue charts
- Master data: users, customers, technicians, AC units, locations
- Order flow: create → accept → assign → monitor → complete
- Invoicing (final + proforma), bank accounts, PDF export, email send
- Service & addon catalog, pricing config, SLA config
- Role-based access (SUPERADMIN, ADMIN, TECHNICIAN, FINANCE)

## Environment Variables

See `.env.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Optional:
- `RESEND_API_KEY` — for invoice email sending
- `API_KEY_SECRET` — HMAC secret for API keys

## Deployment

- **Vercel**: connect repo, set env vars, deploy.
- **Docker**: `Dockerfile` + `docker-compose.yml` provided.

## API

REST endpoints documented in [`docs/api.md`](docs/api.md).

## License

Private.
