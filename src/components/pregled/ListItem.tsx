'use client';

import type { ActivityItem } from '@/lib/types';
import { fmtDMY, toISODateOnly } from '@/lib/utils';

interface ListItemProps {
  item: ActivityItem;
  thumb?: string;
  onEdit: (item: ActivityItem) => void;
  onRemove: (id: string) => void;
}

export default function ListItem({ item, thumb, onEdit, onRemove }: ListItemProps) {
  const phs = (item as any).fotografije as any[] | undefined;
  const cnt = phs?.length ?? 0;
  return (
    <div
      className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between hover:bg-white/8 transition"
    >
      <div className="flex items-center gap-3 min-w-0">
        {cnt > 0 ? (
          <img
            src={thumb}
            alt=""
            className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 grid place-items-center text-xs text-white/50 shrink-0">
            —
          </div>
        )}
        <div className="min-w-0">
          <div className="text-white font-medium flex items-center gap-2">
            {(item as any).kupac || '—'}
            {cnt > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/10 text-white/80">
                {cnt} sl.
              </span>
            )}
          </div>
          <div className="text-white/70 text-sm">{fmtDMY(toISODateOnly(item.datum))}</div>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onEdit(item)}
          className="px-3 py-1 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
        >
          Uredi
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="px-3 py-1 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
        >
          Obriši
        </button>
      </div>
    </div>
  );
}
