# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent Node projects (no root package.json or workspace):

- `stp-website/` — Next.js 16 (App Router) / React 19 / TypeScript / Tailwind 4 staff portal, backed by Supabase.
- `camera-relay/` — Express + FFmpeg service that converts an IP camera's RTSP stream to HLS (`server.js`, serves `/stream/stream.m3u8` and `/health`).

Data flow: IP camera --RTSP--> camera-relay --Cloudflare Tunnel--> stp-website (hls.js player). Auth, profiles, requests and logs live in Supabase.

`README.md` (root) is the source of truth for features, roles, site map, routes and env vars.

## Commands

Run from `stp-website/`:

    npm run dev      # http://localhost:3000
    npm run build
    npm run lint     # ESLint (flat config, eslint.config.mjs)

From `camera-relay/`: `npm start` (http://localhost:3001; needs `RTSP_URL` in `.env`, and FFmpeg on PATH or `FFMPEG_PATH`).

There is no test suite or test runner configured.

## Next.js 16 warning

Read `stp-website/AGENTS.md` first. This Next.js version differs from older ones; consult `stp-website/node_modules/next/dist/docs/` before writing Next.js code. Note that `middleware.ts` is still the file used here.

## Architecture

- **Auth guard** — `stp-website/middleware.ts` runs on all routes except static assets. It refreshes the Supabase session and redirects unauthenticated users to `/login` (public: `/login`, `/auth/callback`, `/auth/set-password`, `/request-access`). It also forces users whose `profiles.must_change_password` is true to `/auth/set-password`. If Supabase env vars are missing or start with `your_`, it skips auth entirely (setup convenience, not a bug).
- **Roles** — all role logic is centralized in `lib/access.ts` (`canViewDept`, `canViewAdmin`, `canEdit`, `canViewCamera`, `getAllowedNavLinks`). Roles: Admin, Viewer (read-only), Mechanical, Electrical, Housekeeping. Extend rules there rather than inline in pages.
- **Supabase clients** — `lib/supabase/` has separate `client` (browser), `server` (SSR cookies), `admin` (service-role, server only) and `logger` (writes `activity_logs`). Tables: `profiles`, `registration_requests`, `role_requests`, `activity_logs`. The schema is not in the repo.
- **Onboarding flow** — invite-only: `/request-access` -> row in `registration_requests` -> admin approves via `app/api/admin/approve-registration` (creates the user with a temp password, emails it through `lib/email.ts`) -> first login is forced to set a password. Role-change requests follow a similar path (`approve-role`).
- **Mutations** live in server actions under `app/actions/` (`registration`, `role-request`, `users`, `logs`), plus the admin API routes in `app/api/admin/`.
- **Camera URL** — `CAMERA_HLS_URL` is server-only; the browser gets it via authenticated `GET /api/camera-url`. Never expose it with a `NEXT_PUBLIC_` prefix.
- **Known gap** — the dashboard player requests `/cam12`, `/cam14`, `/cam26`, `/cam2` under `CAMERA_HLS_URL`, but the committed `camera-relay/server.js` serves only a single `/stream/stream.m3u8`. The multi-camera relay is not in the repo.

## Conventions

- **Doc upkeep (required):** on any change to a route, role, env var, feature or camera setup, update the root `README.md` (features, site map table, env vars, changelog) and `stp-website/lib/sitemap.ts` in the same change. The site map is rendered on the login page by `app/login/SiteMap.tsx`.
- `camera-relay/node_modules/` and `camera-relay.zip` are tracked in git; don't add to or edit them.
