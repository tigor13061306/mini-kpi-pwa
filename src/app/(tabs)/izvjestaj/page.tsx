'use client';

import { useMemo, useState } from 'react';
import { db } from '@/lib/db';
import { exportActivitiesToExcel } from '@/lib/excel';
import type { ActivityItem } from '@/lib/types';

export default function IzvjestajPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<'day' | 'period'>('day');
  const [day, setDay] = useState<string>(today);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  // === Dexie upiti ===
  // Za "jedan dan" koristimo between(d, d+'\uffff') da pokupi i ISO stringove sa vremenom.
  async function fetchByDay(d: string): Promise<ActivityItem[]> {
    const lo = d;
    const hi = d + '\uffff';
    return db.activities
      .where('datum')
      .between(lo, hi, true, true)
      .sortBy('datum');
  }

  async function fetchByPeriod(a: string, b: string): Promise<ActivityItem[]> {
    const [fromD, toD] = a <= b ? [a, b] : [b, a];
    const lo = fromD;
    const hi = toD + '\uffff'; // uključi cijeli dan "toD"
    return db.activities
      .where('datum')
      .between(lo, hi, true, true)
      .sortBy('datum');
  }

  const periodLabel = useMemo(() => {
    if (mode === 'day') return day;
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    return `${lo} → ${hi}`;
  }, [mode, day, from, to]);

  async function handleExport() {
    if (mode === 'day' && !day) {
      alert('Odaberi dan.');
      return;
    }
    if (mode === 'period') {
      if (!from) return alert('Unesi datum "Od".');
      if (!to) return alert('Unesi datum "Do".');
    }

    setBusy(true);
    try {
      let rows: ActivityItem[] = [];

      if (mode === 'day') {
        rows = await fetchByDay(day);
      } else {
        rows = await fetchByPeriod(from, to);
      }

      setCount(rows.length);
      if (rows.length === 0) {
        alert('Nema podataka za odabrani dan/period.');
        return; // ne eksportuj prazan Excel
      }

      await exportActivitiesToExcel(
        rows,
        mode === 'day' ? { kind: 'day', day } : { kind: 'period', from, to },
      );
    } catch (err) {
      console.error(err);
      alert('Greška pri generisanju Excel izvještaja. Provjeri konzolu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Izvještaj (dnevni / period)</h1>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === 'day'}
            onChange={() => setMode('day')}
          />
          Jedan dan
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === 'period'}
            onChange={() => setMode('period')}
          />
          Period (od–do)
        </label>
      </div>

      {mode === 'day' ? (
        <div className="flex items-center gap-3">
          <div className="grid gap-1">
            <label>Dan</label>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="bg-neutral-900 rounded px-3 py-2"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <div className="grid gap-1">
            <label>Od</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-neutral-900 rounded px-3 py-2"
            />
          </div>
          <div className="grid gap-1">
            <label>Do</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-neutral-900 rounded px-3 py-2"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          onClick={handleExport}
          className="bg-sky-600 hover:bg-sky-500 rounded px-4 py-2 disabled:opacity-60"
        >
          {busy ? 'Pripremam Excel…' : 'Napravi Excel (.xlsx)'}
        </button>
        <span className="text-sm opacity-80">
          {count === null
            ? `Odabir: ${periodLabel}`
            : `Zapisa: ${count} — ${periodLabel}`}
        </span>
      </div>

      <p className="text-xs opacity-70">
        Excel fajl sadrži sve kolone + <b>ugrađene fotografije</b> (ne linkove).
        Naziv se generiše automatski.
      </p>
    </div>
  );
}
