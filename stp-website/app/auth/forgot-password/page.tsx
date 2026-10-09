'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // The email link returns through /auth/callback, which signs the user in and opens the set-password page
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password`,
    });

    setLoading(false);
    // Do not reveal whether the address has an account; only report real failures (rate limit, mail service)
    if (resetError && resetError.status !== 400) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative px-4 py-6 sm:px-6">
      <div className="absolute top-0 left-0 w-full h-2/5 bg-[#0062b8] z-0 shadow-lg" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border-2 border-[#ffcc00] shadow-2xl overflow-hidden">
        <div className="bg-[#0062b8] p-8 flex flex-col items-center justify-center border-b-2 border-[#ffcc00]">
          <div className="border-2 border-[#ffcc00] rounded-xl px-8 py-2 mb-3 shadow-md">
            <h1 className="text-white text-6xl font-extrabold tracking-wide">AIP</h1>
          </div>
          <h2 className="text-white text-2xl font-bold uppercase tracking-wider drop-shadow-md text-center">7 MGD STP SONIA VIHAR</h2>
        </div>

        <div className="p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-1 text-center">Reset Your Password</h3>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="text-5xl">📧</div>
              <p className="text-gray-700 text-sm">
                If <span className="font-semibold">{email}</span> has an account, a password reset link is on its way. Open it on this device and choose a new password.
              </p>
              <p className="text-xs text-gray-400">The link works once and expires soon. Check the spam folder if you do not see it.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 text-center mb-6">Enter your registered email and we will send you a link to set a new password.</p>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm text-center">{error}</div>
              )}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all"
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0062b8] text-white font-bold text-lg py-3 px-4 rounded-lg hover:bg-[#004f96] border-2 border-transparent hover:border-[#ffcc00] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <Link href="/login" className="text-sm font-semibold text-[#0062b8] hover:underline">← Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
