import { redirect } from 'next/navigation';

export default function RootPage() {
  // Root redirects to /login; middleware handles further routing
  redirect('/login');
}