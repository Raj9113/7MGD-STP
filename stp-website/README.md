# stp-website

The Next.js 16 portal for the 7 MGD STP Sonia Vihar. For the full overview — features, roles, site map, environment variables and the camera relay — see the **[root README](../README.md)**.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase, SMTP and CAMERA_HLS_URL
npm run dev                  # http://localhost:3000
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (`@supabase/ssr`) · nodemailer · hls.js · xlsx

## Where things live

| Path | Contents |
| --- | --- |
| `app/` | Routes: `login`, `request-access`, `auth`, `dashboard/*`, `api/*`, server `actions/` |
| `lib/access.ts` | Role rules and sidebar links |
| `lib/sitemap.ts` | Site map data rendered on the login page |
| `lib/supabase/` | Browser, server and admin clients; activity logger |
| `middleware.ts` | Auth guard and forced password change |

> Next.js 16 has breaking changes from older versions — see `AGENTS.md` before writing code.

## Keeping docs current

When you add or change a route, role, env var or feature, update `lib/sitemap.ts` and the root `README.md` in the same change.
