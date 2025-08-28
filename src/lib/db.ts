// lib/db.ts
import Dexie, { Table } from 'dexie';
import type { ActivityItem } from './types';

/**
 * VAŽNO:
 * - Primarni ključ je string `id` (npr. uuid).
 * - Indeksi: `datum` za where('datum').equals/between, plus korisni sekundarni.
 * - Pošto koristiš where('datum'), obavezno je da "datum" bude indeksiran (što i jeste).
 */

export class MiniKpiDB extends Dexie {
  public activities!: Table<ActivityItem, string>;

  constructor() {
    super('mini_kpi_db');

    // v1 šema: primarni ključ "id" (string), te indeksi za česte upite
    this.version(1).stores({
      // Primarni ključ: id
      // Sekundarni indeksi: datum, kupac, vrstaKontakta, createdAt, updatedAt
      // Dodan i složeni indeks [datum+kupac] (može pomoći kod izvještaja po kupcu)
      activities: 'id, datum, kupac, vrstaKontakta, createdAt, updatedAt, [datum+kupac]'
    });

    // (opciono) automatski open — Dexie sam otvara pri prvom pristupu,
    // ali eksplicitni open ponekad pomogne za rano hvatanje grešaka.
    this.open().catch((e) => {
      console.error('Greška pri otvaranju IndexedDB:', e);
    });
  }
}

export const db = new MiniKpiDB();

/** Normalizacija polja prije upisa (npr. datum u YYYY-MM-DD) */
function normalizeDate(d: string): string {
  // ako je već YYYY-MM-DD, vrati ga; u suprotnom pokušaj parsiranje
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
}

/** Dodaj aktivnost (sigurniji upis + timestampi) */
export async function addActivity(a: ActivityItem) {
  const now = new Date().toISOString();

  const rec: ActivityItem = {
    ...a,
    id: a.id, // očekuješ da je već postavljen (npr. uuid)
    datum: normalizeDate(a.datum),
    createdAt: a.createdAt || now,
    updatedAt: now
  };

  const pk = await db.activities.add(rec);
  if (!pk) throw new Error('addActivity: upis nije vratio primarni ključ.');
  return pk; // string id
}

/** Ažuriraj aktivnost (parcijalno) */
export async function updateActivity(id: string, patch: Partial<ActivityItem>) {
  const payload: Partial<ActivityItem> = {
    ...patch,
    ...(patch.datum ? { datum: normalizeDate(patch.datum) } : {}),
    updatedAt: new Date().toISOString()
  };

  const changed = await db.activities.update(id, payload);
  if (changed === 0) {
    throw new Error(`updateActivity: zapis sa id="${id}" ne postoji ili nije promijenjen.`);
  }
  return changed; // broj promijenjenih zapisa (0 ili 1)
}

/** Obriši aktivnost */
export async function deleteActivity(id: string) {
  await db.activities.delete(id);
}

/** Helper: vrati sve za jedan dan (YYYY-MM-DD) */
export async function getActivitiesByDay(day: string) {
  const d = normalizeDate(day);
  return db.activities.where('datum').equals(d).sortBy('datum');
}

/** Helper: vrati sve u periodu [from, to] inkluzivno (YYYY-MM-DD) */
export async function getActivitiesByPeriod(from: string, to: string) {
  const a = normalizeDate(from);
  const b = normalizeDate(to);
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return db.activities.where('datum').between(lo, hi, true, true).sortBy('datum');
}

/** (opciono) Brisanje svega — pažljivo koristiti */
export async function clearAllActivities() {
  await db.activities.clear();
}

// Pomoćna migracija – pokrenuti jednom ručno
export async function migrateNormalizeDates() {
  await db.activities.toCollection().modify((a: ActivityItem) => {
    if (typeof a.datum === 'string' && a.datum.length > 10) {
      a.datum = a.datum.slice(0, 10); // 'YYYY-MM-DD'
    }
  });
  alert('Migracija završena: datumi normalizovani na YYYY-MM-DD.');
}