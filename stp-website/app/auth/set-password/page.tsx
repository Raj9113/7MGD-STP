'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isTempPassword, setIsTempPassword] = useState(false);
  const [checking, setChecking] = useState(true);

  // Verify the user has an active session (arrived via invite link or must_change_password)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        // No session: the link expired / was already used (mail scanners often open it first)
        router.replace('/login?error=invite_expired');
        return;
      }
      setUserEmail(user.email ?? null);
      setUserId(user.id);
      // Check if this is a forced password-change (temp password flow)
      const { data: profile } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', user.id)
        .single();
      if (profile?.must_change_password) setIsTempPassword(true);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // If this was a temp-password forced change, clear the flag
    if (isTempPassword && userId) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', userId);
    }

    setSuccess(true);

    // Wait 2 seconds then redirect to dashboard
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 2000);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Verifying your invite link…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative">
      {/* Background Half-Blue Design */}
      <div className="absolute top-0 left-0 w-full h-2/5 bg-[#0062b8] z-0 shadow-lg" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border-2 border-[#ffcc00] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#0062b8] p-8 flex flex-col items-center justify-center border-b-2 border-[#ffcc00]">
          <div className="border-2 border-[#ffcc00] rounded-xl px-8 py-2 mb-3 shadow-md">
            <h1 className="text-white text-6xl font-extrabold tracking-wide">AIP</h1>
          </div>
          <h2 className="text-white text-2xl font-bold uppercase tracking-wider drop-shadow-md">
            7 MGD STP SONIA VIHAR
          </h2>
        </div>

        {/* Form */}
        <div className="p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-1 text-center">
            Welcome! Set Your Password
          </h3>
          {userEmail && (
            <p className="text-sm text-gray-500 text-center mb-6">
              Setting up account for <span className="font-semibold text-[#0062b8]">{userEmail}</span>
            </p>
          )}

          {success ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-5xl">✅</div>
              <p className="text-green-700 font-bold text-lg text-center">Password set successfully!</p>
              <p className="text-gray-500 text-sm text-center">Redirecting you to the dashboard…</p>
              <svg className="animate-spin h-5 w-5 text-[#0062b8]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm text-center">
                  {error}
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    id="set-password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    disabled={loading}
                    autoFocus
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="set-password-confirm-input"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all"
                    placeholder="Re-enter your password"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Password strength hint */}
                <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                  <li className={password.length >= 8 ? 'text-green-600' : ''}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>One uppercase letter (recommended)</li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>One number (recommended)</li>
                </ul>

                <button
                  id="set-password-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-[#0062b8] text-white font-bold text-lg py-3 px-4 rounded-lg hover:bg-[#004f96] border-2 border-transparent hover:border-[#ffcc00] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Setting password…
                    </>
                  ) : (
                    '🔒 Set My Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
