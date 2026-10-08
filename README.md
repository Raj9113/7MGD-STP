# 7 MGD STP — Sonia Vihar Department Portal

A role-based staff portal for the **7 MGD Sewage Treatment Plant (STP), Sonia Vihar**. It gives plant departments a secure place to work, an admin panel for managing users, and live camera feeds from the plant.

The repo contains two deployable parts:

| Folder | What it is |
| --- | --- |
| [`stp-website/`](stp-website) | The portal — Next.js 16 / React 19 / TypeScript / Tailwind 4, backed by Supabase |
| [`camera-relay/`](camera-relay) | Node/Express + FFmpeg service that turns an IP camera's RTSP stream into browser-playable HLS |

```
 IP camera --RTSP--> camera-relay (FFmpeg -> HLS) --Cloudflare Tunnel--> stp-website (hls.js player)
                                                                            |
                                                          Supabase (auth, profiles, requests, logs)
```

---

## Features

- **Secure login** with Supabase email/password auth; middleware protects every route except the public ones.
- **Invite-only onboarding** — visitors request access, an admin approves/rejects, the user receives a temporary password by email and must set a new one on first login.
- **Role-based access control** (see below).
- **Role-change requests** — users can ask an admin to move them to another department.
- **Department pages** for Mechanical, Electrical and Housekeeping.
- **Admin panel** — invite users, change departments, delete users, review pending requests, view and export the **activity log** to Excel.
- **Live cameras** — 2×2 grid of plant cameras with click-to-expand, plus a preview on the dashboard.
- **Public site map** on the login page so visitors can see what the portal contains before signing in.

## Roles

| Role | Access |
| --- | --- |
| `Admin` | Every department page, the admin panel, full edit rights |
| `Viewer` | Every department page, **read-only** |
| `Mechanical` / `Electrical` / `Housekeeping` | Their own department page only |

All signed-in roles can see the live camera (change `canViewCamera` in [`lib/access.ts`](stp-website/lib/access.ts) to restrict it). All role rules live in `lib/access.ts`.

## Site map

Also shown in the app on the login page ("View Site Map"); its data comes from [`stp-website/lib/sitemap.ts`](stp-website/lib/sitemap.ts).

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Redirects to `/login` | Public |
| `/login` | Sign in, link to request access, site map | Public |
| `/request-access` | Request a portal account | Public |
| `/auth/set-password` | Set a new password (first login / invite) | Public route, needs a session |
| `/auth/callback` | Supabase auth callback | Public |
| `/dashboard` | Overview and camera preview | Signed-in |
| `/dashboard/camera` | Live camera grid | Signed-in |
| `/dashboard/request-role` | Request a role/department change | Signed-in (non-admin) |
| `/dashboard/mechanical` | Mechanical department | Mechanical, Admin, Viewer |
| `/dashboard/electrical` | Electrical department | Electrical, Admin, Viewer |
| `/dashboard/housekeeping` | Housekeeping department | Housekeeping, Admin, Viewer |
| `/dashboard/admin` | User management, requests, activity log | Admin |

### API routes

| Route | Purpose |
| --- | --- |
| `GET /api/camera-url` | Returns the camera base URL to authenticated users only (it is a server-side env var, never in the browser bundle) |
| `/api/admin/approve-registration` | Approve an access request, create the user and email a temporary password |
| `/api/admin/reject-registration` | Reject an access request |
| `/api/admin/approve-role` | Approve a role-change request |

Server actions in `stp-website/app/actions/`: `registration`, `role-request`, `users` (invite / update department / delete), `logs` (query and Excel export).

## Project structure

```
7MGD-STP/
├── README.md                 <- you are here
├── camera-relay/             <- RTSP -> HLS relay (Express + FFmpeg)
│   ├── server.js
│   └── .env.example
└── stp-website/              <- Next.js portal
    ├── app/
    │   ├── login/            login page + SiteMap modal
    │   ├── request-access/   public access request form
    │   ├── auth/             callback + set-password
    │   ├── dashboard/        shell, sidebar, department pages, camera, admin
    │   ├── actions/          server actions
    │   └── api/              camera-url + admin routes
    ├── lib/
    │   ├── access.ts         role rules and nav links
    │   ├── sitemap.ts        site map data (login page)
    │   ├── email.ts          nodemailer helpers
    │   └── supabase/         client / server / admin / logger
    └── middleware.ts         auth guard and forced password change
```

## Getting started

### Prerequisites
Node.js (a version supported by Next.js 16), a Supabase project, an SMTP account, and — for cameras — FFmpeg plus an RTSP-capable camera.

### 1. Website
```bash
cd stp-website
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin operations (never expose) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Outgoing email (invites, approvals) |
| `CAMERA_HLS_URL` | Public URL of the camera relay (e.g. via Cloudflare Tunnel); server-side only |

Supabase tables used: `profiles`, `registration_requests`, `role_requests`, `activity_logs`. The schema is not stored in this repo yet.

### 2. Camera relay
```bash
cd camera-relay
npm install
cp .env.example .env         # set RTSP_URL (and FFMPEG_PATH if ffmpeg is not on PATH)
npm start                    # http://localhost:3001
```
Endpoints: `/stream/stream.m3u8` (HLS) and `/health`. FFmpeg restarts automatically if it crashes. For production, run it under PM2 (`pm2 start server.js --name camera-relay`) and expose it with a Cloudflare Tunnel.

> **Known gap:** the dashboard player requests `/cam12`, `/cam14`, `/cam26` and `/cam2` under `CAMERA_HLS_URL`, but the committed `server.js` serves a single stream at `/stream/stream.m3u8`. The multi-camera relay appears to run from a separate script (possibly the bundled `camera-relay.zip`); consider committing it.

## Scripts (`stp-website`)

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |

## Housekeeping notes

- `camera-relay/node_modules/` and `camera-relay.zip` are tracked in git; they should be removed from version control and ignored.
- **Keep this README current.** Whenever routes, roles, env vars, features or the camera setup change, update this file and `stp-website/lib/sitemap.ts` in the same change.

## Changelog

- **Site map** added to the login page; root README written.
