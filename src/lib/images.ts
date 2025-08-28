// lib/images.ts

/** Blob/File -> data:base64 URL (za trajno čuvanje ili export u Excel) */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Unificiraj ulaz: vrati Blob bez obzira je li File ili Blob */
function asBlob(input: File | Blob): Blob {
  if (input instanceof Blob) return input;
  // ovdje je sigurno File
  const f = input as File;
  return new Blob([f], { type: f.type || 'application/octet-stream' });
}

/** Napravi blob: URL (za prikaz u <img src> u UI) */
export async function fileToBlobUrl(input: File | Blob): Promise<string> {
  const blob = asBlob(input);
  return URL.createObjectURL(blob);
}

/**
 * Kompresija slike u browseru preko <canvas>.
 * - Skalira na maxDim (duža strana), zadržava proporcije
 * - JPEG sa `quality` (0–1). PNG ostaje PNG bez gubitaka.
 * Ako nešto pođe po zlu, vraća originalni blob.
 */
export async function compressImage(
  input: File | Blob,
  options: { maxDim?: number; quality?: number } = {}
): Promise<Blob> {
  const { maxDim = 1600, quality = 0.8 } = options;

  try {
    const srcBlob = asBlob(input); // stabilno, bez TS grešaka
    const imgBitmap = await createImageBitmap(srcBlob);

    const { width, height } = imgBitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const mime = (srcBlob.type || 'image/jpeg').toLowerCase();
    const isPng = mime.includes('png');

    // Bez skaliranja i već dobar tip => nema recompress
    if (scale === 1 && (mime.includes('jpeg') || mime.includes('jpg') || mime.includes('png'))) {
      return srcBlob;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return srcBlob;

    ctx.drawImage(imgBitmap, 0, 0, targetW, targetH);

    const outMime = isPng ? 'image/png' : 'image/jpeg';

    const outBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        outMime,
        isPng ? undefined : quality
      );
    });

    return outBlob;
  } catch (e) {
    console.warn('compressImage fallback (vracam original):', e);
    return asBlob(input);
  }
}
