'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/db';
import type { ActivityItem } from '@/lib/types';

// ---------- helpers ----------
const today = new Date().toISOString().slice(0, 10);
const fmtDMY = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};
const betweenLex = (a: string, b: string) => {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return db.activities.where('datum').between(from, to + '\uffff', true, true);
};

// robustno dohvaćanje dataURL-a fotke
async function photoToDataURL(p: any): Promise<string | null> {
  try {
    if (typeof p?.data === 'string' && p.data.startsWith('data:image/'))
      return p.data;
    if (typeof p?.base64 === 'string')
      return p.base64.startsWith('data:')
        ? p.base64
        : `data:image/jpeg;base64,${p.base64}`;
    if (p?.blob instanceof Blob) {
      const r = new FileReader();
      const prom = new Promise<string>((res, rej) => {
        r.onload = () => res(r.result as string);
        r.onerror = rej;
      });
      r.readAsDataURL(p.blob);
      return await prom;
    }
    const src: string | undefined = p?.blobUrl || p?.url;
    if (src) {
      const b = await (await fetch(src)).blob();
      const r = new FileReader();
      const prom = new Promise<string>((res, rej) => {
        r.onload = () => res(r.result as string);
        r.onerror = rej;
      });
      r.readAsDataURL(b);
      return await prom;
    }
    return null;
  } catch {
    return null;
  }
}

type Metrics = {
  visits: number;
  offers: number;
  closed: number;
  competition: number;
  photos: number;
  crm: number;
};

function calcMetrics(rows: ActivityItem[]): Metrics {
  let visits = 0,
    offers = 0,
    closed = 0,
    competition = 0,
    photos = 0,
    crm = 0;
  const offerRe = /\bponud/i;
  const closedRe = /\bnarudž|narudz|zatvoren/i;
  for (const r of rows as any[]) {
    const vrst = (r.vrstaKontakta || '').toLowerCase();
    if (vrst.includes('fiz') || vrst.includes('posjet')) visits++;
    const text =
      `${r.tema ?? ''} ${r.napomena ?? ''} ${r.zakljucak ?? ''}`.toLowerCase();
    if (offerRe.test(text)) offers++;
    if (closedRe.test(text)) closed++;
    if (r.konkurencija && String(r.konkurencija).trim()) competition++;
    photos += r.fotografije?.length ?? 0;
    if (r.crmAzuriran) crm++;
  }
  return { visits, offers, closed, competition, photos, crm };
}

