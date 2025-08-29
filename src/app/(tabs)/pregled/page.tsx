'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '@/lib/db';
import type { ActivityItem } from '@/lib/types';
import { compressImage, fileToBlobUrl, blobToBase64 } from '@/lib/images';

// ---------- Helpers ----------
function toISODateOnly(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function fmtDMY(dateISO: string) {
  const dt = new Date(dateISO);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}.${m}.${y}`;
}
function toArrayBuffer(data: ArrayBufferLike | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data as ArrayBuffer;
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

const todayISO = toISODateOnly(new Date());

const KNOWN_KEYS = new Set([
  'id',
  'datum',
  'kupac',
  'vrstaKontakta',
  'tema',
  'napomena',
  'crmAzuriran',
  'fotografije',
]);

type AnyPhoto = {
  id: string;
  url?: string; // data: URL ili blob:
  blob?: Blob; // binarno
  type?: string;
  data?: ArrayBufferLike | Uint8Array; // legacy bytes
  base64?: string; // "data:image/...;base64,..." ili samo čisti base64
};

type EditableDraft = {
  id: string;
  datum: string;
  kupac: string;
  vrstaKontakta?: string;
  tema?: string;
  napomena?: string;
  crmAzuriran?: boolean;
  fotografije?: AnyPhoto[];
  other?: Record<string, any>;
};

// Normalizuj fotku → pokušaj napraviti prikazni src
async function normalizePhoto(p: any): Promise<AnyPhoto> {
  const out: AnyPhoto = {
    id: p?.id ?? crypto.randomUUID(),
    blob: p?.blob,
    type: p?.type,
    data: p?.data ?? p?.buf ?? p?.bytes,
    base64: p?.base64 ?? p?.dataUrl ?? p?.data, // prihvati i druga imena ako su string
    url: undefined,
  };

  // 1) ako imamo već data URL u stringu
  if (typeof out.base64 === 'string') {
    out.url = out.base64.startsWith('data:')
      ? out.base64
      : `data:image/jpeg;base64,${out.base64}`;
    return out;
  }
  // 2) Blob -> svjež objectURL
  if (out.blob) {
    out.url = URL.createObjectURL(out.blob);
    return out;
  }
  // 3) bytes -> Blob -> objectURL
  if (out.data && !(out.data as any).startsWith) {
    const ab = toArrayBuffer(out.data);
    out.blob = new Blob([ab], { type: out.type || 'image/jpeg' });
    out.url = URL.createObjectURL(out.blob);
    return out;
  }
  // 4) fallback: koristi p.url ili p.blobUrl (može biti mrtav nakon reloada)
  if (p?.url || p?.blobUrl) out.url = (p.url || p.blobUrl) as string;

  return out;
}

// tipovi kontakta (string da ne koči tipovanje ako je union drugdje)
const VRSTE_KONTAKTA = [
  { value: 'posjeta', label: 'Posjeta' },
  { value: 'poziv', label: 'Poziv' },
  { value: 'email', label: 'Email' },
  { value: 'poruka', label: 'Poruka (Viber/WhatsApp)' },
  { value: 'drugo', label: 'Drugo' },
];

// ---------- Stranica ----------
export default function Page() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter period
  const [fromDate, setFromDate] = useState<string>(todayISO);
  const [toDate, setToDate] = useState<string>(todayISO);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<EditableDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // Thumbovi u listi (mapa activityId -> url)
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // refs za cleanup blob: URL-ova koje kreiramo u modalu
  const modalUrlsRef = useRef<string[]>([]);

  // Load all
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const table: any =
          (db as any).activities ?? (db as any).table?.('activities');
        const all: ActivityItem[] = table ? await table.toArray() : [];
        const sorted = all
          .slice()
          .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
        if (alive) setItems(sorted);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Filter
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
    if (fromDate && toDate && fromDate === toDate)
      return `Danas: ${fmtDMY(fromDate)}`;
    if (fromDate && toDate)
      return `Period: ${fmtDMY(fromDate)} – ${fmtDMY(toDate)}`;
    if (fromDate) return `Od: ${fmtDMY(fromDate)}`;
    if (toDate) return `Do: ${fmtDMY(toDate)}`;
    return `Danas: ${fmtDMY(toISODateOnly(new Date()))}`;
  }, [fromDate, toDate]);

  // Thumbovi (list view) – normalizuj 1. fotku
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
      urlsToRevoke.forEach(
        (u) => u.startsWith('blob:') && URL.revokeObjectURL(u),
      );
    };
  }, [filtered]);

  // Otvori modal
  async function openEdit(it: ActivityItem) {
    // očisti prethodne blob URL-ove iz modala
    modalUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    modalUrlsRef.current = [];

    const rawPhotos = Array.isArray((it as any).fotografije)
      ? (it as any).fotografije
      : [];
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
    // revoke privremene URL-ove kreirane u modalu
    modalUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    modalUrlsRef.current = [];
  }

  // Dodaj fotke u modal (nove) — upiši i base64!
  async function addPhotos(files: FileList | null) {
    if (!files || !draft) return;
    const list = Array.from(files);
    const newItems: AnyPhoto[] = [];
    for (const file of list) {
      const compressed = await compressImage(file);
      const blobUrl = await fileToBlobUrl(compressed);
      const b64 = await blobToBase64(compressed); // <— VAŽNO za trajni prikaz i Excel
      if (blobUrl.startsWith('blob:')) modalUrlsRef.current.push(blobUrl);
      newItems.push({
        id: crypto.randomUUID(),
        blob: compressed,
        url: b64, // postavi URL na data: odmah, da je trajno vidljiv
        base64: b64,
        type: compressed.type,
      });
    }
    setDraft((d) =>
      d ? { ...d, fotografije: [...(d.fotografije ?? []), ...newItems] } : d,
    );
  }

  function removePhoto(id: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            fotografije: (d.fotografije ?? []).filter((p) => p.id !== id),
          }
        : d,
    );
  }

  function clearPhotos() {
    if (!confirm('Obrisati sve fotografije iz ove aktivnosti?')) return;
    setDraft((d) => (d ? { ...d, fotografije: [] } : d));
  }

  function updateOther(key: string, value: any) {
    setDraft((d) =>
      d ? { ...d, other: { ...(d.other ?? {}), [key]: value } } : d,
    );
  }

  // Snimi (merge)
  async function saveEdit() {
    if (!draft) return;
    try {
      setSaving(true);
      const table: any =
        (db as any).activities ?? (db as any).table?.('activities');
      const original: ActivityItem | undefined = await table.get(draft.id);
      if (!original) throw new Error('Stavka nije pronađena.');

      const updated: ActivityItem = {
        ...original,
        id: draft.id,
        datum: draft.datum,
        kupac: draft.kupac,
        ...(typeof draft.vrstaKontakta !== 'undefined'
          ? { vrstaKontakta: draft.vrstaKontakta }
          : {}),
        ...(typeof draft.tema !== 'undefined' ? { tema: draft.tema } : {}),
        ...(typeof draft.napomena !== 'undefined'
          ? { napomena: draft.napomena }
          : {}),
        ...(typeof draft.crmAzuriran !== 'undefined'
          ? { crmAzuriran: !!draft.crmAzuriran }
          : {}),
        ...(draft.fotografije
          ? ({ fotografije: draft.fotografije } as any)
          : {}),
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
      const table: any =
        (db as any).activities ?? (db as any).table?.('activities');
      await table.delete(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert('Greška pri brisanju.');
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Filter + period label */}
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
              onClick={() => {
                const t = toISODateOnly(new Date());
                setFromDate(t);
                setToDate(t);
              }}
              className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Poništi
            </button>
          </div>
        </div>
        <div className="text-white/80 text-sm">{periodLabel}</div>
      </div>

      {/* Lista */}
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
        {!loading &&
          filtered.map((it) => {
            const phs = (it as any).fotografije as any[] | undefined;
            const cnt = phs?.length ?? 0;
            const thumb = thumbs[it.id];
            return (
              <div
                key={it.id}
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
                      {(it as any).kupac || '—'}
                      {cnt > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/10 text-white/80">
                          {cnt} sl.
                        </span>
                      )}
                    </div>
                    <div className="text-white/70 text-sm">
                      {fmtDMY(toISODateOnly(it.datum))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(it)}
                    className="px-3 py-1 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    Uredi
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    className="px-3 py-1 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    Obriši
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* EDIT MODAL */}
      {editOpen && draft && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 text-white border border-white/10 rounded-2xl w-full max-w-5xl p-5 space-y-6 shadow-xl">
            <div className="text-lg font-semibold">Uredi aktivnost</div>

            {/* Glavna polja */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-sm text-white/80 mb-1">Datum</label>
                <input
                  type="date"
                  value={toISODateOnly(draft.datum)}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            datum: new Date(e.target.value).toISOString(),
                          }
                        : d,
                    )
                  }
                  className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-white/80 mb-1">Kupac</label>
                <input
                  type="text"
                  value={draft.kupac}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, kupac: e.target.value } : d))
                  }
                  className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  placeholder="Naziv kupca"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-white/80 mb-1">
                  Vrsta kontakta
                </label>
                <select
                  value={draft.vrstaKontakta ?? ''}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, vrstaKontakta: e.target.value } : d,
                    )
                  }
                  className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <option value="" disabled>
                    Odaberi...
                  </option>
                  {VRSTE_KONTAKTA.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-neutral-900"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-white/80 mb-1">Tema</label>
                <input
                  type="text"
                  value={draft.tema ?? ''}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, tema: e.target.value } : d))
                  }
                  className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  placeholder="Tema sastanka/kontakta"
                />
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm text-white/80 mb-1">Napomena</label>
                <textarea
                  rows={3}
                  value={draft.napomena ?? ''}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, napomena: e.target.value } : d,
                    )
                  }
                  className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  placeholder="Detalji, dogovoreno, sljedeći koraci…"
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input
                  id="crm"
                  type="checkbox"
                  checked={!!draft.crmAzuriran}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, crmAzuriran: e.target.checked } : d,
                    )
                  }
                  className="h-4 w-4"
                />
                <label htmlFor="crm" className="text-sm text-white/90">
                  CRM ažuriran
                </label>
              </div>
            </div>

            {/* Ostala polja */}
            {draft.other && Object.keys(draft.other).length > 0 && (
              <div className="space-y-2">
                <div className="text-white/90 font-medium">Ostala polja</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(draft.other).map(([key, val]) => {
                    const t = typeof val;
                    if (t === 'boolean') {
                      return (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!val}
                            onChange={(e) => updateOther(key, e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-white/90">{key}</span>
                        </label>
                      );
                    }
                    if (t === 'number') {
                      return (
                        <div key={key} className="flex flex-col">
                          <label className="text-sm text-white/80 mb-1">
                            {key}
                          </label>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) =>
                              updateOther(key, Number(e.target.value))
                            }
                            className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="flex flex-col">
                        <label className="text-sm text-white/80 mb-1">
                          {key}
                        </label>
                        <textarea
                          rows={4}
                          value={val ?? ''}
                          onChange={(e) => updateOther(key, e.target.value)}
                          className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                          placeholder="Upiši tekst…"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fotografije */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-white/90 font-medium">
                  Fotografije{' '}
                  {(draft.fotografije?.length ?? 0) > 0
                    ? `(${draft.fotografije?.length})`
                    : ''}
                </div>
                <div className="flex gap-2">
                  <label className="px-3 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer">
                    Dodaj slike
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => addPhotos(e.target.files)}
                    />
                  </label>
                  {(draft.fotografije?.length ?? 0) > 0 && (
                    <button
                      onClick={clearPhotos}
                      className="px-3 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10"
                    >
                      Obriši sve
                    </button>
                  )}
                </div>
              </div>

              {(!draft.fotografije || draft.fotografije.length === 0) && (
                <div className="text-white/60 text-sm">
                  Nema priloženih fotografija.
                </div>
              )}

              {draft.fotografije && draft.fotografije.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {draft.fotografije.map((p) => (
                    <div key={p.id} className="relative group">
                      {p.url ? (
                        <img
                          src={p.url}
                          alt=""
                          className="w-full h-28 object-cover rounded-xl border border-white/10"
                        />
                      ) : (
                        <div className="w-full h-28 rounded-xl border border-white/10 bg-white/5 grid place-items-center text-white/60 text-xs">
                          Nema previewa
                        </div>
                      )}
                      <button
                        onClick={() => removePhoto(p.id)}
                        className="absolute top-2 right-2 px-2 py-1 text-xs rounded-lg border border-white/20 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                        title="Obriši fotografiju"
                      >
                        Obriši
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeEdit}
                className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10"
              >
                Otkaži
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-60"
              >
                {saving ? 'Snimam…' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
