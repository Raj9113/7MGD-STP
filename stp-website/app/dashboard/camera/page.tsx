import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CameraFeed from './CameraFeed';

export const metadata = {
  title: 'Live Camera — 7 MGD STP',
  description: 'Live CCTV camera feed for the 7 MGD STP Sonia Vihar plant.',
};

export default async function CameraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <CameraFeed />;
}