// HTML export (prima finalne brojke za offers/closed)
async function buildReportHTML(
  rows: ActivityItem[],
  period: { from: string; to: string },
  notes: { komentar: string; prijedlozi: string; problemi: string },
  overrides: { offers?: number; closed?: number } = {},
): Promise<string> {
  const auto = calcMetrics(rows);
  const m: Metrics = {
    ...auto,
    offers:
      typeof overrides.offers === 'number' ? overrides.offers : auto.offers,
    closed:
      typeof overrides.closed === 'number' ? overrides.closed : auto.closed,
  };

  const ROW_THUMBS = 5;
  const trs: string[] = [];
  for (const r of rows as any[]) {
    const imgs: string[] = [];
    for (const p of (r.fotografije || []).slice(0, ROW_THUMBS)) {
      const src = await photoToDataURL(p);
      if (src) imgs.push(`<img class="thumb" src="${src}" />`);
    }
    trs.push(`
      <tr>
        <td>${r.datum ?? ''}</td>
        <td>${r.kupac ?? ''}</td>
        <td>${r.vrstaKontakta ?? ''}</td>
        <td>${r.tema ?? ''}</td>
        <td class="crm">${r.crmAzuriran ? 'DA' : 'NE'}</td>
        <td>${imgs.join('')}</td>
      </tr>
    `);
  }

  const genAt = new Date();
  const genText = `${String(genAt.getDate()).padStart(2, '0')}. ${String(genAt.getMonth() + 1).padStart(2, '0')}. ${genAt.getFullYear()}. ${String(genAt.getHours()).padStart(2, '0')}:${String(genAt.getMinutes()).padStart(2, '0')}:${String(genAt.getSeconds()).padStart(2, '0')}`;

  return `<!doctype html><html lang="bs"><head><meta charset="utf-8"/>
  <title>KPI Izvještaj za period - ${period.from} do ${period.to}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
  :root{--blue:#0b5ed7; --border:#e5e7eb; --text:#111827}
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;color:var(--text);margin:24px;}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
  h1{font-size:36px;margin:0;text-align:center}
  .btn{background:var(--blue);color:#fff;border:none;border-radius:8px;padding:10px 14px;cursor:pointer}
  .period{font-size:18px;text-align:center;margin:6px 0 24px}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:22px}
  .card{background:#f9fafb;border:1px solid var(--border);border-radius:12px;padding:18px;text-align:center}
  .card h3{margin:0 0 8px 0;font-weight:600;color:#374151}
  .card .val{font-size:32px;font-weight:700;color:#0f172a}
  .card .meta{color:#059669;font-size:12px;margin-top:2px}
  hr.sep{border:none;border-top:2px solid #0b5ed7;margin:22px 0 12px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:1px solid var(--border);padding:10px 12px;vertical-align:top}
  th{background:#f3f4f6;text-align:left}
  td.crm{text-align:center}
  .thumb{height:60px;border-radius:6px;border:1px solid var(--border);object-fit:cover;margin-right:6px}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:14px}
  .panel{border:1px solid var(--border);border-radius:12px;padding:12px;background:#fff}
  .panel h4{margin:0 0 8px 0}
  footer{color:#6b7280;text-align:center;margin-top:20px}
  @media print {.no-print{display:none !important} body{margin:10mm} h1{font-size:28px} .thumb{height:48px}}
  </style></head>
  <body>
  <header><button class="btn no-print" onclick="window.print()">Štampaj izvještaj</button><div style="flex:1"></div></header>
  <h1>KPI Izvještaj</h1>
  <div class="period">Period: ${period.from} - ${period.to}</div>
  <section class="cards">
    <div class="card"><h3>Fizički posjeti kupcima</h3><div class="val">${m.visits}</div><div class="meta">Automatski</div></div>
    <div class="card"><h3>Poslane ponude</h3><div class="val">${m.offers}</div><div class="meta">${typeof overrides.offers === 'number' ? 'Ručno' : 'Automatski'}</div></div>
    <div class="card"><h3>Zatvorene narudžbe</h3><div class="val">${m.closed}</div><div class="meta">${typeof overrides.closed === 'number' ? 'Ručno' : 'Automatski'}</div></div>
    <div class="card"><h3>Izvještaji o konkurenciji</h3><div class="val">${m.competition}</div><div class="meta">Automatski</div></div>
    <div class="card"><h3>Fotografije s terena</h3><div class="val">${m.photos}</div><div class="meta">Automatski</div></div>
    <div class="card"><h3>CRM ažurirano</h3><div class="val">${m.crm}</div><div class="meta">Automatski</div></div>
  </section>
  <h3>Detaljni pregled aktivnosti</h3><hr class="sep"/>
  <table><thead><tr>
    <th>Datum</th><th>Kupac</th><th>Vrsta kontakta</th><th>Tema</th><th>CRM</th><th>Slike</th>
  </tr></thead><tbody>${trs.join('')}</tbody></table>
  <section class="grid3">
    <div class="panel"><h4>Komentar</h4><div>${(notes.komentar || '').replace(/\n/g, '<br/>')}</div></div>
    <div class="panel"><h4>Prijedlozi</h4><div>${(notes.prijedlozi || '').replace(/\n/g, '<br/>')}</div></div>
    <div class="panel"><h4>Problemi</h4><div>${(notes.problemi || '').replace(/\n/g, '<br/>')}</div></div>
  </section>
  <footer>Generisano: ${fmtDMY(period.to)} • ${genText}</footer>
  </body></html>`;
}

