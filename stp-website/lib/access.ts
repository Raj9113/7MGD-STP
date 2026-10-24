export type STPRole = 'Mechanical' | 'Electrical' | 'Housekeeping' | 'Laboratory' | 'Admin' | 'Viewer';

export function canViewCamera(_role: string): boolean {
  return true;
}

export type DeptSlug = 'mechanical' | 'electrical' | 'housekeeping' | 'laboratory';

const DEPT_SLUG_TO_ROLE: Record<DeptSlug, STPRole> = {
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  housekeeping: 'Housekeeping',
  laboratory: 'Laboratory',
};

export function canViewDept(role: string, dept: DeptSlug): boolean {
  if (role === 'Admin' || role === 'Viewer') return true;
  return role === DEPT_SLUG_TO_ROLE[dept];
}

export function canEditLab(role: string): boolean {
  return role === 'Admin' || role === 'Laboratory';
}

export function canEditDept(role: string, dept: DeptSlug): boolean {
  return role === 'Admin' || role === DEPT_SLUG_TO_ROLE[dept];
}

export function canViewAdmin(role: string): boolean {
  return role === 'Admin';
}

export function isReadOnly(role: string): boolean {
  return role === 'Viewer';
}

export function canEdit(role: string): boolean {
  return role !== 'Viewer';
}

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
