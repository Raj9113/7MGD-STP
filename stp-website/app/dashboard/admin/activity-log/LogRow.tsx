import type { ActivityLog } from '@/app/actions/logs';
import { ACTION_BADGE } from './constants';
import { formatDate, parseBrowser, parseDevice } from './utils';

interface LogRowProps {
  log: ActivityLog;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function LogRow({ log, isExpanded, onToggle }: LogRowProps) {
  const { date, time } = formatDate(log.created_at);
  const badge = ACTION_BADGE[log.action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: log.action };

  return (
    <tr
      onClick={onToggle}
      className="hover:bg-blue-50/40 transition-colors border-b border-gray-100 cursor-pointer"
    >
      {/* Date & Time */}
      <td className="px-5 py-3 whitespace-nowrap">
        <p className="text-gray-800 font-medium text-xs">{date}</p>
        <p className="text-gray-400 text-xs font-mono">{time}</p>
      </td>

      {/* Action Badge */}
      <td className="px-5 py-3 whitespace-nowrap">
        <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </td>

      {/* User */}
      <td className="px-5 py-3">
        <p className="text-gray-800 font-semibold text-xs">{log.user_name || '—'}</p>
        <p className="text-gray-400 text-xs">{log.user_email || ''}</p>
      </td>

      {/* Department */}
      <td className="px-5 py-3">
        <span className="text-xs text-gray-600">{log.department || '—'}</span>
      </td>

      {/* Details */}
      <td className="px-5 py-3 max-w-50">
        <p className={`text-xs text-gray-600 ${isExpanded ? '' : 'line-clamp-2'}`}>
          {log.details || '—'}
        </p>
        {log.details && log.details.length > 80 && (
          <span className="text-xs text-[#0062b8] font-medium mt-0.5 inline-block">
            {isExpanded ? '▲ Less' : '▼ More'}
          </span>
        )}
      </td>

      {/* Location */}
      <td className="px-5 py-3 whitespace-nowrap">
        <p className="text-xs text-gray-700">
          {log.city && log.country ? `${log.city}, ${log.country}` : log.city || log.country || '—'}
        </p>
        <p className="text-xs text-gray-400 font-mono">{log.ip_address || ''}</p>
      </td>

      {/* Device */}
      <td className="px-5 py-3 whitespace-nowrap">
        <p className="text-xs text-gray-700">{parseDevice(log.user_agent)}</p>
        <p className="text-xs text-gray-400">{parseBrowser(log.user_agent)}</p>
      </td>
    </tr>
  );
}
