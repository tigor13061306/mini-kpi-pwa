// lib/excel.ts
import ExcelJS from 'exceljs';
import type { ActivityItem } from './types';
import { getImageBuffer } from './images';

type ExportMode =
  | { kind: 'day'; day: string }
  | { kind: 'period'; from: string; to: string };

const COLS = [
  'Datum','Kupac','Lokacija','Vrsta kontakta','Tema','Zaključak',
  'Sljedeći korak','CRM ažuriran','Konkurencija','Napomena','Fotografije'
] as const;


export async function exportActivitiesToExcel(rows: ActivityItem[], mode: ExportMode) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('KPI', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.properties.defaultRowHeight = 22;

  const COLS = [
    'Datum','Kupac','Lokacija','Vrsta kontakta','Tema','Zaključak',
    'Sljedeći korak','CRM ažuriran','Konkurencija','Napomena','Fotografije'
  ] as const;

  ws.columns = (COLS as readonly string[]).map(h => ({
    header: h, key: h, width: h === 'Fotografije' ? 32 : 22
  }));
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };
  ws.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' };

  // Header i poravnanje + wrap
  ws.getRow(1).eachCell((cell) => {
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  for (let c = 1; c <= COLS.length; c++) {
    const name = COLS[c - 1];
    const col = ws.getColumn(c);
    if (name === 'CRM ažuriran') col.alignment = { horizontal: 'center', vertical: 'middle' };
    else if (name === 'Fotografije') col.alignment = { horizontal: 'left', vertical: 'top' };
    else col.alignment = { wrapText: true, vertical: 'top' };
  }

  // ---- Helpers za mjere/konverzije ----
  const pxToPt = (px: number) => px * 0.75; // 96dpi -> points
  const colWidthToPixels = (wChars: number) => Math.floor(((256 * wChars + Math.floor(128 / 7)) / 256) * 7);
  const pixelsToColWidth = (px: number) =>
    Math.min(255, Math.round((((px / 7) * 256 - Math.floor(128 / 7)) / 256) * 100) / 100); // cap Excel max 255

  // Dimenzije i razmaci za slike (px)
  const IMG_W = 96;   // širina jedne slike
  const IMG_H = 72;   // visina jedne slike
  const GAP_X = 6;    // razmak između slika
  const PAD_X = 6;    // unutrašnji lijevi/desni "padding" u ćeliji
  const TOP_FRAC = 0.1; // mali gornji offset unutar reda (u visinama reda)

  // Širina kolone "Fotografije" = dovoljno za NAJVEĆI broj slika u bilo kom redu
  const maxPhotos = rows.reduce((m, a) => Math.max(m, ((a as any).fotografije?.length ?? 0)), 0);
  if (maxPhotos > 0) {
    const totalPx = PAD_X + maxPhotos * IMG_W + (maxPhotos - 1) * GAP_X + PAD_X; // lijevi+desni pad + sve slike + razmaci
    ws.getColumn(COLS.length).width = pixelsToColWidth(totalPx);
  }

  // ---- Redovi + slike (u jednoj "vizuelnoj liniji" unutar ćelije) ----
  for (const a of rows) {
    const r = ws.addRow([
      a.datum,
      (a as any).kupac,
      a.lokacija ?? '',
      (a as any).vrstaKontakta,
      (a as any).tema,
      a.zakljucak ?? '',
      a.sljedeciKorak ?? '',
      a.crmAzuriran ? 'DA' : 'NE',
      a.konkurencija ?? '',
      a.napomena ?? '',
      '' // placeholder za slike
    ]);

    const rowIndex = r.number;
    const imgCol = COLS.length;
    const photos = ((a as any).fotografije || []) as any[];

    if (photos.length > 0) {
      // visina reda = visina slike (+mali padding)
      ws.getRow(rowIndex).height = Math.max(ws.getRow(rowIndex).height ?? 0, Math.ceil(pxToPt(IMG_H + 6)));

      // kolona širina u px (već postavljena gore na maxPhotos)
      const colPx = colWidthToPixels(Number(ws.getColumn(imgCol).width ?? 32));

      for (let i = 0; i < photos.length; i++) {
        const buff = await getImageBuffer(photos[i]);
        if (!buff) continue;

        const imgId = wb.addImage({ buffer: buff.buf, extension: buff.ext });

        // x pozicija: sve u jednom redu, jedna do druge
        const xPx = PAD_X + i * (IMG_W + GAP_X);
        const xFrac = xPx / colPx;
        const yFrac = TOP_FRAC;

        ws.addImage(imgId, {
          tl: { col: imgCol - 1 + xFrac, row: rowIndex - 1 + yFrac },
          ext: { width: IMG_W, height: IMG_H }
        });
      }
    }
  }

  const name =
    mode.kind === 'day'
      ? `KPI_IZVJESTAJ_${mode.day}.xlsx`
      : `KPI_IZVJESTAJ_${mode.from}_do_${mode.to}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement('a');
  aEl.href = url;
  aEl.download = name;
  document.body.appendChild(aEl);
  aEl.click();
  aEl.remove();
  URL.revokeObjectURL(url);
}
