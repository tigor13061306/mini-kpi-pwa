'use client';

import { useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { addActivity } from '@/lib/db';
import type { ActivityItem, ContactType, PhotoItem } from '@/lib/types';
import { compressImage, fileToBlobUrl, blobToBase64 } from '@/lib/images';

export default function UnosPage() {
  const [saving, setSaving] = useState(false);
  const [pickedCount, setPickedCount] = useState(0);

  const camInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function recalcPicked() {
    const a = camInputRef.current?.files?.length ?? 0;
    const b = fileInputRef.current?.files?.length ?? 0;
    setPickedCount(a + b);
  }

  function clearFileInputs() {
    if (camInputRef.current) camInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPickedCount(0);
  }

 async function makePhotoItem(file: File): Promise<PhotoItem> {
  const compressed = await compressImage(file);        // Blob
  const blobUrl    = await fileToBlobUrl(compressed);  // 'blob:' za UI
  const data       = await blobToBase64(compressed);   // base64 za export i trajni prikaz

  return {
    id: uuid(),
    fileName: file.name || 'photo.jpg',
    data,                 // 1) trajno – Excel i pregled
    blobUrl,              // 2) trenutno – pregled prije snimanja
    url: blobUrl,         // 3) legacy kompatibilnost (UI koji čita .url)
    mimeType: compressed.type,
    blob: compressed,     // (opciono – ako već čuvaš Blob u IndexedDB)
  };
}

  async function onSubmit(form: HTMLFormElement) {
    try {
      if (!form.reportValidity() || !form.checkValidity()) return;
      setSaving(true);

      const fd = new FormData(form);

      // Datumski input već vraća "YYYY-MM-DD" — tako i snimamo
      const datum = (fd.get('datum') as string) || new Date().toISOString().slice(0, 10);
      const kupac = (fd.get('kupac') as string)?.trim();
      const vrstaKontakta = fd.get('vrstaKontakta') as ContactType;

      if (!datum || !kupac || !vrstaKontakta) {
        alert('Popuni obavezna polja: Datum, Kupac, Vrsta kontakta.');
        return;
      }

      // Skupi sve fajlove iz oba inputa
      const files: File[] = [];
      if (camInputRef.current?.files) files.push(...Array.from(camInputRef.current.files));
      if (fileInputRef.current?.files) files.push(...Array.from(fileInputRef.current.files));

      if (files.length > 10) {
        alert('Maksimalno 10 slika po aktivnosti.');
        return;
      }

      const photos: PhotoItem[] = [];
      for (const f of files) {
        photos.push(await makePhotoItem(f));
      }

      const item: ActivityItem = {
        id: uuid(),
        datum, // čuvamo "YYYY-MM-DD"
        kupac,
        lokacija: (fd.get('lokacija') as string) || '',
        vrstaKontakta,
        tema: (fd.get('tema') as string) || '',
        zakljucak: (fd.get('zakljucak') as string) || '',
        sljedeciKorak: (fd.get('sljedeciKorak') as string) || '',
        crmAzuriran: fd.get('crm') === 'on',
        konkurencija: (fd.get('konkurencija') as string) || '',
        fotografije: photos,
        napomena: (fd.get('napomena') as string) || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addActivity(item);
      form.reset();
      clearFileInputs();
      alert('Sačuvano ✅');
    } catch (err) {
      console.error(err);
      alert('Greška pri snimanju. Provjeri konzolu (F12).');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }}
    >
      <div className="grid gap-1">
        <label>Datum*</label>
        <input
          name="datum"
          type="date"
          required
          className="bg-neutral-900 rounded px-3 py-2"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="grid gap-1">
        <label>Kupac*</label>
        <input name="kupac" required className="bg-neutral-900 rounded px-3 py-2" placeholder="Naziv kupca" />
      </div>

      <div className="grid gap-1">
        <label>Lokacija</label>
        <input name="lokacija" className="bg-neutral-900 rounded px-3 py-2" placeholder="npr. Sarajevo" />
      </div>

      <div className="grid gap-1">
        <label>Vrsta kontakta*</label>
        <select name="vrstaKontakta" required className="bg-neutral-900 rounded px-3 py-2">
          <option value="fizicki">Fizički</option>
          <option value="telefon">Telefonski</option>
          <option value="email">Email</option>
          <option value="viber">Viber</option>
          <option value="drugo">Drugo</option>
        </select>
      </div>

      <div className="grid gap-1">
        <label>Tema (kratko)</label>
        <textarea name="tema" maxLength={500} className="bg-neutral-900 rounded px-3 py-2" rows={2} />
      </div>

      <div className="grid gap-1">
        <label>Zaključak</label>
        <textarea name="zakljucak" className="bg-neutral-900 rounded px-3 py-2" rows={2} />
      </div>

      <div className="grid gap-1">
        <label>Sljedeći korak</label>
        <textarea name="sljedeciKorak" className="bg-neutral-900 rounded px-3 py-2" rows={2} />
      </div>

      <div className="flex items-center gap-2">
        <input id="crm" name="crm" type="checkbox" />
        <label htmlFor="crm">CRM ažuriran</label>
      </div>

      <div className="grid gap-1">
        <label>Konkurencija</label>
        <textarea name="konkurencija" className="bg-neutral-900 rounded px-3 py-2" rows={2} />
      </div>

      {/* FOTO sekcija */}
      <div className="grid gap-2">
        <label>Fotografije</label>

        <div className="flex flex-wrap gap-2">
          {/* KAMERA */}
          <label className="bg-sky-600 hover:bg-sky-500 rounded px-3 py-2 text-center cursor-pointer">
            📷 Snimi kamerom
            <input
              ref={camInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={recalcPicked}
            />
          </label>

          {/* FAJLOVI */}
          <label className="bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-2 text-center cursor-pointer">
            📁 Odaberi iz fajlova
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={recalcPicked}
            />
          </label>

          <span className="text-xs opacity-70 self-center">
            {pickedCount > 0
              ? `Odabrano: ${pickedCount}`
              : 'Max 10 slika; automatska kompresija ~1600px / kvalitet 0.8'}
          </span>
        </div>
      </div>

      <div className="grid gap-1">
        <label>Napomena</label>
        <textarea name="napomena" className="bg-neutral-900 rounded px-3 py-2" rows={2} />
      </div>

      <div className="flex gap-2">
        <button disabled={saving} className="bg-sky-600 hover:bg-sky-500 rounded px-4 py-2" type="submit">
          {saving ? 'Snima…' : 'Sačuvaj'}
        </button>
        <button
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2"
          type="button"
          onClick={async () => {
            const f = document.querySelector('form') as HTMLFormElement;
            await onSubmit(f);
            f.reset();
            clearFileInputs();
          }}
        >
          Sačuvaj i novi
        </button>
      </div>

      <p className="text-xs opacity-70">* obavezna polja: Datum, Kupac, Vrsta kontakta</p>
    </form>
  );
}
