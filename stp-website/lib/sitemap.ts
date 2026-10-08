/**
 * Single source of truth for the website map shown on the login page.
 * Keep in sync with the routes under /app and the "Site map" table in the root README.md.
 */

export type SiteMapAccess = 'public' | 'all' | 'department' | 'admin';

export interface SiteMapEntry {
  label: string;
  href: string;
  icon: string;
  description: string;
  access: SiteMapAccess;
}

export interface SiteMapSection {
  title: string;
  note: string;
  entries: SiteMapEntry[];
}

export const ACCESS_LABELS: Record<SiteMapAccess, string> = {
  public: 'Open to everyone',
  all: 'All signed-in users',
  department: 'Own department (Admin & Viewer see all)',
  admin: 'Admin only',
};

export const SITE_MAP: SiteMapSection[] = [
  {
    title: 'Before you sign in',
    note: 'Available without an account.',
    entries: [
      { label: 'Login', href: '/login', icon: '🔐', description: 'Sign in with your email and password.', access: 'public' },
      { label: 'Request Access', href: '/request-access', icon: '📨', description: 'Ask the administrator for a portal account.', access: 'public' },
      { label: 'Set Password', href: '/auth/set-password', icon: '🔑', description: 'Choose a new password after your first sign-in or invite.', access: 'public' },
    ],
  },
  {
    title: 'Plant dashboard',
    note: 'Requires sign-in.',
    entries: [
      { label: 'Overview', href: '/dashboard', icon: '🏭', description: 'Plant summary and live camera preview.', access: 'all' },
      { label: 'Live Camera', href: '/dashboard/camera', icon: '📷', description: '2×2 grid of plant cameras with an expand view.', access: 'all' },
      { label: 'Request Role Change', href: '/dashboard/request-role', icon: '⬆️', description: 'Ask the administrator to change your department.', access: 'all' },
    ],
  },
  {
    title: 'Departments',
    note: 'Each user sees their own department; Admin and Viewer see all (Viewer is read-only).',
    entries: [
      { label: 'Mechanical', href: '/dashboard/mechanical', icon: '⚙️', description: 'Mechanical department page.', access: 'department' },
      { label: 'Electrical', href: '/dashboard/electrical', icon: '⚡', description: 'Electrical department page.', access: 'department' },
      { label: 'Housekeeping', href: '/dashboard/housekeeping', icon: '🧹', description: 'Housekeeping department page.', access: 'department' },
    ],
  },
  {
    title: 'Administration',
    note: 'Administrators only.',
    entries: [
      { label: 'Admin Panel', href: '/dashboard/admin', icon: '🛡️', description: 'Invite and manage users, approve requests, review the activity log.', access: 'admin' },
    ],
  },
];
