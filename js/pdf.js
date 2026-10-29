'use strict';
/* =====================================================================
 * JsPdf — laporan PDF A4 (jsPDF + autoTable)
 * Data PDF diambil daripada pelayan (getReportForPdf) yang menapis
 * kandungan mengikut peranan dan merekod eksport dalam audit log.
 * ===================================================================== */

const PDF_COLOR = { navy: [16, 40, 79], royal: [36, 83, 199], gold: [212, 160, 23], grey: [100, 116, 139], line: [203, 213, 225], soft: [242, 246, 254] };
const VER_LABEL = { DISAHKAN: 'Disahkan dalam sistem', DIHANTAR: 'Dihantar dalam sistem', BELUM_DISAHKAN: 'Belum disahkan', BELUM_DIHANTAR: 'Belum dihantar' };

function pdfReady() {
  if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable) {
    alertErr({ message: 'Pustaka PDF gagal dimuatkan. Semak sambungan internet dan muat semula halaman.' });
    return false;
  }
  return true;
}

function imgFormat(dataUrl) { return /^data:image\/png/.test(dataUrl) ? 'PNG' : 'JPEG'; }

function pdfHeader(doc, school, title, meta) {
  const W = doc.internal.pageSize.getWidth();
  let x = 15;
  if (school.logo) {
    try { doc.addImage(school.logo, imgFormat(school.logo), 15, 11, 20, 20, undefined, 'FAST'); x = 39; } catch (e) { /* logo rosak */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...PDF_COLOR.navy);
  doc.text(String(school.nama || '').toUpperCase(), x, 17, { maxWidth: W - x - 15 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...PDF_COLOR.grey);
  doc.text(doc.splitTextToSize(String(school.alamat || ''), W - x - 15).slice(0, 3), x, 22);
  doc.setDrawColor(...PDF_COLOR.gold); doc.setLineWidth(0.8); doc.line(15, 34, W - 15, 34);
  doc.setDrawColor(...PDF_COLOR.navy); doc.setLineWidth(0.2); doc.line(15, 35.2, W - 15, 35.2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...PDF_COLOR.navy);
  doc.text(title, W / 2, 44, { align: 'center' });
  if (meta) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text(meta, W / 2, 50, { align: 'center' });
  }
  return meta ? 56 : 50;
}

function pdfFooter(doc, info) {
  const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_COLOR.line); doc.setLineWidth(0.2); doc.line(15, H - 14, W - 15, H - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...PDF_COLOR.grey);
    doc.text('SULIT · ' + info, 15, H - 9);
    doc.text(`Halaman ${i} / ${n}`, W - 15, H - 9, { align: 'right' });
  }
}

