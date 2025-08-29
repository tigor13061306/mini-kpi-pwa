'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '@/lib/db';
import type { ActivityItem, AnyPhoto, EditableDraft } from '@/lib/types';
import { compressImage, fileToBlobUrl, blobToBase64 } from '@/lib/images';
import { fmtDMY, toISODateOnly, normalizePhoto } from '@/lib/utils';

import Filters from '@/components/pregled/Filters';
import ListItem from '@/components/pregled/ListItem';
import EditModal from '@/components/pregled/EditModal';

const todayISO = toISODateOnly(new Date());

const KNOWN_KEYS = new Set([
  'id', 'datum', 'kupac',
  'vrstaKontakta', 'tema', 'napomena', 'crmAzuriran',
  'fotografije',
]);

export default function Page() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [fromDate, setFromDate] = useState<string>(todayISO);
  const [toDate, setToDate] = useState<string>(todayISO);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<EditableDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const modalUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const table: any = (db as any).activities ?? (db as any).table?.('activities');
        const all: ActivityItem[] = table ? await table.toArray() : [];
        const sorted = all.slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
        if (alive) setItems(sorted);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!fromDate && !toDate) return items;
    const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
    const to = toDate ? new Date(toDate + 'T23:59:59') : null;
    return items.filter((it) => {
      const d = new Date(it.datum);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [items, fromDate, toDate]);

  const periodLabel = useMemo(() => {
    if (fromDate && toDate && fromDate === toDate) return `Danas: ${fmtDMY(fromDate)}`;
    if (fromDate && toDate) return `Period: ${fmtDMY(fromDate)} – ${fmtDMY(toDate)}`;
    if (fromDate) return `Od: ${fmtDMY(fromDate)}`;
    if (toDate)   return `Do: ${fmtDMY(toDate)}`;
    return `Danas: ${fmtDMY(toISODateOnly(new Date()))}`;
  }, [fromDate, toDate]);

  useEffect(() => {
    let cancelled = false;
    const urlsToRevoke: string[] = [];

    (async () => {
      const next: Record<string, string> = {};
      for (const it of filtered) {
        const phs = (it as any).fotografije as any[] | undefined;
        if (!phs?.length) continue;
        const n = await normalizePhoto(phs[0]);
        if (n.url) {
          next[it.id] = n.url;
          if (n.url.startsWith('blob:')) urlsToRevoke.push(n.url);
        }
      }
      if (!cancelled) setThumbs(next);
    })();

    return () => {
      cancelled = true;
      urlsToRevoke.forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
    };
  }, [filtered]);

  async function openEdit(it: ActivityItem) {
    modalUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    modalUrlsRef.current = [];

    const rawPhotos = Array.isArray((it as any).fotografije) ? (it as any).fotografije : [];
    const normalized: AnyPhoto[] = [];
    for (const p of rawPhotos) {
      const n = await normalizePhoto(p);
      if (n.url?.startsWith('blob:')) modalUrlsRef.current.push(n.url);
      normalized.push(n);
    }

    const other: Record<string, any> = {};
    Object.keys(it as any).forEach((k) => {
      if (!KNOWN_KEYS.has(k)) other[k] = (it as any)[k];
    });

    setDraft({
      id: it.id,
      datum: it.datum,
      kupac: (it as any).kupac,
      vrstaKontakta: (it as any).vrstaKontakta,
      tema: (it as any).tema,
      napomena: (it as any).napomena,
      crmAzuriran: (it as any).crmAzuriran ?? false,
      fotografije: normalized,
      other,
    });
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setDraft(null);
    modalUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    modalUrlsRef.current = [];
  }

  async function addPhotos(files: FileList | null) {
    if (!files || !draft) return;
    const list = Array.from(files);
    const newItems: AnyPhoto[] = [];
    for (const file of list) {
      const compressed = await compressImage(file);
      const blobUrl = await fileToBlobUrl(compressed);
      const b64 = await blobToBase64(compressed);
      if (blobUrl.startsWith('blob:')) modalUrlsRef.current.push(blobUrl);
      newItems.push({
        id: crypto.randomUUID(),
        blob: compressed,
        url: b64,
        base64: b64,
        type: compressed.type,
      });
    }
    setDraft((d) => (d ? { ...d, fotografije: [...(d.fotografije ?? []), ...newItems] } : d));
  }

  function removePhoto(id: string) {
    setDraft((d) => (d ? { ...d, fotografije: (d.fotografije ?? []).filter((p) => p.id !== id) } : d));
  }

  function clearPhotos() {
    if (!confirm('Obrisati sve fotografije iz ove aktivnosti?')) return;
    setDraft((d) => (d ? { ...d, fotografije: [] } : d));
  }

  function updateOther(key: string, value: any) {
    setDraft((d) => (d ? { ...d, other: { ...(d.other ?? {}), [key]: value } } : d));
  }

  async function saveEdit() {
    if (!draft) return;
    try {
      setSaving(true);
      const table: any = (db as any).activities ?? (db as any).table?.('activities');
      const original: ActivityItem | undefined = await table.get(draft.id);
      if (!original) throw new Error('Stavka nije pronađena.');

      const updated: ActivityItem = {
        ...original,
        id: draft.id,
        datum: draft.datum,
        kupac: draft.kupac,
        ...(typeof draft.vrstaKontakta !== 'undefined' ? { vrstaKontakta: draft.vrstaKontakta } : {}),
        ...(typeof draft.tema !== 'undefined' ? { tema: draft.tema } : {}),
        ...(typeof draft.napomena !== 'undefined' ? { napomena: draft.napomena } : {}),
        ...(typeof draft.crmAzuriran !== 'undefined' ? { crmAzuriran: !!draft.crmAzuriran } : {}),
        ...(draft.fotografije ? { fotografije: draft.fotografije } as any : {}),
        ...(draft.other ?? {}),
      };

      await table.put(updated);

      setItems((prev) => {
        const i = prev.findIndex((x) => x.id === updated.id);
        if (i === -1) return prev;
        const copy = prev.slice();
        copy[i] = updated;
        return copy;
      });

      closeEdit();
    } catch (e) {
      console.error(e);
      alert('Greška pri snimanju izmjena.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Obrisati stavku?')) return;
    try {
      const table: any = (db as any).activities ?? (db as any).table?.('activities');
      await table.delete(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert('Greška pri brisanju.');
    }
  }

  const resetDates = () => {
    const t = toISODateOnly(new Date());
    setFromDate(t);
    setToDate(t);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Filters
        fromDate={fromDate}
        toDate={toDate}
        setFromDate={setFromDate}
        setToDate={setToDate}
        periodLabel={periodLabel}
        onReset={resetDates}
      />

      <div className="space-y-2">
        {loading && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-white/80">
            Učitavam…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-white/80">
            Nema unosa za izabrani period.
          </div>
        )}
        {!loading && filtered.map((it) => (
          <ListItem
            key={it.id}
            item={it}
            thumb={thumbs[it.id]}
            onEdit={openEdit}
            onRemove={remove}
          />
        ))}
      </div>

      {editOpen && draft && (
        <EditModal
          draft={draft}
          onClose={closeEdit}
          onSave={saveEdit}
          saving={saving}
          setDraft={setDraft}
          addPhotos={addPhotos}
          removePhoto={removePhoto}
          clearPhotos={clearPhotos}
          updateOther={updateOther}
        />
      )}
    </div>
  );
}
