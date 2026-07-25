'use client';

import { useState } from 'react';
import DashboardNav from './DashboardNav';
import DashboardSidebar from './DashboardSidebar';

interface DashboardShellProps {
  children: React.ReactNode;
  email: string;
  fullName: string;
  department: string;
  employeeId: string;
}

export default function DashboardShell({
  children,
  email,
  fullName,
  department,
  employeeId,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardNav
        email={email}
        fullName={fullName}
        department={department}
        employeeId={employeeId}
        onMenuClick={() => setSidebarOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Mobile Overlay Backdrop ─────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        {/*
          On desktop (md+): always visible, static, takes space in the flex row.
          On mobile: fixed drawer that slides in from the left over the content.
        */}
        <div
          className={`
            fixed inset-y-0 left-0 z-40 md:static md:z-auto
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
          `}
        >
          <DashboardSidebar
            role={department}
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>

        {/* ── Main Content ─────────────────────────────────────────────── */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
