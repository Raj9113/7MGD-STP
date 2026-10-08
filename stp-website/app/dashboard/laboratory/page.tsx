import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { canEditLab, canViewDept } from '@/lib/access';
import LaboratoryView from './LaboratoryView';

export default async function LaboratoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', user.id)
    .single();

  const role = profile?.department ?? 'Unknown';

  if (!canViewDept(role, 'laboratory')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Access Restricted</p>
        <p className="text-sm mt-1">You do not have permission to view the Laboratory department page.</p>
      </div>
    );
  }

  return <LaboratoryView searchParams={searchParams} canEdit={canEditLab(role)} />;
}
