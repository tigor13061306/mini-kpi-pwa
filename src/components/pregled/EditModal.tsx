'use client';

import { toISODateOnly } from '@/lib/utils';
import type { EditableDraft } from '@/lib/types';
import PhotoEditor from './PhotoEditor';

const VRSTE_KONTAKTA = [
  { value: 'posjeta', label: 'Posjeta' },
  { value: 'poziv', label: 'Poziv' },
  { value: 'email', label: 'Email' },
  { value: 'poruka', label: 'Poruka (Viber/WhatsApp)' },
  { value: 'drugo', label: 'Drugo' },
];

interface EditModalProps {
  draft: EditableDraft;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  setDraft: React.Dispatch<React.SetStateAction<EditableDraft | null>>;
  addPhotos: (files: FileList | null) => void;
  removePhoto: (id: string) => void;
  clearPhotos: () => void;
  updateOther: (key: string, value: any) => void;
}

export default function EditModal({
  draft,
  onClose,
  onSave,
  saving,
  setDraft,
  addPhotos,
  removePhoto,
  clearPhotos,
  updateOther,
}: EditModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 text-white border border-white/10 rounded-2xl w-full max-w-5xl p-5 space-y-6 shadow-xl">
        <div className="text-lg font-semibold">Uredi aktivnost</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm text-white/80 mb-1">Datum</label>
            <input
              type="date"
              value={toISODateOnly(draft.datum)}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, datum: new Date(e.target.value).toISOString() } : d))
              }
              className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-white/80 mb-1">Kupac</label>
            <input
              type="text"
              value={draft.kupac}
              onChange={(e) => setDraft((d) => (d ? { ...d, kupac: e.target.value } : d))}
              className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              placeholder="Naziv kupca"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-white/80 mb-1">Vrsta kontakta</label>
            <select
              value={draft.vrstaKontakta ?? ''}
              onChange={(e) => setDraft((d) => (d ? { ...d, vrstaKontakta: e.target.value } : d))}
              className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <option value="" disabled>Odaberi...</option>
              {VRSTE_KONTAKTA.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-neutral-900">
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
              onChange={(e) => setDraft((d) => (d ? { ...d, tema: e.target.value } : d))}
              className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              placeholder="Tema sastanka/kontakta"
            />
          </div>
          <div className="flex flex-col md:col-span-2">
            <label className="text-sm text-white/80 mb-1">Napomena</label>
            <textarea
              rows={3}
              value={draft.napomena ?? ''}
              onChange={(e) => setDraft((d) => (d ? { ...d, napomena: e.target.value } : d))}
              className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              placeholder="Detalji, dogovoreno, sljedeći koraci…"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="crm"
              type="checkbox"
              checked={!!draft.crmAzuriran}
              onChange={(e) => setDraft((d) => (d ? { ...d, crmAzuriran: e.target.checked } : d))}
              className="h-4 w-4"
            />
            <label htmlFor="crm" className="text-sm text-white/90">CRM ažuriran</label>
          </div>
        </div>

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
                      <label className="text-sm text-white/80 mb-1">{key}</label>
                      <input
                        type="number"
                        value={val as number}
                        onChange={(e) => updateOther(key, Number(e.target.value))}
                        className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                      />
                    </div>
                  );
                }
                return (
                  <div key={key} className="flex flex-col">
                    <label className="text-sm text-white/80 mb-1">{key}</label>
                    <textarea
                      rows={4}
                      value={val as any}
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

        <PhotoEditor
          photos={draft.fotografije}
          addPhotos={addPhotos}
          removePhoto={removePhoto}
          clearPhotos={clearPhotos}
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10">
            Otkaži
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-60"
          >
            {saving ? 'Snimam…' : 'Sačuvaj'}
          </button>
        </div>
      </div>
    </div>
  );
}
