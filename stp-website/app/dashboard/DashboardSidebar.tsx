'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAllowedNavLinks } from '@/lib/access';

interface DashboardSidebarProps {
  role: string;
}

export default function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname();
  const links = getAllowedNavLinks(role);

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 shadow-sm min-h-full flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Navigation</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => {
          const isActive =
            link.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-[#0062b8] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-[#0062b8]'
              }`}
            >
              <span className="text-lg leading-none">{link.icon}</span>
              <span>{link.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ffcc00]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Request Role Change — for non-admin users */}
      {role !== 'Admin' && (
        <div className="px-3 pb-2">
          <Link
            href="/dashboard/request-role"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname.startsWith('/dashboard/request-role')
                ? 'bg-[#0062b8] text-white shadow-sm'
                : 'text-[#0062b8] border border-[#0062b8]/30 hover:bg-blue-50'
            }`}
          >
            <span className="text-lg leading-none">⬆️</span>
            <span>Request Role Change</span>
          </Link>
        </div>
      )}

      {/* Role badge at bottom */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Logged in as</span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              role === 'Admin'
                ? 'bg-purple-100 text-purple-700'
                : role === 'Viewer'
                ? 'bg-gray-100 text-gray-600'
                : role === 'Mechanical'
                ? 'bg-orange-100 text-orange-700'
                : role === 'Electrical'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {role}
          </span>
        </div>
        {role === 'Viewer' && (
          <p className="text-xs text-gray-400 mt-1">👁 Read-only access</p>
        )}
      </div>
    </aside>
  );
}

