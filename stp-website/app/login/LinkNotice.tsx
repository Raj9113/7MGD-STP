'use client';

import { useSearchParams } from 'next/navigation';

const MESSAGES: Record<string, string> = {
  auth_callback_failed: 'That email link could not be used. It may have expired or already been opened. Ask an admin to send a new invitation.',
  invite_expired: 'Your invitation link has expired or was already used. Ask an admin to send a new invitation, or log in below if you already set a password.',
};

/** Explains why the user landed here after a failed invite / reset link (the login page used to ignore ?error=) */
export default function LinkNotice() {
  const code = useSearchParams().get('error');
  if (!code) return null;
  return (
    <div role="alert" className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm text-center">
      {MESSAGES[code] ?? 'Something went wrong with that link. Please try again.'}
    </div>
  );
}