function sectionTitle(doc, y, text) {
  const W = doc.internal.pageSize.getWidth();
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
  doc.setFillColor(...PDF_COLOR.navy); doc.rect(15, y, W - 30, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
  doc.text(text, 18, y + 4.9);
  return y + 7;
}

function kvTable(doc, y, rows) {
  doc.autoTable({
    startY: y, margin: { left: 15, right: 15 }, theme: 'grid', body: rows.map(r => [r[0], r[1] === undefined || r[1] === null || r[1] === '' ? '-' : String(r[1])]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, lineColor: PDF_COLOR.line, lineWidth: 0.2, textColor: [20, 20, 20], overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', fillColor: PDF_COLOR.soft, textColor: PDF_COLOR.navy } }
  });
  return doc.lastAutoTable.finalY + 5;
}

async function generateReportPdf(reportId, mode) {
  if (!pdfReady()) return;
  let data;
  try { data = await withLoading('Menjana PDF…', () => callT('getReportForPdf', { reportId })); } catch (e) { return alertErr(e, 'PDF tidak dapat dijana'); }
  const r = data.report;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: 'Laporan Kes Disiplin ' + r.reportId, subject: 'e-DISIPLIN MURID 2026', creator: 'e-DISIPLIN MURID 2026' });

  let y = pdfHeader(doc, data.school, 'LAPORAN KES DISIPLIN MURID', `ID Laporan: ${r.reportId}    |    Tarikh laporan: ${fmtDate(r.createdAt)}    |    Status: ${r.statusLabel}`);

  y = sectionTitle(doc, y, '1. MAKLUMAT GURU PELAPOR');
  y = kvTable(doc, y, [['Nama guru pelapor', r.namaPelapor], ['ID Guru', r.idGuruPelapor], ['Tarikh & masa laporan', fmtDateTime(r.createdAt)], ['Tarikh dihantar', r.submittedAt ? fmtDateTime(r.submittedAt) : 'Belum dihantar']]);
  y = sectionTitle(doc, y, '2. MAKLUMAT MURID');
  y = kvTable(doc, y, [['Nama murid', r.namaMurid], ['ID Murid / No. pendaftaran', r.studentId], ['Tingkatan', r.tingkatan], ['Kelas', r.kelas], ['Jantina', r.jantina], ['Sesi persekolahan', r.sesi]]);
  y = sectionTitle(doc, y, '3. BUTIRAN KEJADIAN');
  y = kvTable(doc, y, [['Tarikh kejadian', fmtDate(r.tarikhKejadian)], ['Masa kejadian', r.masaKejadian], ['Tempat kejadian', r.tempat], ['Kategori kes', r.kategori], ['Perincian kes', r.jenis], ...(isPriv() ? [['Tahap kesalahan', r.tahap || 'Belum ditetapkan']] : []), ['Nama saksi', r.saksi]]);
  y = sectionTitle(doc, y, '4. KETERANGAN KES');
  y = kvTable(doc, y, [['Keterangan kejadian', r.keterangan], ['Catatan tambahan', r.catatan]]);

  y = sectionTitle(doc, y, '5. LAMPIRAN BUKTI');
  if (!r.attachments.length) y = kvTable(doc, y, [['Lampiran', 'Tiada lampiran']]);
  else {
    y = kvTable(doc, y, r.attachments.map((a, i) => [`Lampiran ${i + 1}`, `${a.nama} (${a.jenis === 'application/pdf' ? 'PDF' : 'Gambar'}, ${fmtBytes(a.saiz)})`]));
    for (const img of data.images) {
      try {
        const p = doc.getImageProperties(img.dataUrl);
        const maxW = 85, maxH = 70;
        const ratio = Math.min(maxW / p.width, maxH / p.height);
        const w = p.width * ratio, h = p.height * ratio;
        if (y + h + 10 > H - 20) { doc.addPage(); y = 20; }
        doc.addImage(img.dataUrl, imgFormat(img.dataUrl), 15, y, w, h, undefined, 'MEDIUM');
        doc.setFontSize(7.5); doc.setTextColor(...PDF_COLOR.grey); doc.text(img.nama, 15, y + h + 4);
        y += h + 9;
      } catch (e) { /* gambar tidak dapat dibaca */ }
    }
  }

  y = sectionTitle(doc, y, '6. TINDAKAN SUSULAN');
  if (!r.actions.length) y = kvTable(doc, y, [['Tindakan', 'Belum ada tindakan direkodkan']]);
  else {
    doc.autoTable({
      startY: y, margin: { left: 15, right: 15 }, theme: 'grid',
      head: [['Tarikh', 'Jenis tindakan', 'Status siasatan', 'Pegawai', 'Keterangan']],
      body: r.actions.map(a => [fmtDate(a.tarikh), a.jenis, a.statusTindakan, a.pegawai, a.catatan || '-']),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, lineColor: PDF_COLOR.line, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLOR.soft, textColor: PDF_COLOR.navy, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 36 }, 2: { cellWidth: 26 }, 3: { cellWidth: 30 } }
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  y = sectionTitle(doc, y, '7. STATUS KES');
  y = kvTable(doc, y, [['Status semasa', r.statusLabel], ['Guru disiplin yang mengendalikan', r.namaHandler], ['Tarikh kes selesai', r.tarikhSelesai ? fmtDate(r.tarikhSelesai) : '-'],
    ['Sejarah status', r.history.map(h => `${fmtDateTime(h.masa)}  ${STATUS_LABEL[h.ke] || h.ke}  (${h.nama})`).join('\n')]]);

  y = sectionTitle(doc, y, '8. ULASAN PEGAWAI BERKAITAN');
  const ul = r.approvals.filter(a => a.ulasan);
  y = ul.length ? kvTable(doc, y, ul.map(a => [`${a.roleLabel}: ${a.nama}\n${fmtDateTime(a.tarikh)}`, a.ulasan]))
    : kvTable(doc, y, [['Ulasan', r.approvals.length || isPriv() ? 'Tiada ulasan' : 'Ulasan dalaman tidak dipaparkan untuk peranan anda']]);

  // Ruang pengesahan — nama, jawatan, tarikh & status sebenar dari rekod sistem. Tiada tandatangan dijana.
  if (y > H - 75) { doc.addPage(); y = 20; }
  y = sectionTitle(doc, y, 'PENGESAHAN');
  const v = r.verification, boxes = [v.pelapor, v.gd, v.pkhem, v.pengetua];
  const bw = (W - 30 - 9) / 4;
  boxes.forEach((b, i) => {
    const bx = 15 + i * (bw + 3), by = y + 3;
    doc.setDrawColor(...PDF_COLOR.line); doc.setLineWidth(0.3); doc.rect(bx, by, bw, 48);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...PDF_COLOR.navy);
    doc.text(b.jawatan.toUpperCase(), bx + bw / 2, by + 5.5, { align: 'center' });
    doc.setDrawColor(150, 150, 150); doc.setLineDashPattern([1, 1], 0); doc.line(bx + 4, by + 24, bx + bw - 4, by + 24); doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...PDF_COLOR.grey);
    doc.text('Tandatangan & cop', bx + bw / 2, by + 27.5, { align: 'center' });
    doc.setFontSize(7.5); doc.setTextColor(30, 30, 30);
    doc.text(doc.splitTextToSize('Nama: ' + (b.nama || '________________'), bw - 6).slice(0, 2), bx + 3, by + 33);
    doc.text('Tarikh: ' + (b.tarikh ? fmtDate(b.tarikh) : '____________'), bx + 3, by + 41);
    const ok = b.status === 'DISAHKAN' || b.status === 'DIHANTAR';
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...(ok ? [4, 120, 87] : [148, 163, 184]));
    doc.text(VER_LABEL[b.status] || b.status, bx + 3, by + 45.5);
  });
  y += 55;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...PDF_COLOR.grey);
  doc.text(doc.splitTextToSize('Status pengesahan di atas diambil daripada rekod sebenar dalam sistem e-DISIPLIN. Ruang tandatangan perlu ditandatangani secara manual oleh pegawai berkaitan jika salinan bercetak diperlukan.', W - 30), 15, y);

  pdfFooter(doc, `${r.reportId} · Dijana oleh ${data.generatedBy} (${data.generatedRole}) pada ${fmtDateTime(data.generatedAt)}`);
  outputPdf(doc, `Laporan-Disiplin-${r.reportId}.pdf`, mode, r.reportId);
}