function downloadHtml(name: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function openPrint(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ---------- Page ----------
export default function PeriodicReportPage() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  // ručni tekstovi
  const [komentar, setKomentar] = useState('');
  const [prijedlozi, setPrijedlozi] = useState('');
  const [problemi, setProblemi] = useState('');

  // live metrike (auto)
  const [autoM, setAutoM] = useState<Metrics>({
    visits: 0,
    offers: 0,
    closed: 0,
    competition: 0,
    photos: 0,
    crm: 0,
  });

  // ručni unos za ponude/narudžbe
  const [offersMode, setOffersMode] = useState<'auto' | 'manual'>('auto');
  const [closedMode, setClosedMode] = useState<'auto' | 'manual'>('auto');
  const [offersManual, setOffersManual] = useState<number>(0);
  const [closedManual, setClosedManual] = useState<number>(0);

  // load & calc live metrics kada se promijeni period
  useEffect(() => {
    (async () => {
      const rows = await betweenLex(from, to).sortBy('datum');
      setAutoM(calcMetrics(rows));
      // kada prebaciš period, ako si u AUTO modu, ažurira se prikaz automatski
    })();
  }, [from, to]);

  const shownOffers = offersMode === 'manual' ? offersManual : autoM.offers;
  const shownClosed = closedMode === 'manual' ? closedManual : autoM.closed;

  const periodLabel = useMemo(
    () => `${fmtDMY(from)} – ${fmtDMY(to)}`,
    [from, to],
  );

  async function getRows(): Promise<ActivityItem[]> {
    return betweenLex(from, to).sortBy('datum');
  }

  async function handleExportHTML() {
    setBusy(true);
    try {
      const rows = await getRows();
      const html = await buildReportHTML(
        rows,
        { from, to },
        { komentar, prijedlozi, problemi },
        {
          offers: offersMode === 'manual' ? offersManual : undefined,
          closed: closedMode === 'manual' ? closedManual : undefined,
        },
      );
      const name = `KPI_izvještaj_za_period_od_${from}_do_${to}.html`;
      downloadHtml(name, html);
    } finally {
      setBusy(false);
    }
  }

  async function handlePrint() {
    setBusy(true);
    try {
      const rows = await getRows();
      const html = await buildReportHTML(
        rows,
        { from, to },
        { komentar, prijedlozi, problemi },
        {
          offers: offersMode === 'manual' ? offersManual : undefined,
          closed: closedMode === 'manual' ? closedManual : undefined,
        },
      );
      openPrint(html);
    } finally {
      setBusy(false);
    }
  }

  // WORD export (DOCX) – izgled kao na print/HTML-u
  async function handleExportWord() {
    setBusy(true);
    try {
      const rows = await getRows();
      const {
        Document,
        Packer,
        Paragraph,
        HeadingLevel,
        TextRun,
        Table,
        TableRow,
        TableCell,
        WidthType,
        AlignmentType,
        BorderStyle,
        VerticalAlign,
        ShadingType,
      } = await import('docx');

      // Auto metrike + ručni override
      const auto = calcMetrics(rows);
      const M = {
        ...auto,
        offers: shownOffers,
        closed: shownClosed,
      };

      // ---------- Header ----------
      const title = new Paragraph({
        text: 'KPI Izvještaj',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      });
      const periodP = new Paragraph({
        children: [new TextRun({ text: `Period: ${from} - ${to}`, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      });

      // ---------- Metric "card" cell ----------
      const metricCell = (
        label: string,
        value: number,
        meta: 'Automatski' | 'Ručno',
      ) =>
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 200, bottom: 200, left: 200, right: 200 },
          shading: { type: ShadingType.CLEAR, fill: 'F9FAFB' }, // svijetla pozadina
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: String(value),
                  bold: true,
                  color: '0B5ED7',
                  size: 56,
                }),
              ], // veliki broj
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [
                new TextRun({ text: label, color: '374151', size: 24 }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: meta, color: '059669', size: 18 }),
              ],
            }),
          ],
        });

      // 2 reda × 3 kolone metrika
      const metricsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              metricCell('Fizički posjeti kupcima', M.visits, 'Automatski'),
              metricCell(
                'Poslane ponude',
                M.offers,
                offersMode === 'manual' ? 'Ručno' : 'Automatski',
              ),
              metricCell(
                'Zatvorene narudžbe',
                M.closed,
                closedMode === 'manual' ? 'Ručno' : 'Automatski',
              ),
            ],
          }),
          new TableRow({
            children: [
              metricCell(
                'Izvještaji o konkurenciji',
                M.competition,
                'Automatski',
              ),
              metricCell('Fotografije s terena', M.photos, 'Automatski'),
              metricCell('CRM ažurirano', M.crm, 'Automatski'),
            ],
          }),
        ],
      });

      // ---------- Sekcijski naslov + plava linija ----------
      const sectionTitle = new Paragraph({
        children: [
          new TextRun({
            text: 'Detaljni pregled aktivnosti',
            bold: true,
            size: 26,
          }),
        ],
        spacing: { before: 300, after: 80 },
      });
      const blueRule = new Paragraph({
        children: [new TextRun(' ')],
        border: {
          bottom: {
            color: '0B5ED7',
            size: 6,
            space: 1,
            style: BorderStyle.SINGLE,
          },
        },
        spacing: { after: 120 },
      });

      // ---------- Tabela aktivnosti (header stil kao na slici) ----------
      const headerCell = (text: string) =>
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' },
            left: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' },
            right: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' },
          },
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: true })],
            }),
          ],
        });

      const bodyCell = (text: string, opts: { center?: boolean } = {}) =>
        new TableCell({
          children: [
            new Paragraph({
              alignment: opts.center
                ? AlignmentType.CENTER
                : AlignmentType.LEFT,
              children: [new TextRun(String(text ?? ''))],
            }),
          ],
        });

      const headerRow = new TableRow({
        children: [
          'Datum',
          'Kupac',
          'Vrsta kontakta',
          'Tema',
          'CRM',
          'Slike',
        ].map(headerCell),
      });

      const dataRows = rows.map(
        (r: any) =>
          new TableRow({
            children: [
              bodyCell(r.datum ?? ''),
              bodyCell(r.kupac ?? ''),
              bodyCell(r.vrstaKontakta ?? ''),
              bodyCell(r.tema ?? ''),
              bodyCell(r.crmAzuriran ? 'DA' : 'NE', { center: true }),
              bodyCell(String(r.fotografije?.length ?? 0), { center: true }), // broj slika (thumbnail-e možemo dodati po želji)
            ],
          }),
      );

      const tableAct = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
      });

      // ---------- Footer ----------
      const now = new Date();
      const gen =
        `${String(now.getDate()).padStart(2, '0')}. ${String(now.getMonth() + 1).padStart(2, '0')}. ${now.getFullYear()}. ` +
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const footer = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: `Generisano: ${gen}`, color: '6B7280' }),
        ],
      });

      // ---------- Dokument ----------
      const doc = new Document({
        sections: [
          {
            children: [
              title,
              periodP,
              metricsTable,
              sectionTitle,
              blueRule,
              tableAct,
              footer,
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KPI_Izvještaj_za_period_od${from}_do_${to}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Greška pri Word exportu. Provjeri da je paket "docx" instaliran.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="border border-white/10 bg-white/5 rounded-2xl p-4 space-y-3">
        <div className="text-lg font-semibold text-white">
          📊 Periodični izvještaj
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-white/80 mb-1">Od datuma</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-white/80 mb-1">Do datuma</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white"
            />
          </div>
        </div>

        {/* METRIKE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-white text-center">
              {autoM.visits}
            </div>
            <div className="text-center text-white/90 mt-1">
              Fizički posjeti kupcima
            </div>
            <div className="text-center text-emerald-400 text-xs mt-1">
              Automatski
            </div>
          </div>

          {/* 2 - Poslane ponude (ručno/auto) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-center gap-2">
              {offersMode === 'auto' ? (
                <div className="text-3xl font-bold text-white">
                  {autoM.offers}
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  value={offersManual}
                  onChange={(e) =>
                    setOffersManual(Math.max(0, Number(e.target.value)))
                  }
                  className="w-24 text-center text-3xl font-bold text-white bg-white/10 border border-white/15 rounded-xl px-2 py-1"
                />
              )}
            </div>
            <div className="text-center text-white/90 mt-1">Poslane ponude</div>
            <div className="text-center text-xs mt-1">
              <button
                className={`px-2 py-0.5 rounded ${offersMode === 'auto' ? 'bg-emerald-600' : 'bg-white/10'} border border-white/20 text-white mr-1`}
                onClick={() => setOffersMode('auto')}
              >
                Auto
              </button>
              <button
                className={`px-2 py-0.5 rounded ${offersMode === 'manual' ? 'bg-emerald-600' : 'bg-white/10'} border border-white/20 text-white`}
                onClick={() => setOffersMode('manual')}
              >
                Ručno
              </button>
            </div>
          </div>

          {/* 3 - Zatvorene narudžbe (ručno/auto) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-center gap-2">
              {closedMode === 'auto' ? (
                <div className="text-3xl font-bold text-white">
                  {autoM.closed}
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  value={closedManual}
                  onChange={(e) =>
                    setClosedManual(Math.max(0, Number(e.target.value)))
                  }
                  className="w-24 text-center text-3xl font-bold text-white bg-white/10 border border-white/15 rounded-xl px-2 py-1"
                />
              )}
            </div>
            <div className="text-center text-white/90 mt-1">
              Zatvorene narudžbe
            </div>
            <div className="text-center text-xs mt-1">
              <button
                className={`px-2 py-0.5 rounded ${closedMode === 'auto' ? 'bg-emerald-600' : 'bg-white/10'} border border-white/20 text-white mr-1`}
                onClick={() => setClosedMode('auto')}
              >
                Auto
              </button>
              <button
                className={`px-2 py-0.5 rounded ${closedMode === 'manual' ? 'bg-emerald-600' : 'bg-white/10'} border border-white/20 text-white`}
                onClick={() => setClosedMode('manual')}
              >
                Ručno
              </button>
            </div>
          </div>

          {/* 4 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-white text-center">
              {autoM.competition}
            </div>
            <div className="text-center text-white/90 mt-1">
              Izvještaji o konkurenciji
            </div>
            <div className="text-center text-emerald-400 text-xs mt-1">
              Automatski
            </div>
          </div>

          {/* 5 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-white text-center">
              {autoM.photos}
            </div>
            <div className="text-center text-white/90 mt-1">
              Fotografije s terena
            </div>
            <div className="text-center text-emerald-400 text-xs mt-1">
              Automatski
            </div>
          </div>

          {/* 6 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-white text-center">
              {autoM.crm}
            </div>
            <div className="text-center text-white/90 mt-1">CRM ažuriran</div>
            <div className="text-center text-emerald-400 text-xs mt-1">
              Automatski
            </div>
          </div>
        </div>

        {/* tekstualni blokovi */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/90 mb-2">Komentar</div>
            <textarea
              value={komentar}
              onChange={(e) => setKomentar(e.target.value)}
              className="w-full h-28 px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/90 mb-2">Prijedlozi</div>
            <textarea
              value={prijedlozi}
              onChange={(e) => setPrijedlozi(e.target.value)}
              className="w-full h-28 px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/90 mb-2">Problemi</div>
            <textarea
              value={problemi}
              onChange={(e) => setProblemi(e.target.value)}
              className="w-full h-28 px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-white"
            />
          </div>
        </div>

        {/* export dugmad */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={handleExportHTML}
              className="px-4 py-2 rounded-xl bg-black text-white border border-white/20 hover:bg-black/80 disabled:opacity-60"
            >
              Web export (HTML)
            </button>
            <button
              disabled={busy}
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
            >
              Štampaj
            </button>
            <button
              disabled={busy}
              onClick={handleExportWord}
              className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-60"
            >
              Word dokument (DOCX)
            </button>
          </div>
          <div className="text-xs text-white/60">
            Napomena: HTML export uključuje i slike (thumbnail-e); Word export
            trenutno prikazuje broj slika po aktivnosti radi veličine dokumenta.
          </div>
          <div className="text-white/70 text-sm">Period: {periodLabel}</div>
        </div>
      </div>
    </div>
  );
}
