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
- **Department pages** for Mechanical, Electrical, Housekeeping and Laboratory.
- **Laboratory daily entry form** — the chemist and assistant (role `Laboratory`) and Admin enter or correct a day's flow, analysis readings, energy-meter reading and the two photographs from a phone or PC. Out-of-limit values are flagged as they are typed, the meter "open" reading is pre-filled from the previous day, photos are shrunk before upload, and a strip shows which of the last 10 days are still missing. Saved to Supabase and shown on the Laboratory page immediately.
- **Laboratory page** — month-by-month effluent quality from the lab team's Excel/Word reports: KPIs and removal efficiency, each parameter against its permissible limit, day-by-day and long-term trend charts, a daily readings table (out-of-limit values highlighted), a daily report browser — filter by month, pick a day (dropdown, chips, previous/next) and narrow it to days with photos or days above a limit — showing the limits table, the OLMS and inlet/outlet sample photos, and power consumption.
- **Admin panel** — invite users, change departments, delete users, review pending requests, view and export the **activity log** to Excel.
- **Live cameras** — 2×2 grid of plant cameras with click-to-expand, plus a preview on the dashboard.
- **Public site map** on the login page so visitors can see what the portal contains before signing in.

## Roles

| Role | Access |
| --- | --- |
| `Admin` | Every department page, the admin panel, full edit rights |
| `Viewer` | Every department page, **read-only** |
| `Mechanical` / `Electrical` / `Housekeeping` / `Laboratory` | Their own department page only (`Laboratory` can also enter lab reports) |

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
| `/dashboard/laboratory` | Laboratory: lab results, daily reports, photos, power (`?month=YYYY-MM&day=YYYY-MM-DD&show=all\|photos\|exceed`) | Laboratory, Admin, Viewer |
| `/dashboard/laboratory/entry` | Daily lab report entry form (`?date=YYYY-MM-DD` to edit a day) | Laboratory, Admin |
| `/dashboard/admin` | User management, requests, activity log | Admin |

### API routes

| Route | Purpose |
| --- | --- |
| `GET /api/camera-url` | Returns the camera base URL to authenticated users only (it is a server-side env var, never in the browser bundle) |
| `/api/admin/approve-registration` | Approve an access request, create the user and email a temporary password |
| `/api/admin/reject-registration` | Reject an access request |
| `/api/admin/approve-role` | Approve a role-change request |
| `GET /api/lab/photo/<YYYY-MM>/<DD>-<olms\|sample>.<jpeg\|png\|webp>` | Lab photographs (private Supabase bucket `lab-photos`, then the file-based history), served only to signed-in users allowed to view the Laboratory page |

Server actions in `stp-website/app/actions/`: `registration`, `role-request`, `users` (invite / update department / delete), `logs` (query and Excel export), `lab` (save a daily lab report + photos).

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
    │   ├── dashboard/        shell, sidebar, department pages (incl. laboratory/), camera, admin
    │   ├── actions/          server actions
    │   └── api/              camera-url + admin routes
    ├── supabase/             lab-entry.sql (one-time database setup for the daily entry form)
    ├── data/lab/             lab-data.json + photos/ (generated from the lab Excel/Word files; photos served only to signed-in users)
    ├── scripts/              build-lab-data.py (refreshes the Laboratory data)
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

Supabase tables used: `profiles`, `registration_requests`, `role_requests`, `activity_logs`, and `lab_daily` (+ the private storage bucket `lab-photos`) for the Laboratory daily entry. The older schema is not stored in this repo; the lab one is in [`stp-website/supabase/lab-entry.sql`](stp-website/supabase/lab-entry.sql).

**One-time setup for the Laboratory daily entry:** in the Supabase dashboard open *SQL Editor → New query*, paste the contents of `stp-website/supabase/lab-entry.sql` and run it. Until then the Laboratory page keeps working but saving shows a "not set up yet" message. Then run [`stp-website/supabase/add-laboratory-role.sql`](stp-website/supabase/add-laboratory-role.sql) the same way: `profiles.department` (and the request tables) have a CHECK rule that must be widened to accept `Laboratory`.

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

### Laboratory data: history vs. daily entries

Days entered through the form live in Supabase (`lab_daily`) and are merged on top of the history below; a day entered on the portal replaces that day's Excel values.

#### Loading history from the Excel/Word files

The Laboratory page reads `stp-website/data/lab/lab-data.json`, which is generated from the lab team's files (no database table yet). After the Excel workbook or a monthly Word report changes, run from `stp-website/` (Python 3, standard library only):

```bash
python scripts/build-lab-data.py "<path>/Lab Report 7MGD STP SV.xlsx" "<path>/SEP-26 Lab Report.docx" "<path>/OCT-26 Lab Report.docx"
```

Pass every monthly Word report you want shown (each adds that month's daily photos and power readings). The script prints warnings for anything it could not read or that looks inconsistent. Commit the regenerated `data/lab/` (the photographs are served through the signed-in-only `/api/lab/photo/...` route, never from `public/`). Permissible limits come from the Word report (pH 5.5–9.0, BOD ≤ 10, COD ≤ 50, TSS ≤ 10, Phosphorus ≤ 1, Total Nitrogen ≤ 10 mg/l).

## Housekeeping notes

- `camera-relay/node_modules/` and `camera-relay.zip` are tracked in git; they should be removed from version control and ignored.
- **Keep this README current.** Whenever routes, roles, env vars, features or the camera setup change, update this file and `stp-website/lib/sitemap.ts` in the same change.

## Changelog

- **Laboratory daily entry form** added (`/dashboard/laboratory/entry`, `app/actions/lab.ts`, `supabase/lab-entry.sql`): Laboratory/Admin can save a day's readings, power and photos; stored in Supabase and merged with the file-based history.
- **Laboratory department** added: new `Laboratory` role, `/dashboard/laboratory` page (monthly summary, limit compliance, trends, daily readings, daily report with photos and power), data generated by `scripts/build-lab-data.py`. The `profiles.department` column in Supabase must accept the value `Laboratory` (check for a CHECK constraint or enum).
- **Site map** added to the login page; root README written.
