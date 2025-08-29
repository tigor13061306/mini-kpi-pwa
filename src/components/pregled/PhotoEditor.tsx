'use client';

import type { AnyPhoto } from '@/lib/types';

interface PhotoEditorProps {
  photos?: AnyPhoto[];
  addPhotos: (files: FileList | null) => void;
  removePhoto: (id: string) => void;
  clearPhotos: () => void;
}

export default function PhotoEditor({ photos, addPhotos, removePhoto, clearPhotos }: PhotoEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-white/90 font-medium">
          Fotografije {photos && photos.length > 0 ? `(${photos.length})` : ''}
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
          {photos && photos.length > 0 && (
            <button
              onClick={clearPhotos}
              className="px-3 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10"
            >
              Obriši sve
            </button>
          )}
        </div>
      </div>

      {(!photos || photos.length === 0) && (
        <div className="text-white/60 text-sm">Nema priloženih fotografija.</div>
      )}

      {photos && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p) => (
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
  );
}
