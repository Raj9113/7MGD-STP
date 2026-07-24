'use client';

import { useActionState } from 'react';
import { inviteUser, type InviteUserState } from '@/app/actions/users';

const DEPARTMENTS = ['Mechanical', 'Electrical', 'Housekeeping', 'Viewer', 'Admin'];

const INITIAL_STATE: InviteUserState = { success: false, message: '' };

export default function InviteUserForm() {
  const [state, formAction, isPending] = useActionState(inviteUser, INITIAL_STATE);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#0062b8]/5 to-transparent">
        <h3 className="text-lg font-bold text-gray-800">➕ Invite New User</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          The user will receive an email with a link to set their password.
        </p>
      </div>

      <form action={formAction} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              name="fullName"
              type="text"
              required
              disabled={isPending}
              placeholder="e.g. Rajesh Kumar"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all disabled:opacity-60 text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              disabled={isPending}
              placeholder="e.g. rajesh@example.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all disabled:opacity-60 text-sm"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Department / Role <span className="text-red-500">*</span>
            </label>
            <select
              name="department"
              required
              disabled={isPending}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 bg-white focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all disabled:opacity-60 text-sm"
            >
              <option value="">— Select Department —</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Employee ID */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Employee ID <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              name="employeeId"
              type="text"
              disabled={isPending}
              placeholder="e.g. EMP-042"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-[#0062b8] focus:border-[#0062b8] outline-none transition-all disabled:opacity-60 text-sm"
            />
          </div>
        </div>

        {/* Feedback message */}
        {state.message && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              state.success
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {state.message}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#0062b8] text-white font-bold text-sm px-6 py-2.5 rounded-lg border-2 border-transparent hover:border-[#ffcc00] hover:bg-[#004f96] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Sending Invite…
              </>
            ) : (
              '📧 Send Invite'
            )}
          </button>
          <p className="text-xs text-gray-400">
            An invitation email will be sent to the user's address.
          </p>
        </div>
      </form>
    </div>
  );
}
