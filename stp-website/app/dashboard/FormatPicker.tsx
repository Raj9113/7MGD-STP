'use client';

export type Format = 'pdf' | 'docx' | 'xlsx';

export const FORMAT_INFO: Record<Format, { label: string; icon: string; ext: string; busy: string }> = {
  pdf: { label: 'PDF', icon: '📕', ext: '.pdf', busy: 'Preparing the PDF…' },
  docx: { label: 'Word', icon: '📘', ext: '.docx', busy: 'Preparing the Word file…' },
  xlsx: { label: 'Excel', icon: '📗', ext: '.xlsx', busy: 'Preparing the Excel file…' },
};

export default function FormatPicker({
  value, onChange, formats = ['pdf', 'docx', 'xlsx'], disabled = false,
}: { value: Format; onChange: (f: Format) => void; formats?: Format[]; disabled?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600">Download as</p>
      <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Download format">
        {formats.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={value === f}
            disabled={disabled}
            onClick={() => onChange(f)}
            className={`h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              value === f ? 'border-[#0062b8] bg-[#0062b8] text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-[#0062b8]'}`}
          >
            <span aria-hidden>{FORMAT_INFO[f].icon}</span> {FORMAT_INFO[f].label} <span className="font-normal opacity-70">{FORMAT_INFO[f].ext}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
