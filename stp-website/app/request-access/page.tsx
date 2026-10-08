'use client';

import React, { useState } from 'react';
import { useActionState } from 'react';
import { submitRegistrationRequest, type RegistrationRequestState } from '@/app/actions/registration';
import Link from 'next/link';

const DEPARTMENTS = ['Mechanical', 'Electrical', 'Housekeeping', 'Laboratory', 'Viewer'];

const INIT: RegistrationRequestState = { success: false, message: '' };

export default function RequestAccessPage() {
  const [state, action, pending] = useActionState(submitRegistrationRequest, INIT);
  const [dept, setDept] = useState('');

  if (state.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 relative">
        <div className="absolute top-0 left-0 w-full h-2/5 bg-[#0062b8] z-0 shadow-lg" />
        <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border-2 border-[#ffcc00] shadow-2xl overflow-hidden">
          <div className="bg-[#0062b8] p-8 flex flex-col items-center border-b-2 border-[#ffcc00]">
            <div className="border-2 border-[#ffcc00] rounded-xl px-8 py-2 mb-3 shadow-md">
              <h1 className="text-white text-6xl font-extrabold tracking-wide">AIP</h1>
            </div>
            <h2 className="text-white text-2xl font-bold uppercase tracking-wider">7 MGD STP SONIA VIHAR</h2>
          </div>
          <div className="p-10 flex flex-col items-center gap-4">
            <div className="text-6xl">📬</div>
            <h3 className="text-xl font-bold text-gray-800 text-center">Request Submitted!</h3>
            <p className="text-gray-500 text-sm text-center leading-relaxed">
              Your request has been sent to the administrator. You will receive an email at the address you provided once it is reviewed.
            </p>
            <Link href="/login" className="mt-4 text-sm text-[#0062b8] font-semibold hover:underline">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative py-12">
      <div className="absolute top-0 left-0 w-full h-2/5 bg-[#0062b8] z-0 shadow-lg" />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl border-2 border-[#ffcc00] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#0062b8] p-8 flex flex-col items-center justify-center border-b-2 border-[#ffcc00]">
          <div className="border-2 border-[#ffcc00] rounded-xl px-8 py-2 mb-3 shadow-md">
            <h1 className="text-white text-6xl font-extrabold tracking-wide">AIP</h1>
          </div>
          <h2 className="text-white text-2xl font-bold uppercase tracking-wider drop-shadow-md">
            7 MGD STP SONIA VIHAR
          </h2>
          <p className="text-[#fde68a] text-sm mt-2">Request Portal Access</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-1 text-center">Request Account Access</h3>
          <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
            Fill in your details below. The administrator will review your request and send you login credentials by email.
          </p>

          {state.message && !state.success && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm text-center">
              {state.message}
            </div>
          )}

          <form action={action} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                id="req-full-name"
                name="fullName"
                type="text"
                required
                disabled={pending}
                className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] outline-none transition-all"
                placeholder="e.g. Rajesh Kumar"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                id="req-email"
                name="email"
                type="email"
                required
                disabled={pending}
                className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] outline-none transition-all"
                placeholder="your.email@example.com"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
              <select
                id="req-department"
                name="department"
                required
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                disabled={pending}
                className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] outline-none transition-all bg-white"
              >
                <option value="">Select your department…</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Employee ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID <span className="text-gray-400">(optional)</span></label>
              <input
                id="req-employee-id"
                name="employeeId"
                type="text"
                disabled={pending}
                className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] outline-none transition-all"
                placeholder="e.g. EMP-042"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
              <textarea
                id="req-notes"
                name="notes"
                rows={2}
                disabled={pending}
                className="w-full px-4 py-2.5 border border-[#ffcc00] text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] outline-none transition-all resize-none"
                placeholder="Any additional information for the admin…"
              />
            </div>

            {/* Submit */}
            <button
              id="req-submit-btn"
              type="submit"
              disabled={pending}
              className="w-full mt-2 bg-[#0062b8] text-white font-bold text-lg py-3 px-4 rounded-lg hover:bg-[#004f96] border-2 border-transparent hover:border-[#ffcc00] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pending ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Submitting…
                </>
              ) : '📨 Submit Access Request'}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-[#0062b8] font-semibold hover:underline">Log in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
