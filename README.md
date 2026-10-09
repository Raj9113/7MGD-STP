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
- **Department pages** for Mechanical, Electrical, Housekeeping and Laboratory. The Mechanical / Electrical / Housekeeping pages show the daily report of any date (date selector, previous/next), flag what needs attention, and are filled from real daily entries (no placeholder data).
- **Daily entry forms for Mechanical, Electrical and Housekeeping** — the department's own staff and Admin record each day: equipment status and readings, MCC panels, DG set and UPS, alarms, work orders, shift tasks, chemical stock, sludge disposal, PPE, pest control and remarks. Equipment lists are editable and carried forward from the previous report (open work orders and uncleared alarms too); readings are validated and highlighted as they are typed. Every form shows **Prepared by** (the logged-in user, recorded automatically). Housekeeping has four shifts: Morning 07:00-15:00, General 09:00-17:00, Evening 15:00-23:00 and Night 23:00-07:00 (India time), each with a supervisor and its own task list. Staff do not type the supervisor name: their own login name is stamped on the supervisor box of the shift they supervise (the only shift running, or the one they pick when shifts overlap, e.g. General inside Morning/Evening); a name already saved is kept so one user cannot overwrite another shift's supervisor, and only Admin can type names (`loginName` fields, `applyLoginNames` in the schema, enforced on the server). All three forms are generated from one schema (`stp-website/lib/dept-report/schema.ts`).
- **Overview tiles are real:** treated flow, effluent quality, BOD removal, energy used and items needing attention come from the latest lab and department reports, and each department card shows when it last reported.
- **Daily plant report (PDF)** — Admin only. A button under the greeting on the Overview page: pick a particular date or a custom range (up to 31 days) and download one PDF with a chapter per day: summary, Laboratory (limits, photos, power), then the daily reports of Electrical, Mechanical and Housekeeping, and the day's portal activity. Items needing attention (faulty equipment, open high-priority work orders, active alarms, low chemical stock, values above limit) are flagged on the summary; a department that did not enter a report for a date says so.
- **Laboratory downloads** — a *Download reports* panel on the Laboratory page: **Excel** for any month (one sheet in the lab workbook's own layout, with logos, merged headers, averages and the sign-off line) and **Word** daily reports for a chosen day, the whole month or custom dates (the lab's own daily page: limits table with red shading for values above the limit, the sample/OLMS photo frames, power table). Both are filled from templates cut out of the lab team's own files, so the look is theirs; photos can be left out.
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
| `/auth/forgot-password` | Email a password-reset link (also fixes expired invitations) | Public |
| `/auth/set-password` | Set a new password (first login / invite) | Public route, needs a session |
| `/auth/callback` | Supabase auth callback | Public |
| `/dashboard` | Overview and camera preview | Signed-in |
| `/dashboard/camera` | Live camera grid | Signed-in |
| `/dashboard/request-role` | Request a role/department change | Signed-in (non-admin) |
| `/dashboard/mechanical` | Mechanical daily report (`?date=YYYY-MM-DD`) | Mechanical, Admin, Viewer |
| `/dashboard/mechanical/entry` | Mechanical daily entry form | Mechanical, Admin |
| `/dashboard/electrical` | Electrical daily report (`?date=YYYY-MM-DD`) | Electrical, Admin, Viewer |
| `/dashboard/electrical/entry` | Electrical daily entry form | Electrical, Admin |
| `/dashboard/housekeeping` | Housekeeping daily report (`?date=YYYY-MM-DD`) | Housekeeping, Admin, Viewer |
| `/dashboard/housekeeping/entry` | Housekeeping daily entry form | Housekeeping, Admin |
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
| `GET /api/reports/daily-pdf?from=YYYY-MM-DD&to=YYYY-MM-DD&photos=1` | The all-department daily report as a PDF, up to 31 days (Admin only) |
| `GET /api/lab/export/excel?month=YYYY-MM` | The month as an Excel sheet in the lab workbook's layout (Laboratory, Admin, Viewer) |
| `GET /api/lab/export/word?from=YYYY-MM-DD&to=YYYY-MM-DD&photos=1` | Word daily reports for the days in that period, up to 31 days (Laboratory, Admin, Viewer) |
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
    ├── lib/daily-report/     builds the daily plant report PDF (pdf-lib)
    ├── lib/dept-report/      the daily-report schema of each department (drives the form, validation, page and PDF), loaders
    ├── templates/report/     the two logos used in the PDF header
    ├── templates/lab/        month-sheet-template.xlsx + daily-report-template.docx (cut from the lab team's own files)
    ├── lib/lab-export/       builds the Excel / Word downloads from those templates
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

Supabase tables used: `profiles`, `registration_requests`, `role_requests`, `activity_logs`, `dept_daily`, and `lab_daily` (+ the private storage bucket `lab-photos`) for the Laboratory daily entry. The older schema is not stored in this repo; `dept_daily` (Mechanical / Electrical / Housekeeping daily reports) is in [`stp-website/supabase/dept-entry.sql`](stp-website/supabase/dept-entry.sql) and the lab one in [`stp-website/supabase/lab-entry.sql`](stp-website/supabase/lab-entry.sql).

**One-time setup for the Laboratory daily entry:** in the Supabase dashboard open *SQL Editor → New query*, paste the contents of `stp-website/supabase/lab-entry.sql` and run it. Until then the Laboratory page keeps working but saving shows a "not set up yet" message. Then run [`stp-website/supabase/add-laboratory-role.sql`](stp-website/supabase/add-laboratory-role.sql) the same way: `profiles.department` (and the request tables) have a CHECK rule that must be widened to accept `Laboratory`.

**One-time setup for the department daily reports:** run [`stp-website/supabase/dept-entry.sql`](stp-website/supabase/dept-entry.sql) the same way. Until then the Mechanical / Electrical / Housekeeping pages show "no reports yet" and saving shows a "not set up yet" message.

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

#### Download templates

The Excel and Word downloads are generated from `stp-website/templates/lab/`, which holds one month sheet and one daily page cut out of the lab team's own files (`scripts/build-lab-templates.py "<workbook>.xlsx" "<month report>.docx"`). Only re-run it if the team changes the layout of their files. A whole month of Word pages with photos is about 5.6 MB; the server re-encodes the photos smaller when needed so the download stays under Vercel's 4.5 MB response limit.

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

- **Password reset added:** "Forgot password?" on the login page opens `/auth/forgot-password`, which emails a reset link (`resetPasswordForEmail`) that returns via `/auth/callback?next=/auth/set-password`. Users whose invitation expired can use it instead of a new invite. Add `https://7-mgd-stp.vercel.app/auth/callback` to Supabase Redirect URLs (query strings are allowed by the same entry only with a wildcard, so use `https://7-mgd-stp.vercel.app/**`).
- **Invitation link fix:** Supabase invite emails return the session in the URL `#fragment`, which `/auth/callback` (server) could not read, so every invite ended on the login page with no explanation. The callback now hands over to `/auth/set-password`, and the login page explains an expired / already-used link (`app/login/LinkNotice.tsx`). In Supabase set **Authentication → URL Configuration → Site URL** to `https://7-mgd-stp.vercel.app` and add `https://7-mgd-stp.vercel.app/auth/callback` to Redirect URLs.
- **Logged-in names on reports:** "Prepared by" on all entry forms; department staff cannot type the shift supervisor name, it is their own login name on the shift they supervise (Admin types it).
- **Loading feedback** added: a progress bar and "Loading…" pill appear the moment any link or page dropdown is used (`app/dashboard/NavProgress.tsx`, `lib/nav-pending.ts`), `app/dashboard/loading.tsx` shows a skeleton while a page loads, and a full-screen overlay (`app/dashboard/LoadingOverlay.tsx`) covers saving reports, downloads, sign-out and the admin / request forms.
- **Daily entry forms and real pages for Mechanical, Electrical and Housekeeping** added (`app/dashboard/dept/*`, `lib/dept-report/*`, `app/actions/dept-report.ts`, `supabase/dept-entry.sql`): replaces the placeholder values, which are gone. The daily PDF now draws these reports (no more SAMPLE DATA sections) and the Overview tiles and department cards are derived from real reports. Run `supabase/dept-entry.sql` once.
- **Daily plant report PDF** added (Admin only, Overview page): `app/api/reports/daily-pdf`, `lib/daily-report/*`, new dependency `pdf-lib`; the sample data of the Mechanical, Electrical and Housekeeping pages moved to `lib/sample-data/` so the pages and the PDF share it.
- **Laboratory downloads** added: Excel (month) and Word (day / month / custom dates) in the lab team's own formats (`app/api/lab/export/*`, `lib/lab-export/*`, `templates/lab/*`, new dependency `jszip`).
- **Laboratory daily entry form** added (`/dashboard/laboratory/entry`, `app/actions/lab.ts`, `supabase/lab-entry.sql`): Laboratory/Admin can save a day's readings, power and photos; stored in Supabase and merged with the file-based history.
- **Laboratory department** added: new `Laboratory` role, `/dashboard/laboratory` page (monthly summary, limit compliance, trends, daily readings, daily report with photos and power), data generated by `scripts/build-lab-data.py`. The `profiles.department` column in Supabase must accept the value `Laboratory` (check for a CHECK constraint or enum).
- **Site map** added to the login page; root README written.
