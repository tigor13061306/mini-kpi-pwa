export function toISODateOnly(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function fmtDMY(dateISO: string) {
  const dt = new Date(dateISO);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}.${m}.${y}`;
}

export function toArrayBuffer(data: ArrayBufferLike | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data as ArrayBuffer;
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

import type { AnyPhoto } from './types';

export async function normalizePhoto(p: any): Promise<AnyPhoto> {
  const out: AnyPhoto = {
    id: p?.id ?? crypto.randomUUID(),
    blob: p?.blob,
    type: p?.type,
    data: p?.data ?? p?.buf ?? p?.bytes,
    base64: p?.base64 ?? p?.dataUrl ?? p?.data,
    url: undefined,
  };

  if (typeof out.base64 === 'string') {
    out.url = out.base64.startsWith('data:')
      ? out.base64
      : `data:image/jpeg;base64,${out.base64}`;
    return out;
  }
  if (out.blob) {
    out.url = URL.createObjectURL(out.blob);
    return out;
  }
  if (out.data && !(out.data as any).startsWith) {
    const ab = toArrayBuffer(out.data);
    out.blob = new Blob([ab], { type: out.type || 'image/jpeg' });
    out.url = URL.createObjectURL(out.blob);
    return out;
  }
  if (p?.url || p?.blobUrl) out.url = (p.url || p.blobUrl) as string;

  return out;
}
