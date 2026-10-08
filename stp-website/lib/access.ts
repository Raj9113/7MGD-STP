/**
 * Role-based access control utilities for the 7MGD STP portal.
 *
 * Roles: 'Mechanical' | 'Electrical' | 'Housekeeping' | 'Laboratory' | 'Admin' | 'Viewer'
 *
 * Viewer  → read-only access to ALL department pages
 * Admin   → full access to ALL department pages + admin panel
 * Others  → full access to THEIR OWN department page only
 */

export type STPRole = 'Mechanical' | 'Electrical' | 'Housekeeping' | 'Laboratory' | 'Admin' | 'Viewer';

/** Can this role view the live camera feed? Currently all logged-in roles can. */
export function canViewCamera(_role: string): boolean {
  return true; // Change to: return role === 'Admin'; to restrict access
}

export type DeptSlug = 'mechanical' | 'electrical' | 'housekeeping' | 'laboratory';

const DEPT_SLUG_TO_ROLE: Record<DeptSlug, STPRole> = {
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  housekeeping: 'Housekeeping',
  laboratory: 'Laboratory',
};

/** Can this role view a specific department page? */
export function canViewDept(role: string, dept: DeptSlug): boolean {
  if (role === 'Admin' || role === 'Viewer') return true;
  return role === DEPT_SLUG_TO_ROLE[dept];
}

/** Can this role enter / correct Laboratory reports? (the chemist and assistant have the Laboratory role) */
export function canEditLab(role: string): boolean {
  return role === 'Admin' || role === 'Laboratory';
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
  if (canViewDept(role, 'laboratory')) {
    links.push({ label: 'Laboratory', href: '/dashboard/laboratory', icon: '🧪' });
  }
  if (canViewCamera(role)) {
    links.push({ label: 'Live Camera', href: '/dashboard/camera', icon: '📷' });
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
