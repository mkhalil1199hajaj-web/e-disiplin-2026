/**
 * e-DISIPLIN MURID 2026
 * Dashboard.gs — statistik dashboard mengikut peranan, laporan ringkasan bulanan/tahunan & data PDF.
 */

function aggregate_(reps, year) {
  var res = {
    total: reps.length, selesai: 0, tertunggak: 0, berat: 0,
    byStatus: {}, byKategori: {}, byTingkatan: {}, byTahap: {}, byKelas: {},
    byMonth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], byMonthPrev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    kategoriByMonth: {}, yearTotal: 0, prevYearTotal: 0
  };
  Object.keys(STATUS_LABEL).forEach(function (s) { if (s !== STATUS.DRAF) res.byStatus[s] = 0; });
  TINGKATAN_LIST.forEach(function (t) { res.byTingkatan[t] = 0; });
  TAHAP_LIST.forEach(function (t) { res.byTahap[t] = 0; });
  reps.forEach(function (r) {
    if (r.Status === STATUS.SELESAI) res.selesai++; else res.tertunggak++;
    if (r.TahapKesalahan === 'Berat' && r.Status !== STATUS.SELESAI) res.berat++;
    res.byStatus[r.Status] = (res.byStatus[r.Status] || 0) + 1;
    var y = Number((r.TarikhKejadian || r.CreatedAt || '').slice(0, 4));
    var m = Number((r.TarikhKejadian || r.CreatedAt || '').slice(5, 7)) - 1;
    if (y === year && m >= 0 && m < 12) {
      res.byMonth[m]++;
      res.yearTotal++;
      var k = r.KategoriKesalahan || 'Tidak dinyatakan';
      res.byKategori[k] = (res.byKategori[k] || 0) + 1;
      if (r.Tingkatan) res.byTingkatan[r.Tingkatan] = (res.byTingkatan[r.Tingkatan] || 0) + 1;
      if (r.TahapKesalahan) res.byTahap[r.TahapKesalahan] = (res.byTahap[r.TahapKesalahan] || 0) + 1;
      var kelas = (r.Kelas && r.Tingkatan && r.Kelas.indexOf(r.Tingkatan) === 0) ? r.Kelas : [r.Tingkatan, r.Kelas].filter(String).join(' ');
      if (kelas) res.byKelas[kelas] = (res.byKelas[kelas] || 0) + 1;
      if (!res.kategoriByMonth[k]) res.kategoriByMonth[k] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      res.kategoriByMonth[k][m]++;
    } else if (y === year - 1 && m >= 0 && m < 12) {
      res.byMonthPrev[m]++;
      res.prevYearTotal++;
    }
  });
  // Top 10 kelas
  var kelasArr = Object.keys(res.byKelas).map(function (k) { return [k, res.byKelas[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  res.byKelas = {};
  kelasArr.forEach(function (p) { res.byKelas[p[0]] = p[1]; });
  return res;
}

function getDashboardStats(token, payload) {
  return secured_(token, null, function (ctx) {
    var year = Number(obj_(payload).year) || thisYear_();
    if (year < 2020 || year > 2100) year = thisYear_();
    var all = all_('REPORTS').filter(function (r) { return r.IsDeleted !== 'Y'; });
    var mine = all.filter(function (r) { return r.ReporterID === ctx.userId; });
    var myCards = {
      jumlah: mine.length,
      draf: mine.filter(function (r) { return r.Status === STATUS.DRAF; }).length,
      dalamProses: mine.filter(function (r) { return [STATUS.DIHANTAR, STATUS.SEMAKAN, STATUS.TINDAKAN].indexOf(r.Status) >= 0; }).length,
      dipulangkan: mine.filter(function (r) { return r.Status === STATUS.DIPULANGKAN; }).length,
      selesai: mine.filter(function (r) { return r.Status === STATUS.SELESAI; }).length
    };
    var myRecent = mine.sort(function (a, b) { return cmp_((b.UpdatedAt || ''), (a.UpdatedAt || '')); })
      .slice(0, 8).map(function (r) { var s = summaryRow_(r); s.mine = true; return s; });

    if (!isPriv_(ctx)) {
      return { scope: 'SENDIRI', role: ctx.role, year: year, mine: myCards, recent: myRecent };
    }

    var reps = all.filter(function (r) { return r.Status !== STATUS.DRAF; });
    var agg = aggregate_(reps, year);
    var sorted = reps.slice().sort(function (a, b) { return cmp_((b.UpdatedAt || ''), (a.UpdatedAt || '')); });
    var out = {
      scope: 'SEKOLAH', role: ctx.role, year: year, mine: myCards, myRecent: myRecent, stats: agg,
      recent: sorted.slice(0, 10).map(summaryRow_),
      serious: sorted.filter(function (r) { return r.TahapKesalahan === 'Berat' && r.Status !== STATUS.SELESAI; }).slice(0, 10).map(summaryRow_),
      needReview: sorted.filter(function (r) { return r.Status === STATUS.DIHANTAR || r.Status === STATUS.SEMAKAN; }).slice(0, 10).map(summaryRow_),
      myCases: sorted.filter(function (r) { return r.HandlerID === ctx.userId && r.Status !== STATUS.SELESAI; }).slice(0, 10).map(summaryRow_),
      years: uniqueYears_(reps)
    };
    if (ctx.role === ROLES.ADMIN) {
      var users = all_('USERS');
      out.admin = {
        users: users.length,
        aktif: users.filter(function (u) { return u.StatusAkaun === ACCOUNT.AKTIF; }).length,
        menunggu: users.filter(function (u) { return u.StatusAkaun === ACCOUNT.MENUNGGU; }).length,
        byRole: ROLE_LIST.reduce(function (acc, r) {
          acc[r] = users.filter(function (u) { return u.Role === r && u.StatusAkaun === ACCOUNT.AKTIF; }).length; return acc;
        }, {}),
        recentAudit: all_('AUDIT_LOG').slice(-10).reverse().map(function (a) {
          return { aktiviti: a.Aktiviti, email: a.Email, reportId: a.ReportID, masa: a.Timestamp, result: a.Result };
        })
      };
    }
    return out;
  });
}

function uniqueYears_(reps) {
  var set = {};
  set[thisYear_()] = true;
  reps.forEach(function (r) { var y = Number((r.TarikhKejadian || r.CreatedAt || '').slice(0, 4)); if (y > 2000) set[y] = true; });
  return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
}

/** Ringkasan bulanan / tahunan untuk PDF (PK HEM, Pengetua, Guru Disiplin, Admin). */
function getSummaryReport(token, payload) {
  return secured_(token, PRIV_ROLES, function (ctx) {
    var p = obj_(payload);
    var year = Number(p.year) || thisYear_();
    var month = p.month ? Number(p.month) : 0;
    if (month && (month < 1 || month > 12)) throw AppError_('INPUT_TIDAK_SAH', 'Bulan tidak sah.');
    var reps = all_('REPORTS').filter(function (r) {
      if (r.IsDeleted === 'Y' || r.Status === STATUS.DRAF) return false;
      var d = r.TarikhKejadian || r.CreatedAt;
      if (Number(d.slice(0, 4)) !== year) return false;
      return !month || Number(d.slice(5, 7)) === month;
    });
    var agg = aggregate_(reps, year);
    writeAuditLog_(ctx, 'JANA_RINGKASAN', '', 'BERJAYA', year + (month ? '-' + month : ''));
    return {
      year: year, month: month, generatedAt: nowIso_(), generatedBy: ctx.nama, generatedRole: ROLE_LABEL[ctx.role],
      school: { nama: getSetting_('NAMA_SEKOLAH'), alamat: getSetting_('ALAMAT_SEKOLAH'), logo: getLogoDataUrl_() },
      stats: agg,
      rows: reps.sort(function (a, b) { return cmp_(a.TarikhKejadian, b.TarikhKejadian); }).map(summaryRow_)
    };
  });
}

/**
 * Data lengkap untuk PDF satu laporan. Data ditapis mengikut kebenaran pengguna
 * (reportDetail_) dan setiap eksport direkod dalam audit log.
 */
function getReportForPdf(token, payload) {
  return secured_(token, null, function (ctx) {
    var r = getReportRow_(obj_(payload).reportId);
    requireView_(ctx, r);
    var d = reportDetail_(ctx, r);
    var images = [];
    d.attachments.filter(function (a) { return a.jenis === 'image/jpeg' || a.jenis === 'image/png'; }).slice(0, 4).forEach(function (a) {
      var rec = findOne_('ATTACHMENTS', 'AttachmentID', a.attachmentId);
      try {
        var blob = DriveApp.getFileById(rec.DriveFileID).getBlob();
        images.push({ nama: a.nama, jenis: a.jenis, dataUrl: 'data:' + a.jenis + ';base64,' + Utilities.base64Encode(blob.getBytes()) });
      } catch (e) { /* abaikan fail hilang */ }
    });
    writeAuditLog_(ctx, 'EKSPORT_PDF', r.ReportID, 'BERJAYA', '');
    return {
      report: d,
      images: images,
      school: { nama: getSetting_('NAMA_SEKOLAH'), alamat: getSetting_('ALAMAT_SEKOLAH'), logo: getLogoDataUrl_() },
      generatedAt: nowIso_(), generatedBy: ctx.nama, generatedRole: ROLE_LABEL[ctx.role]
    };
  });
}
