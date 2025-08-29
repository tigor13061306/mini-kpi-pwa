'use client';

interface FiltersProps {
  fromDate: string;
  toDate: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  periodLabel: string;
  onReset: () => void;
}

export default function Filters({
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  periodLabel,
  onReset,
}: FiltersProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-sm text-white/80 mb-1">Od</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-white/80 mb-1">Do</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
        <div className="flex gap-2 md:col-span-3">
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            Poništi
          </button>
        </div>
      </div>
      <div className="text-white/80 text-sm">{periodLabel}</div>
    </div>
  );
}
