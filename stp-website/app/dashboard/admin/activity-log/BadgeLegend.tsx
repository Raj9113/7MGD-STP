import { ACTION_BADGE } from './constants';

export default function BadgeLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(ACTION_BADGE).map(([key, val]) => (
        <span key={key} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${val.bg} ${val.text}`}>
          {val.label}
        </span>
      ))}
    </div>
  );
}
