'use client';

import { useActionState } from 'react';
import { submitRoleRequest, type RoleRequestState } from '@/app/actions/role-request';
import Link from 'next/link';

const DEPARTMENTS = ['Mechanical', 'Electrical', 'Housekeeping', 'Viewer'];

const DEPT_INFO: Record<string, { icon: string; desc: string }> = {
  Mechanical: { icon: '⚙️', desc: 'Can log mechanical entries and update work orders.' },
  Electrical: { icon: '⚡', desc: 'Can log electrical entries and acknowledge alarms.' },
  Housekeeping: { icon: '🧹', desc: 'Can update tasks and log sludge disposal.' },
  Viewer: { icon: '👁', desc: 'Read-only access to all department pages.' },
};

const INIT: RoleRequestState = { success: false, message: '' };

export default function RequestRolePage() {
  const [state, action, pending] = useActionState(submitRoleRequest, INIT);

  if (state.success) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">📬</p>
          <p className="text-lg font-bold text-green-800">Request Submitted!</p>
          <p className="text-sm text-green-700 mt-2 leading-relaxed">{state.message}</p>
          <Link
            href="/dashboard"
            className="inline-block mt-5 text-sm text-[#0062b8] font-semibold hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">⬆️ Request Role Promotion</h2>
        <p className="text-gray-500 text-sm mt-0.5">
          Submit a request to the admin to change your department access level.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {state.message && !state.success && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {state.message}
          </div>
        )}

        <form action={action} className="space-y-5">

          {/* Requested Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Requested Department / Role *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {DEPARTMENTS.map((d) => {
                const info = DEPT_INFO[d];
                return (
                  <label
                    key={d}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-[#0062b8] hover:bg-blue-50/40 transition-all has-[:checked]:border-[#0062b8] has-[:checked]:bg-blue-50"
                  >
                    <input
                      type="radio"
                      name="requestedDept"
                      value={d}
                      className="mt-0.5 accent-[#0062b8]"
                      required
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{info.icon} {d}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Reason for Request <span className="text-gray-400 font-normal">(optional but recommended)</span>
            </label>
            <textarea
              id="role-req-reason"
              name="reason"
              rows={3}
              disabled={pending}
              className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg focus:ring-2 focus:ring-[#0062b8] outline-none transition-all resize-none text-sm"
              placeholder="Explain why you need this role change…"
            />
          </div>

          {/* Submit */}
          <button
            id="role-req-submit-btn"
            type="submit"
            disabled={pending}
            className="w-full bg-[#0062b8] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#004f96] border-2 border-transparent hover:border-[#ffcc00] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Submitting…
              </>
            ) : '📨 Send Role Request to Admin'}
          </button>
        </form>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>ℹ️ How this works:</strong> Your request is sent to the admin by email. If approved, your role will update automatically and you will receive a confirmation email. You only need to log out and back in for the new permissions to take effect.
        </p>
      </div>
    </div>
  );
}
