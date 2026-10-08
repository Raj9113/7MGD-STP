'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LoadingOverlay from './LoadingOverlay';

const DEPT_COLORS: Record<string, string> = {
  Mechanical: 'bg-orange-100 text-orange-800',
  Electrical: 'bg-yellow-100 text-yellow-800',
  Housekeeping: 'bg-green-100 text-green-800',
  Laboratory: 'bg-cyan-100 text-cyan-800',
  Admin: 'bg-purple-100 text-purple-800',
};

interface DashboardNavProps {
  email: string;
  fullName: string;
  department: string;
  employeeId: string;
  onMenuClick: () => void;
}

export default function DashboardNav({
  email,
  fullName,
  department,
  employeeId,
  onMenuClick,
}: DashboardNavProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const badgeClass = DEPT_COLORS[department] ?? 'bg-gray-100 text-gray-800';

  return (
    <nav className="bg-[#0062b8] shadow-md border-b-2 border-[#ffcc00]">
      <LoadingOverlay show={loggingOut} text="Signing out…" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Hamburger (mobile) + Logo + Title */}
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            id="sidebar-toggle-btn"
            onClick={onMenuClick}
            className="md:hidden text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open navigation"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="border-2 border-[#ffcc00] rounded-lg px-3 py-0.5">
            <span className="text-white text-xl font-extrabold tracking-wide">AIP</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">7 MGD STP</p>
            <p className="text-[#ffcc00] text-xs leading-tight">Sonia Vihar</p>
          </div>
        </div>

        {/* Right: User Info + Logout */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-semibold leading-tight">{fullName}</p>
            <p className="text-blue-200 text-xs leading-tight">{email}</p>
            {employeeId && (
              <p className="text-blue-300 text-xs leading-tight">ID: {employeeId}</p>
            )}
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
            {department}
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm bg-white text-[#0062b8] font-bold px-4 py-1.5 rounded-lg border-2 border-[#ffcc00] hover:bg-[#ffcc00] hover:text-[#0062b8] transition-all disabled:opacity-60"
          >
            {loggingOut ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      </div>
    </nav>
  );
}
