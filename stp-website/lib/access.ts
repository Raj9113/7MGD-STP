/**
 * Role-based access control utilities for the 7MGD STP portal.
 *
 * Roles: 'Mechanical' | 'Electrical' | 'Housekeeping' | 'Admin' | 'Viewer'
 *
 * Viewer  → read-only access to ALL department pages
 * Admin   → full access to ALL department pages + admin panel
 * Others  → full access to THEIR OWN department page only
 */

export type STPRole = 'Mechanical' | 'Electrical' | 'Housekeeping' | 'Admin' | 'Viewer';

export type DeptSlug = 'mechanical' | 'electrical' | 'housekeeping';

const DEPT_SLUG_TO_ROLE: Record<DeptSlug, STPRole> = {
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  housekeeping: 'Housekeeping',
};

/** Can this role view a specific department page? */
export function canViewDept(role: string, dept: DeptSlug): boolean {
  if (role === 'Admin' || role === 'Viewer') return true;
  return role === DEPT_SLUG_TO_ROLE[dept];
}

/** Can this role access the Admin panel? */
export function canViewAdmin(role: string): boolean {
  return role === 'Admin';
}

/** Is this role in read-only mode? (Viewer cannot edit/comment/trigger) */
export function isReadOnly(role: string): boolean {
  return role === 'Viewer';
}

/** Returns true if the role can perform write/action operations */
export function canEdit(role: string): boolean {
  return role !== 'Viewer';
}

/** Nav links visible to each role */
export function getAllowedNavLinks(role: string): NavLink[] {
  const links: NavLink[] = [
    { label: 'Overview', href: '/dashboard', icon: '🏭' },
  ];

  if (canViewDept(role, 'mechanical')) {
    links.push({ label: 'Mechanical', href: '/dashboard/mechanical', icon: '⚙️' });
  }
  if (canViewDept(role, 'electrical')) {
    links.push({ label: 'Electrical', href: '/dashboard/electrical', icon: '⚡' });
  }
  if (canViewDept(role, 'housekeeping')) {
    links.push({ label: 'Housekeeping', href: '/dashboard/housekeeping', icon: '🧹' });
  }
  if (canViewAdmin(role)) {
    links.push({ label: 'Admin Panel', href: '/dashboard/admin', icon: '🛡️' });
  }

  return links;
}

export interface NavLink {
  label: string;
  href: string;
  icon: string;
}
