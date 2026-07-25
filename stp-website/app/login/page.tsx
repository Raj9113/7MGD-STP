'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // On success, redirect to dashboard
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative">
      {/* Background Half-Blue Design */}
      <div className="absolute top-0 left-0 w-full h-2/5 bg-[#0062b8] z-0 shadow-lg" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border-2 border-[#ffcc00] shadow-2xl overflow-hidden">

        {/* Header Section */}
        <div className="bg-[#0062b8] p-8 flex flex-col items-center justify-center border-b-2 border-[#ffcc00]">
          <div className="border-2 border-[#ffcc00] rounded-xl px-8 py-2 mb-3 shadow-md">
            <h1 className="text-white text-6xl font-extrabold tracking-wide">AIP</h1>
          </div>
          <h2 className="text-white text-2xl font-bold uppercase tracking-wider drop-shadow-md">
            7 MGD STP SONIA VIHAR
          </h2>
        </div>

        {/* Login Form */}
        <div className="p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">
            Department Portal Login
          </h3>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all"
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
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
                  Signing in…
                </>
              ) : (
                'Secure Login'
              )}
            </button>
          </form>

          {/* Request Access Link */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Don&apos;t have an account?
            </p>
            <Link
              href="/request-access"
              id="request-access-link"
              className="inline-block mt-2 text-sm font-semibold text-[#0062b8] hover:underline"
            >
              📨 Request Portal Access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
