'use client';

import { useActionState, useState } from 'react';
import { updateUserDepartment, deleteUser, type UpdateDeptState, type DeleteUserState } from '@/app/actions/users';

const DEPARTMENTS = ['Mechanical', 'Electrical', 'Housekeeping', 'Viewer', 'Admin'];

const DEPT_BADGE: Record<string, string> = {
  Mechanical: 'bg-orange-100 text-orange-700',
  Electrical: 'bg-yellow-100 text-yellow-700',
  Housekeeping: 'bg-green-100 text-green-700',
  Admin: 'bg-purple-100 text-purple-700',
  Viewer: 'bg-gray-100 text-gray-600',
};

interface Profile {
  id: string;
  full_name: string | null;
  department: string | null;
  employee_id: string | null;
  created_at: string | null;
}

// ── Edit Row ─────────────────────────────────────────────────────────────────

const INIT_UPDATE: UpdateDeptState = { success: false, message: '' };
const INIT_DELETE: DeleteUserState = { success: false, message: '' };

function UserRow({ profile, index }: { profile: Profile; index: number }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState(updateUserDepartment, INIT_UPDATE);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteUser, INIT_DELETE);

  const dept = profile.department ?? 'Unassigned';

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td className="px-5 py-3 text-gray-400 text-xs">{index + 1}</td>
        <td className="px-5 py-3 font-semibold text-gray-800">
          {profile.full_name || <span className="text-gray-400 italic text-sm">Not set</span>}
        </td>
        <td className="px-5 py-3 font-mono text-xs text-gray-500">{profile.employee_id || '—'}</td>
        <td className="px-5 py-3">
          {profile.department ? (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DEPT_BADGE[profile.department] ?? 'bg-gray-100 text-gray-600'}`}>
              {profile.department}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Unassigned</span>
          )}
        </td>
        <td className="px-5 py-3 text-gray-400 text-xs">
          {profile.created_at
            ? new Date(profile.created_at).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
            : '—'}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(!editing); setConfirmDelete(false); }}
              className="text-xs text-[#0062b8] font-semibold hover:underline"
            >
              {editing ? 'Cancel' : 'Edit Role'}
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => { setConfirmDelete(!confirmDelete); setEditing(false); }}
              className="text-xs text-red-500 font-semibold hover:underline"
            >
              {confirmDelete ? 'Cancel' : 'Delete'}
            </button>
          </div>
        </td>
      </tr>

      {/* Edit Department Row */}
      {editing && (
        <tr className="bg-blue-50">
          <td colSpan={6} className="px-5 py-3">
            <form action={updateAction} className="flex items-center gap-3 flex-wrap">
              <input type="hidden" name="userId" value={profile.id} />
              <span className="text-sm text-gray-600 font-medium">
                Change <strong>{profile.full_name || 'this user'}</strong>&apos;s role to:
              </span>
              <select
                name="department"
                defaultValue={dept}
                disabled={updatePending}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-[#0062b8] outline-none"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={updatePending}
                className="text-sm bg-[#0062b8] text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-[#004f96] transition-all disabled:opacity-60 flex items-center gap-1.5"
              >
                {updatePending ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Saving…
                  </>
                ) : '✓ Save'}
              </button>
              {updateState.message && (
                <span className={`text-xs font-medium ${updateState.success ? 'text-green-700' : 'text-red-700'}`}>
                  {updateState.message}
                </span>
              )}
            </form>
          </td>
        </tr>
      )}

      {/* Delete Confirm Row */}
      {confirmDelete && (
        <tr className="bg-red-50">
          <td colSpan={6} className="px-5 py-3">
            <form action={deleteAction} className="flex items-center gap-3 flex-wrap">
              <input type="hidden" name="userId" value={profile.id} />
              <span className="text-sm text-red-700 font-medium">
                ⚠️ Permanently delete <strong>{profile.full_name || profile.id}</strong>? This cannot be undone.
              </span>
              <button
                type="submit"
                disabled={deletePending}
                className="text-sm bg-red-600 text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-red-700 transition-all disabled:opacity-60 flex items-center gap-1.5"
              >
                {deletePending ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Deleting…
                  </>
                ) : '🗑 Yes, Delete'}
              </button>
              {deleteState.message && (
                <span className={`text-xs font-medium ${deleteState.success ? 'text-green-700' : 'text-red-700'}`}>
                  {deleteState.message}
                </span>
              )}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Table ────────────────────────────────────────────────────────────────

interface UsersTableProps {
  profiles: Profile[];
}

export default function UsersTable({ profiles }: UsersTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">All Registered Users</h3>
          <p className="text-sm text-gray-500">
            {profiles.length} user{profiles.length !== 1 ? 's' : ''} in the system
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['#', 'Full Name', 'Employee ID', 'Department / Role', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p, i) => (
              <UserRow key={p.id} profile={p} index={i} />
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                  No users found. Use the form above to invite your first user.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