function outputPdf(doc, filename, mode, reportId) {
  if (mode === 'print') {
    doc.autoPrint();
    const url = doc.output('bloburl');
    const w = window.open(url, '_blank');
    if (!w) { doc.save(filename); toast('Tetingkap cetak disekat pelayar. PDF dimuat turun — sila cetak dari fail.', 'info'); }
    callT('writeAuditLog', { aktiviti: 'CETAK_LAPORAN', reportId: reportId || '', butiran: filename }).catch(() => {});
    return;
  }
  doc.save(filename);
  callT('writeAuditLog', { aktiviti: reportId ? 'MUAT_TURUN_PDF' : 'MUAT_TURUN_RINGKASAN', reportId: reportId || '', butiran: filename }).catch(() => {});
  Swal.fire({
    toast: true, position: 'top-end', icon: 'success', title: 'PDF dimuat turun', showConfirmButton: true, confirmButtonText: 'Buka di tab baharu', timer: 7000, timerProgressBar: true
  }).then(res => { if (res.isConfirmed) window.open(doc.output('bloburl'), '_blank'); });
}

async function generateSummaryPdf(year, month) {
  if (!pdfReady()) return;
  let data;
  try { data = await withLoading('Menjana laporan ringkasan…', () => callT('getSummaryReport', { year, month })); } catch (e) { return alertErr(e); }
  const s = data.stats;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const period = month ? `${BULAN_PENUH[month - 1]} ${year}` : `Tahun ${year}`;
  const title = month ? 'LAPORAN BULANAN KES DISIPLIN MURID' : 'LAPORAN TAHUNAN KES DISIPLIN MURID';
  let y = pdfHeader(doc, data.school, title, 'Tempoh: ' + period);

  y = sectionTitle(doc, y, 'RINGKASAN');
  const sel = s.byStatus.SELESAI || 0;
  y = kvTable(doc, y, [['Jumlah kes dilaporkan', data.rows.length], ['Kes selesai', sel], ['Kes belum selesai', data.rows.length - sel], ['Kes tahap berat', s.byTahap.Berat || 0],
    ['Tahap ringan / sederhana', `${s.byTahap.Ringan || 0} / ${s.byTahap.Sederhana || 0}`]]);

  const table = (head, body) => {
    doc.autoTable({ startY: y, margin: { left: 15, right: 15 }, theme: 'grid', head: [head], body: body.length ? body : [['Tiada data', ...head.slice(1).map(() => '')]],
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, lineColor: PDF_COLOR.line, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLOR.navy, textColor: 255, fontStyle: 'bold' } });
    y = doc.lastAutoTable.finalY + 6;
  };
  y = sectionTitle(doc, y, 'MENGIKUT KATEGORI KESALAHAN');
  table(['Kategori', 'Bilangan kes'], Object.entries(s.byKategori).sort((a, b) => b[1] - a[1]));
  y = sectionTitle(doc, y, 'MENGIKUT TINGKATAN');
  table(['Tingkatan', 'Bilangan kes'], Object.entries(s.byTingkatan).filter(e => e[1]));
  y = sectionTitle(doc, y, 'MENGIKUT STATUS');
  table(['Status', 'Bilangan kes'], STATUS_ORDER.map(k => [STATUS_LABEL[k], s.byStatus[k] || 0]));
  if (!month) {
    y = sectionTitle(doc, y, 'MENGIKUT BULAN');
    table(['Bulan', String(year)], BULAN_PENUH.map((b, i) => [b, s.byMonth[i]]));
  }
  doc.addPage(); y = 20;
  y = sectionTitle(doc, y, 'SENARAI KES');
  doc.autoTable({
    startY: y, margin: { left: 15, right: 15 }, theme: 'striped',
    head: [['ID', 'Tarikh', 'Murid', 'Kelas', 'Kategori', 'Tahap', 'Status']],
    body: data.rows.map(r => [r.reportId, fmtDate(r.tarikhKejadian), r.namaMurid, kelasLabel(r.tingkatan, r.kelas), r.kategori, r.tahap, STATUS_LABEL[r.status] || r.status]),
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6 }, headStyles: { fillColor: PDF_COLOR.navy, textColor: 255 }
  });
  pdfFooter(doc, `${title} · ${period} · Dijana oleh ${data.generatedBy} (${data.generatedRole}) pada ${fmtDateTime(data.generatedAt)}`);
  outputPdf(doc, `Laporan-Disiplin-${month ? year + '-' + String(month).padStart(2, '0') : year}.pdf`, 'save', '');
}
