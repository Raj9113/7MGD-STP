import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardNav from './DashboardNav';
import DashboardSidebar from './DashboardSidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, department, employee_id')
    .eq('id', user.id)
    .single();

  const department = profile?.department ?? 'Unknown';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardNav
        email={user.email ?? ''}
        fullName={profile?.full_name ?? 'User'}
        department={department}
        employeeId={profile?.employee_id ?? ''}
      />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar role={department} />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
