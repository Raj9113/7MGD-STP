export const ACTION_TYPES = ['ALL', 'LOGIN', 'LOGOUT', 'INVITE_USER', 'UPDATE_ROLE', 'DELETE_USER', 'DATA_ENTRY', 'DATA_UPDATE', 'DATA_DELETE'];

export const ACTION_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  LOGIN: { bg: 'bg-green-100', text: 'text-green-700', label: '🔑 Login' },
  LOGOUT: { bg: 'bg-gray-100', text: 'text-gray-600', label: '🚪 Logout' },
  INVITE_USER: { bg: 'bg-blue-100', text: 'text-blue-700', label: '📨 Invite' },
  UPDATE_ROLE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '✏️ Role Change' },
  DELETE_USER: { bg: 'bg-red-100', text: 'text-red-700', label: '🗑 Delete User' },
  DATA_ENTRY: { bg: 'bg-purple-100', text: 'text-purple-700', label: '📝 Data Entry' },
  DATA_UPDATE: { bg: 'bg-orange-100', text: 'text-orange-700', label: '🔄 Data Update' },
  DATA_DELETE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ Data Delete' },
};

export const PAGE_SIZE = 25;
