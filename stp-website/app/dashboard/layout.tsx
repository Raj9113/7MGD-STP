import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardShell from './DashboardShell';

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
    <DashboardShell
      email={user.email ?? ''}
      fullName={profile?.full_name ?? 'User'}
      department={department}
      employeeId={profile?.employee_id ?? ''}
    >
      {children}
    </DashboardShell>
  );
}
