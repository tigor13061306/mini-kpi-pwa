// lib/types.ts

export type ContactType = 'fizicki' | 'telefon' | 'email' | 'viber' | 'drugo';

export interface PhotoItem {
  id: string;
  fileName?: string;
  // trajni sadržaj
  data?: string;             // data:image/*;base64,...
  // za UI (kratkoživuće)
  blobUrl?: string;          // novi naziv
  url?: string;              // legacy naziv - ostavljamo radi kompatibilnosti
  // opcionalno binarno iz IndexedDB
  blob?: Blob;               // legacy binarno polje
  mimeType?: string;
}

export interface ActivityItem {
  id: string;                 // uuid
  datum: string;              // "YYYY-MM-DD" ili ISO; upiti su robusni
  kupac: string;
  lokacija?: string | null;
  vrstaKontakta: ContactType;
  tema: string;
  zakljucak?: string | null;
  sljedeciKorak?: string | null;
  crmAzuriran: boolean;
  konkurencija?: string | null;
  napomena?: string | null;
  fotografije?: PhotoItem[];  // <= ovdje je PhotoItem sa .data (base64)
  createdAt?: string;
  updatedAt?: string;
}
