/**
 * e-DISIPLIN MURID 2026
 * Reports.gs — laporan disiplin, aliran kerja status, tindakan, pengesahan, lampiran & notifikasi.
 */

/* ------------------------------------------------------------------ */
/* Aliran kerja                                                        */
/* DRAF → DIHANTAR → DALAM_SEMAKAN → DALAM_TINDAKAN → SELESAI          */
/*            ↘ DIPULANGKAN ↗ (guru betulkan & hantar semula)          */
/* ------------------------------------------------------------------ */

var TRANSITIONS = {
  DIHANTAR: {
    DALAM_SEMAKAN: ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM'],
    DIPULANGKAN: ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM']
  },
  DALAM_SEMAKAN: {
    DALAM_TINDAKAN: ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM'],
    DIPULANGKAN: ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM']
  },
  DALAM_TINDAKAN: {
    SELESAI: ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM', 'PENGETUA'],
    DALAM_SEMAKAN: ['ADMIN', 'PK_HEM', 'PENGETUA']
  },
  SELESAI: {
    DALAM_TINDAKAN: ['ADMIN', 'PK_HEM', 'PENGETUA'] // buka semula kes
  }
};

/** Peralihan yang mesti disertakan ulasan/sebab. */
function needsUlasan_(from, to) {
  return to === STATUS.DIPULANGKAN || (from === STATUS.SELESAI) || (from === STATUS.TINDAKAN && to === STATUS.SEMAKAN);
}

var EDITABLE_STATUS = [STATUS.DRAF, STATUS.DIPULANGKAN];
var ACTION_ROLES = ['ADMIN', 'GURU_DISIPLIN'];
var APPROVAL_ROLES = ['GURU_DISIPLIN', 'PK_HEM', 'PENGETUA'];
var HANDLER_ROLES = ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM'];
var TAHAP_ROLES = ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM', 'PENGETUA'];

/* ------------------------------------------------------------------ */
/* Medan borang & pengesahan                                           */
/* ------------------------------------------------------------------ */

var REPORT_FIELDS = [
  ['studentId', 'StudentID', { label: 'ID Murid / No. pendaftaran', max: 30, pattern: /^[A-Za-z0-9\-\/]+$/, req: true }],
  ['namaMurid', 'NamaMurid', { label: 'Nama murid', max: 120, min: 3, req: true }],
  ['tingkatan', 'Tingkatan', { label: 'Tingkatan', oneOf: TINGKATAN_LIST, req: true }],
  ['kelas', 'Kelas', { label: 'Kelas', max: 40, req: true }],
  ['jantina', 'Jantina', { label: 'Jantina', oneOf: ['Lelaki', 'Perempuan'] }],
  ['sesi', 'Sesi', { label: 'Sesi persekolahan', oneOf: SESI_LIST, req: true }],
  ['tarikhKejadian', 'TarikhKejadian', { label: 'Tarikh kejadian', date: true, req: true }],
  ['masaKejadian', 'MasaKejadian', { label: 'Masa kejadian', pattern: /^([01]\d|2[0-3]):[0-5]\d$/, req: true }],
  ['tempat', 'Tempat', { label: 'Tempat kejadian', max: 120, req: true }],
  ['kategori', 'KategoriKesalahan', { label: 'Kategori kesalahan', max: 100, req: true }],
  ['jenis', 'JenisKesalahan', { label: 'Jenis kesalahan', max: 150, req: true }],
  ['tahap', 'TahapKesalahan', { label: 'Tahap kesalahan', oneOf: TAHAP_LIST, req: true }],
  ['keterangan', 'Keterangan', { label: 'Keterangan kejadian', max: 5000, min: 10, req: true }],
  ['saksi', 'Saksi', { label: 'Nama saksi', max: 300 }],
  ['catatan', 'CatatanTambahan', { label: 'Catatan tambahan', max: 2000 }]
];

/**
 * canTahap = false (Guru Biasa): medan Tahap kesalahan diabaikan sepenuhnya.
 * Tahap ditetapkan kemudian oleh Guru Disiplin / PK HEM / Pengetua / Admin (setReportTahap).
 */
function parseReport_(p, strict, canTahap) {
  var out = {};
  REPORT_FIELDS.forEach(function (f) {
    var o = f[2];
    if (f[0] === 'tahap' && !canTahap) return;
    out[f[1]] = o.date
      ? vDate_(p[f[0]], o.label, strict && o.req)
      : vStr_(p[f[0]], o.label, { required: strict && o.req, max: o.max, min: o.min, pattern: o.pattern, oneOf: o.oneOf });
  });
  if (out.StudentID) out.StudentID = out.StudentID.toUpperCase();
  if (out.TarikhKejadian && out.TarikhKejadian > todayYmd_()) {
    throw AppError_('INPUT_TIDAK_SAH', 'Tarikh kejadian tidak boleh melebihi tarikh hari ini.');
  }
  if (strict) {
    var kat = settingJson_('KATEGORI').filter(function (k) { return k.nama === out.KategoriKesalahan; })[0];
    if (!kat) throw AppError_('INPUT_TIDAK_SAH', 'Kategori kesalahan tidak sah. Sila pilih daripada senarai.');
    if (kat.jenis.indexOf(out.JenisKesalahan) < 0 && kat.jenis.indexOf('Lain-lain') < 0) {
      throw AppError_('INPUT_TIDAK_SAH', 'Jenis kesalahan tidak sah bagi kategori ini.');
    }
  } else if (!out.NamaMurid && !out.StudentID) {
    throw AppError_('INPUT_TIDAK_SAH', 'Isikan sekurang-kurangnya nama murid atau ID murid untuk menyimpan draf.');
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pembantu                                                            */
/* ------------------------------------------------------------------ */

function getReportRow_(reportId) {
  var id = vStr_(reportId, 'ID laporan', { required: true, max: 20, pattern: /^DIS-\d{4}-\d{5}$/ });
  var r = findOne_('REPORTS', 'ReportID', id);
  if (!r || r.IsDeleted === 'Y') throw AppError_('TIDAK_DIJUMPAI', 'Laporan tidak dijumpai.');
  return r;
}

function canView_(ctx, r) {
  if (r.IsDeleted === 'Y') return false;
  if (r.ReporterID === ctx.userId) return true;
  return isPriv_(ctx) && r.Status !== STATUS.DRAF;
}

function canEdit_(ctx, r) {
  return r.ReporterID === ctx.userId && EDITABLE_STATUS.indexOf(r.Status) >= 0;
}

function requireView_(ctx, r) {
  if (!canView_(ctx, r)) {
    writeAuditLog_(ctx, 'AKSES_DITOLAK', r.ReportID, 'DITOLAK', 'Cuba lihat laporan');
    throw AppError_('TIDAK_DIJUMPAI', 'Laporan tidak dijumpai.'); // jangan dedahkan kewujudan
  }
}

function nextReportId_() {
  var year = thisYear_();
  var key = 'SEQ_REPORT_' + year;
  var n = Number(prop_(key) || 0);
  var prefix = 'DIS-' + year + '-';
  all_('REPORTS').forEach(function (r) {
    if (r.ReportID.indexOf(prefix) === 0) n = Math.max(n, Number(r.ReportID.slice(prefix.length)) || 0);
  });
  n++;
  setProp_(key, n);
  return prefix + ('00000' + n).slice(-5);
}

function summaryRow_(r) {
  return {
    reportId: r.ReportID, namaMurid: r.NamaMurid, studentId: r.StudentID, tingkatan: r.Tingkatan, kelas: r.Kelas,
    kategori: r.KategoriKesalahan, jenis: r.JenisKesalahan, tahap: r.TahapKesalahan, status: r.Status,
    tarikhKejadian: r.TarikhKejadian, namaPelapor: r.NamaPelapor, namaHandler: r.NamaHandler,
    createdAt: r.CreatedAt, updatedAt: r.UpdatedAt, submittedAt: r.SubmittedAt, mine: false
  };
}

function fullRow_(r) {
  return {
    reportId: r.ReportID, studentId: r.StudentID, namaMurid: r.NamaMurid, tingkatan: r.Tingkatan, kelas: r.Kelas,
    jantina: r.Jantina, sesi: r.Sesi, tarikhKejadian: r.TarikhKejadian, masaKejadian: r.MasaKejadian, tempat: r.Tempat,
    kategori: r.KategoriKesalahan, jenis: r.JenisKesalahan, tahap: r.TahapKesalahan, keterangan: r.Keterangan,
    saksi: r.Saksi, catatan: r.CatatanTambahan, reporterId: r.ReporterID, namaPelapor: r.NamaPelapor,
    idGuruPelapor: r.IDGuruPelapor, status: r.Status, statusLabel: STATUS_LABEL[r.Status] || r.Status,
    handlerId: r.HandlerID, namaHandler: r.NamaHandler, createdAt: r.CreatedAt, updatedAt: r.UpdatedAt,
    submittedAt: r.SubmittedAt, tarikhSelesai: r.TarikhSelesai
  };
}

function addHistory_(ctx, reportId, from, to, ulasan) {
  insert_('STATUS_HISTORY', {
    HistoryID: shortId_('HIS'), ReportID: reportId, DariStatus: from, KeStatus: to, UserID: ctx.userId,
    NamaPengguna: ctx.nama, Role: ctx.role, Ulasan: ulasan || '', Timestamp: nowIso_()
  });
}

function changeStatus_(ctx, r, to, ulasan) {
  var from = r.Status;
  var patch = { Status: to, UpdatedAt: nowIso_() };
  if (to === STATUS.SELESAI) patch.TarikhSelesai = nowIso_();
  if (from === STATUS.SELESAI) patch.TarikhSelesai = '';
  if (to === STATUS.SEMAKAN && !r.HandlerID && ctx.role === ROLES.GD) {
    patch.HandlerID = ctx.userId; patch.NamaHandler = ctx.nama;
  }
  var out = update_('REPORTS', r._row, patch);
  addHistory_(ctx, r.ReportID, from, to, ulasan);

  var msg = 'Laporan ' + r.ReportID + ' (' + r.NamaMurid + '): status kini ' + STATUS_LABEL[to] + '.';
  if (to === STATUS.DIPULANGKAN) msg = 'Laporan ' + r.ReportID + ' dipulangkan untuk pembetulan. Sebab: ' + String(ulasan).slice(0, 150);
  if (r.ReporterID !== ctx.userId) notify_([r.ReporterID], r.ReportID, msg);
  if (r.HandlerID && r.HandlerID !== ctx.userId && r.HandlerID !== r.ReporterID) notify_([r.HandlerID], r.ReportID, msg);
  if (to === STATUS.SELESAI || from === STATUS.SELESAI) {
    notify_(activeUsersByRole_([ROLES.PKHEM]).map(function (u) { return u.UserID; }).filter(function (id) { return id !== ctx.userId; }), r.ReportID, msg);
  }
  writeAuditLog_(ctx, 'TUKAR_STATUS', r.ReportID, 'BERJAYA', from + ' -> ' + to);
  return out;
}

function allowedTransitions_(ctx, r) {
  var map = TRANSITIONS[r.Status] || {};
  return Object.keys(map).filter(function (to) { return map[to].indexOf(ctx.role) >= 0; })
    .map(function (to) { return { to: to, label: STATUS_LABEL[to], needUlasan: needsUlasan_(r.Status, to) }; });
}

/** Rekod pengesahan yang masih sah: dibuat selepas laporan dihantar kali terakhir. */
function verification_(r) {
  var since = r.SubmittedAt || '';
  var approvals = all_('APPROVALS').filter(function (a) { return a.ReportID === r.ReportID && a.Keputusan === 'DISAHKAN' && a.TarikhKeputusan >= since; });
  function latest(role) {
    var list = approvals.filter(function (a) { return a.Role === role; }).sort(function (a, b) { return cmp_(b.TarikhKeputusan, a.TarikhKeputusan); });
    if (!list.length) return { status: 'BELUM_DISAHKAN', nama: '', tarikh: '' };
    return { status: 'DISAHKAN', nama: list[0].NamaPegawai, tarikh: list[0].TarikhKeputusan };
  }
  return {
    pelapor: {
      jawatan: 'Guru Pelapor', nama: r.NamaPelapor,
      status: r.SubmittedAt && r.Status !== STATUS.DRAF && r.Status !== STATUS.DIPULANGKAN ? 'DIHANTAR' : 'BELUM_DIHANTAR',
      tarikh: r.SubmittedAt
    },
    gd: Object.assign({ jawatan: 'Guru Disiplin' }, latest(ROLES.GD)),
    pkhem: Object.assign({ jawatan: 'PK HEM' }, latest(ROLES.PKHEM)),
    pengetua: Object.assign({ jawatan: 'Pengetua' }, latest(ROLES.PENGETUA))
  };
}

function reportDetail_(ctx, r) {
  var priv = isPriv_(ctx);
  var d = fullRow_(r);
  if (!priv) d.tahap = ''; // Guru Biasa tidak melihat tahap kesalahan
  d.actions = all_('ACTIONS').filter(function (a) { return a.ReportID === r.ReportID; })
    .sort(function (a, b) { return cmp_(a.CreatedAt, b.CreatedAt); })
    .map(function (a) {
      return {
        actionId: a.ActionID, jenis: a.JenisTindakan, statusTindakan: a.StatusTindakan, tarikh: a.TarikhTindakan,
        pegawai: a.NamaPegawai, catatan: priv ? a.Catatan : '', createdAt: a.CreatedAt
      };
    });
  d.approvals = priv ? all_('APPROVALS').filter(function (a) { return a.ReportID === r.ReportID; })
    .sort(function (a, b) { return cmp_(a.TarikhKeputusan, b.TarikhKeputusan); })
    .map(function (a) {
      return { approvalId: a.ApprovalID, role: a.Role, roleLabel: ROLE_LABEL[a.Role], keputusan: a.Keputusan, ulasan: a.Ulasan, tarikh: a.TarikhKeputusan, nama: a.NamaPegawai };
    }) : [];
  d.history = all_('STATUS_HISTORY').filter(function (h) { return h.ReportID === r.ReportID; })
    .sort(function (a, b) { return cmp_(a.Timestamp, b.Timestamp); })
    .map(function (h) {
      return {
        dari: h.DariStatus, ke: h.KeStatus, keLabel: STATUS_LABEL[h.KeStatus] || h.KeStatus, nama: h.NamaPengguna,
        roleLabel: ROLE_LABEL[h.Role] || '', masa: h.Timestamp,
        // Guru biasa hanya melihat sebab pemulangan (diperlukan untuk pembetulan).
        ulasan: (priv || h.KeStatus === STATUS.DIPULANGKAN) ? h.Ulasan : ''
      };
    });
  d.attachments = all_('ATTACHMENTS').filter(function (a) { return a.ReportID === r.ReportID && a.IsDeleted !== 'Y'; })
    .map(function (a) { return { attachmentId: a.AttachmentID, nama: a.NamaFail, jenis: a.JenisFail, saiz: Number(a.SaizBait) || 0, uploadedAt: a.UploadedAt }; });
  d.verification = verification_(r);
  var editable = canEdit_(ctx, r);
  var activeStatus = [STATUS.DIHANTAR, STATUS.SEMAKAN, STATUS.TINDAKAN, STATUS.SELESAI];
  d.permissions = {
    canEdit: editable,
    canSubmit: editable,
    canDeleteDraft: r.ReporterID === ctx.userId && r.Status === STATUS.DRAF,
    canUpload: editable,
    transitions: allowedTransitions_(ctx, r),
    canAddAction: ACTION_ROLES.indexOf(ctx.role) >= 0 && (r.Status === STATUS.SEMAKAN || r.Status === STATUS.TINDAKAN),
    canApprove: APPROVAL_ROLES.indexOf(ctx.role) >= 0 && activeStatus.indexOf(r.Status) >= 0,
    canReturnViaApproval: ['GURU_DISIPLIN', 'PK_HEM'].indexOf(ctx.role) >= 0 && (r.Status === STATUS.DIHANTAR || r.Status === STATUS.SEMAKAN),
    canSetTahap: TAHAP_ROLES.indexOf(ctx.role) >= 0 && r.Status !== STATUS.DRAF && r.Status !== STATUS.SELESAI,
    canSetHandler: HANDLER_ROLES.indexOf(ctx.role) >= 0 && r.Status !== STATUS.SELESAI && r.Status !== STATUS.DRAF && r.Status !== STATUS.DIPULANGKAN,
    isOwner: r.ReporterID === ctx.userId
  };
  if (d.permissions.canSetHandler) {
    d.handlers = activeUsersByRole_([ROLES.GD]).map(function (u) { return { userId: u.UserID, nama: u.NamaPenuh }; });
  }
  return d;
}

function applyFilters_(rows, f) {
  f = obj_(f);
  var q = vStr_(f.q, 'Carian', { max: 80 }).toLowerCase();
  var status = vStr_(f.status, 'Status', { max: 30 });
  var tingkatan = vStr_(f.tingkatan, 'Tingkatan', { max: 20 });
  var kelas = vStr_(f.kelas, 'Kelas', { max: 40 }).toLowerCase();
  var kategori = vStr_(f.kategori, 'Kategori', { max: 100 });
  var tahap = vStr_(f.tahap, 'Tahap', { max: 20 });
  var from = vDate_(f.dari, 'Tarikh dari', false);
  var to = vDate_(f.hingga, 'Tarikh hingga', false);
  var statuses = status ? status.split('|') : null;
  return rows.filter(function (r) {
    if (statuses && statuses.indexOf(r.Status) < 0) return false;
    if (tingkatan && r.Tingkatan !== tingkatan) return false;
    if (kelas && r.Kelas.toLowerCase().indexOf(kelas) < 0) return false;
    if (kategori && r.KategoriKesalahan !== kategori) return false;
    if (tahap && r.TahapKesalahan !== tahap) return false;
    if (from && r.TarikhKejadian < from) return false;
    if (to && r.TarikhKejadian > to) return false;
    if (q) {
      var hay = (r.ReportID + ' ' + r.NamaMurid + ' ' + r.StudentID + ' ' + r.NamaPelapor + ' ' + r.JenisKesalahan).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }).sort(function (a, b) { return cmp_((b.UpdatedAt || b.CreatedAt), (a.UpdatedAt || a.CreatedAt)); });
}

/* ------------------------------------------------------------------ */
/* Fungsi awam — laporan                                               */
/* ------------------------------------------------------------------ */

/** Cipta laporan baharu berstatus DRAF. */
function createReport(token, payload) {
  return secured_(token, null, function (ctx) { return createReport_(ctx, obj_(payload)); });
}

function createReport_(ctx, p) {
  var data = parseReport_(p, false, isPriv_(ctx));
  return withLock_(function () {
    data.ReportID = nextReportId_();
    data.ReporterID = ctx.userId;
    data.NamaPelapor = ctx.nama;
    data.IDGuruPelapor = ctx.idGuru;
    data.Status = STATUS.DRAF;
    data.CreatedAt = nowIso_();
    data.UpdatedAt = data.CreatedAt;
    data.IsDeleted = 'N';
    insert_('REPORTS', data);
    addHistory_(ctx, data.ReportID, '', STATUS.DRAF, 'Laporan dicipta');
    writeAuditLog_(ctx, 'CIPTA_LAPORAN', data.ReportID, 'BERJAYA', '');
    return { reportId: data.ReportID, status: STATUS.DRAF };
  });
}

/** Simpan draf: cipta baharu jika tiada reportId, jika ada kemas kini. */
function saveDraft(token, payload) {
  return secured_(token, null, function (ctx) {
    var p = obj_(payload);
    return p.reportId ? updateReport_(ctx, p) : createReport_(ctx, p);
  });
}

/** Kemas kini laporan sendiri (hanya status DRAF / DIPULANGKAN). */
function updateReport(token, payload) {
  return secured_(token, null, function (ctx) { return updateReport_(ctx, obj_(payload)); });
}

function updateReport_(ctx, p) {
  return withLock_(function () {
    var r = getReportRow_(p.reportId);
    requireView_(ctx, r);
    if (!canEdit_(ctx, r)) throw AppError_('TIADA_KEBENARAN', 'Laporan ini tidak boleh dikemas kini pada status semasa.');
    var data = parseReport_(p, false, isPriv_(ctx));
    data.UpdatedAt = nowIso_();
    update_('REPORTS', r._row, data);
    writeAuditLog_(ctx, 'KEMASKINI_LAPORAN', r.ReportID, 'BERJAYA', '');
    return { reportId: r.ReportID, status: r.Status };
  });
}

/** HANTAR LAPORAN: simpan, sahkan sepenuhnya, tukar status kepada DIHANTAR. */
function submitReport(token, payload) {
  return secured_(token, null, function (ctx) {
    var p = obj_(payload);
    return withLock_(function () {
      var id = p.reportId ? p.reportId : createReport_(ctx, p).reportId;
      var r = getReportRow_(id);
      requireView_(ctx, r);
      if (!canEdit_(ctx, r)) throw AppError_('TIADA_KEBENARAN', 'Laporan ini telah dihantar dan tidak boleh dihantar semula.');
      var data = parseReport_(p, true, isPriv_(ctx));
      var from = r.Status;
      data.Status = STATUS.DIHANTAR;
      data.SubmittedAt = nowIso_();
      data.UpdatedAt = data.SubmittedAt;
      var out = update_('REPORTS', r._row, data);
      addHistory_(ctx, r.ReportID, from, STATUS.DIHANTAR, from === STATUS.DIPULANGKAN ? 'Dihantar semula selepas pembetulan' : 'Laporan dihantar');
      upsertStudentFromReport_(out);

      var recipients = activeUsersByRole_([ROLES.GD]).map(function (u) { return u.UserID; });
      if (data.TahapKesalahan === 'Berat') {
        recipients = recipients.concat(activeUsersByRole_([ROLES.PKHEM, ROLES.PENGETUA]).map(function (u) { return u.UserID; }));
      }
      if (r.HandlerID) recipients.push(r.HandlerID);
      notify_(recipients.filter(function (x) { return x !== ctx.userId; }), r.ReportID,
        (from === STATUS.DIPULANGKAN ? 'Laporan dihantar semula: ' : 'Laporan baharu: ') + r.ReportID + ' — ' + data.NamaMurid +
        ' (' + data.KategoriKesalahan + (data.TahapKesalahan ? ', ' + data.TahapKesalahan : '') + ')');
      writeAuditLog_(ctx, 'HANTAR_LAPORAN', r.ReportID, 'BERJAYA', from + ' -> DIHANTAR');
      return { reportId: r.ReportID, status: STATUS.DIHANTAR };
    });
  });
}

/** Padam draf sendiri (soft delete — rekod kekal dalam sheet dengan IsDeleted=Y). */
function deleteDraft(token, payload) {
  return secured_(token, null, function (ctx) {
    return withLock_(function () {
      var r = getReportRow_(obj_(payload).reportId);
      if (r.ReporterID !== ctx.userId || r.Status !== STATUS.DRAF) {
        throw AppError_('TIADA_KEBENARAN', 'Hanya draf milik anda sendiri boleh dipadam. Laporan yang telah dihantar tidak boleh dipadam.');
      }
      update_('REPORTS', r._row, { IsDeleted: 'Y', UpdatedAt: nowIso_() });
      writeAuditLog_(ctx, 'PADAM_DRAF', r.ReportID, 'BERJAYA', 'Soft delete');
      return { reportId: r.ReportID, deleted: true };
    });
  });
}

function getMyReports(token, filters) {
  return secured_(token, null, function (ctx) {
    var rows = all_('REPORTS').filter(function (r) { return r.ReporterID === ctx.userId && r.IsDeleted !== 'Y'; });
    var priv = isPriv_(ctx);
    return applyFilters_(rows, filters).slice(0, 500).map(function (r) { var s = summaryRow_(r); s.mine = true; if (!priv) s.tahap = ''; return s; });
  });
}

/** Semua laporan (kecuali draf orang lain). Admin, Guru Disiplin, PK HEM, Pengetua. */
function getAllReports(token, filters) {
  return secured_(token, PRIV_ROLES, function (ctx) {
    var rows = all_('REPORTS').filter(function (r) { return r.IsDeleted !== 'Y' && (r.Status !== STATUS.DRAF || r.ReporterID === ctx.userId); });
    var list = applyFilters_(rows, filters);
    return list.slice(0, 1000).map(function (r) { var s = summaryRow_(r); s.mine = r.ReporterID === ctx.userId; return s; });
  });
}

function getReportById(token, payload) {
  return secured_(token, null, function (ctx) {
    var id = (typeof payload === 'string') ? payload : obj_(payload).reportId;
    var r = getReportRow_(id);
    requireView_(ctx, r);
    writeAuditLog_(ctx, 'LIHAT_LAPORAN', r.ReportID, 'BERJAYA', '');
    return reportDetail_(ctx, r);
  });
}

function updateReportStatus(token, payload) {
  return secured_(token, null, function (ctx) {
    var p = obj_(payload);
    var to = vStr_(p.toStatus, 'Status baharu', { required: true, oneOf: Object.keys(STATUS_LABEL) });
    var ulasan = vStr_(p.ulasan, 'Ulasan', { max: 2000 });
    return withLock_(function () {
      var r = getReportRow_(p.reportId);
      requireView_(ctx, r);
      var allowed = (TRANSITIONS[r.Status] || {})[to];
      if (!allowed || allowed.indexOf(ctx.role) < 0) {
        writeAuditLog_(ctx, 'TUKAR_STATUS', r.ReportID, 'DITOLAK', r.Status + ' -> ' + to);
        throw AppError_('TIADA_KEBENARAN', 'Perubahan status daripada ' + STATUS_LABEL[r.Status] + ' kepada ' + STATUS_LABEL[to] + ' tidak dibenarkan untuk peranan anda.');
      }
      if (needsUlasan_(r.Status, to) && ulasan.length < 5) throw AppError_('INPUT_TIDAK_SAH', 'Sila nyatakan ulasan / sebab (sekurang-kurangnya 5 aksara).');
      if (to === STATUS.SELESAI) {
        var hasAction = all_('ACTIONS').some(function (a) { return a.ReportID === r.ReportID; });
        if (!hasAction) throw AppError_('INPUT_TIDAK_SAH', 'Kes tidak boleh ditutup sebelum sekurang-kurangnya satu tindakan disiplin direkodkan.');
      }
      changeStatus_(ctx, r, to, ulasan);
      return reportDetail_(ctx, getReportRow_(r.ReportID));
    });
  });
}

/** Tetapkan guru disiplin yang mengendalikan kes. */
function setHandler(token, payload) {
  return secured_(token, HANDLER_ROLES, function (ctx) {
    var p = obj_(payload);
    return withLock_(function () {
      var r = getReportRow_(p.reportId);
      requireView_(ctx, r);
      var h = findUserById_(vStr_(p.handlerId, 'Guru Disiplin', { required: true, max: 40 }));
      if (!h || h.StatusAkaun !== ACCOUNT.AKTIF || h.Role !== ROLES.GD) throw AppError_('INPUT_TIDAK_SAH', 'Pengguna dipilih bukan Guru Disiplin yang aktif.');
      update_('REPORTS', r._row, { HandlerID: h.UserID, NamaHandler: h.NamaPenuh, UpdatedAt: nowIso_() });
      if (h.UserID !== ctx.userId) notify_([h.UserID], r.ReportID, 'Anda ditugaskan mengendalikan kes ' + r.ReportID + ' (' + r.NamaMurid + ').');
      writeAuditLog_(ctx, 'TETAP_PENGENDALI', r.ReportID, 'BERJAYA', h.Email);
      return reportDetail_(ctx, getReportRow_(r.ReportID));
    });
  });
}

/** Tetapkan / tukar tahap kesalahan. Admin, Guru Disiplin, PK HEM, Pengetua sahaja. */
function setReportTahap(token, payload) {
  return secured_(token, TAHAP_ROLES, function (ctx) {
    var p = obj_(payload);
    var tahap = vStr_(p.tahap, 'Tahap kesalahan', { required: true, oneOf: TAHAP_LIST });
    return withLock_(function () {
      var r = getReportRow_(p.reportId);
      requireView_(ctx, r);
      if (r.Status === STATUS.DRAF || r.Status === STATUS.SELESAI) {
        throw AppError_('STATUS_TIDAK_SAH', 'Tahap kesalahan tidak boleh ditukar pada status ' + (STATUS_LABEL[r.Status] || r.Status) + '.');
      }
      var lama = r.TahapKesalahan || '';
      if (lama === tahap) return reportDetail_(ctx, r);
      update_('REPORTS', r._row, { TahapKesalahan: tahap, UpdatedAt: nowIso_() });
      if (tahap === 'Berat') {
        var to = activeUsersByRole_([ROLES.PKHEM, ROLES.PENGETUA]).map(function (u) { return u.UserID; })
          .filter(function (x) { return x !== ctx.userId; });
        notify_(to, r.ReportID, 'Kes tahap Berat: ' + r.ReportID + ' — ' + r.NamaMurid + ' (' + r.KategoriKesalahan + ')');
      }
      writeAuditLog_(ctx, 'TETAP_TAHAP', r.ReportID, 'BERJAYA', (lama || '-') + ' -> ' + tahap);
      return reportDetail_(ctx, getReportRow_(r.ReportID));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Tindakan disiplin                                                   */
/* ------------------------------------------------------------------ */

function addDisciplineAction(token, payload) {
  return secured_(token, ACTION_ROLES, function (ctx) {
    var p = obj_(payload);
    var jenisList = settingJson_('JENIS_TINDAKAN');
    var rec = {
      JenisTindakan: vStr_(p.jenis, 'Jenis tindakan', { required: true, max: 150 }),
      Catatan: vStr_(p.catatan, 'Keterangan tindakan / catatan siasatan', { required: true, min: 5, max: 3000 }),
      StatusTindakan: vStr_(p.statusTindakan, 'Status siasatan', { required: true, oneOf: ['Dalam siasatan', 'Tindakan diambil', 'Pemantauan', 'Selesai'] }),
      TarikhTindakan: vDate_(p.tarikh, 'Tarikh tindakan', true)
    };
    if (jenisList.indexOf(rec.JenisTindakan) < 0) throw AppError_('INPUT_TIDAK_SAH', 'Jenis tindakan tidak sah. Sila pilih daripada senarai.');
    if (rec.TarikhTindakan > todayYmd_()) throw AppError_('INPUT_TIDAK_SAH', 'Tarikh tindakan tidak boleh melebihi tarikh hari ini.');
    return withLock_(function () {
      var r = getReportRow_(p.reportId);
      requireView_(ctx, r);
      if (r.Status !== STATUS.SEMAKAN && r.Status !== STATUS.TINDAKAN) {
        throw AppError_('STATUS_TIDAK_SAH', 'Tindakan hanya boleh direkod apabila laporan Dalam Semakan atau Dalam Tindakan.');
      }
      rec.ActionID = shortId_('ACT');
      rec.ReportID = r.ReportID;
      rec.OfficerID = ctx.userId;
      rec.NamaPegawai = ctx.nama;
      rec.CreatedAt = nowIso_();
      insert_('ACTIONS', rec);
      writeAuditLog_(ctx, 'REKOD_TINDAKAN', r.ReportID, 'BERJAYA', rec.JenisTindakan);
      if (r.Status === STATUS.SEMAKAN) {
        changeStatus_(ctx, r, STATUS.TINDAKAN, 'Tindakan direkodkan: ' + rec.JenisTindakan);
      } else {
        update_('REPORTS', r._row, { UpdatedAt: nowIso_() });
        if (r.ReporterID !== ctx.userId) notify_([r.ReporterID], r.ReportID, 'Tindakan disiplin direkodkan bagi laporan ' + r.ReportID + '.');
      }
      return reportDetail_(ctx, getReportRow_(r.ReportID));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Pengesahan & ulasan                                                 */
/* ------------------------------------------------------------------ */

/**
 * keputusan: DISAHKAN | ULASAN | DIPULANGKAN
 * Rekod ini ialah pengesahan digital dalam sistem — bukan tandatangan.
 */
function addApproval(token, payload) {
  return secured_(token, APPROVAL_ROLES, function (ctx) {
    var p = obj_(payload);
    var keputusan = vStr_(p.keputusan, 'Keputusan', { required: true, oneOf: ['DISAHKAN', 'ULASAN', 'DIPULANGKAN'] });
    var ulasan = vStr_(p.ulasan, 'Ulasan', { required: keputusan !== 'DISAHKAN', min: 5, max: 2000 });
    return withLock_(function () {
      var r = getReportRow_(p.reportId);
      requireView_(ctx, r);
      if ([STATUS.DIHANTAR, STATUS.SEMAKAN, STATUS.TINDAKAN, STATUS.SELESAI].indexOf(r.Status) < 0) {
        throw AppError_('STATUS_TIDAK_SAH', 'Pengesahan tidak boleh dibuat pada status semasa.');
      }
      if (keputusan === 'DIPULANGKAN') {
        var allowed = (TRANSITIONS[r.Status] || {})[STATUS.DIPULANGKAN];
        if (!allowed || allowed.indexOf(ctx.role) < 0) throw AppError_('TIADA_KEBENARAN', 'Anda tidak boleh memulangkan laporan pada status ini.');
      }
      insert_('APPROVALS', {
        ApprovalID: shortId_('APR'), ReportID: r.ReportID, UserID: ctx.userId, Role: ctx.role, Keputusan: keputusan,
        Ulasan: ulasan, TarikhKeputusan: nowIso_(), NamaPegawai: ctx.nama
      });
      writeAuditLog_(ctx, 'PENGESAHAN_' + keputusan, r.ReportID, 'BERJAYA', '');
      if (keputusan === 'DIPULANGKAN') {
        changeStatus_(ctx, r, STATUS.DIPULANGKAN, ulasan);
      } else {
        update_('REPORTS', r._row, { UpdatedAt: nowIso_() });
        var next = ctx.role === ROLES.GD ? [ROLES.PKHEM] : (ctx.role === ROLES.PKHEM ? [ROLES.PENGETUA] : []);
        var ids = activeUsersByRole_(next).map(function (u) { return u.UserID; });
        if (keputusan === 'DISAHKAN' && ids.length) notify_(ids, r.ReportID, ROLE_LABEL[ctx.role] + ' telah mengesahkan laporan ' + r.ReportID + '. Menunggu semakan anda.');
        if (r.ReporterID !== ctx.userId && keputusan === 'DISAHKAN') notify_([r.ReporterID], r.ReportID, 'Laporan ' + r.ReportID + ' telah disahkan oleh ' + ROLE_LABEL[ctx.role] + '.');
      }
      return reportDetail_(ctx, getReportRow_(r.ReportID));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Lampiran bukti (Google Drive, akses peribadi pemilik skrip sahaja)  */
/* ------------------------------------------------------------------ */

var ATTACH_MIMES = ['image/jpeg', 'image/png', 'application/pdf'];

function uploadEvidence(token, payload) {
  return secured_(token, null, function (ctx) {
    var p = obj_(payload);
    var maxMb = Number(getSetting_('MAX_FILE_MB')) || 5;
    var maxCount = Number(getSetting_('MAX_LAMPIRAN')) || 5;
    var file = decodeUpload_(p, ATTACH_MIMES, maxMb);
    return withLock_(function () {
      var r = getReportRow_(p.reportId);
      requireView_(ctx, r);
      if (!canEdit_(ctx, r)) throw AppError_('TIADA_KEBENARAN', 'Lampiran hanya boleh ditambah semasa laporan berstatus Draf atau Dipulangkan.');
      var count = all_('ATTACHMENTS').filter(function (a) { return a.ReportID === r.ReportID && a.IsDeleted !== 'Y'; }).length;
      if (count >= maxCount) throw AppError_('HAD_LAMPIRAN', 'Had maksimum ' + maxCount + ' lampiran bagi setiap laporan.');
      var folder = DriveApp.getFolderById(prop_('ATTACHMENT_FOLDER_ID'));
      var id = shortId_('ATT');
      var f = folder.createFile(file.blob.setName(r.ReportID + '_' + id + '_' + file.name));
      f.setDescription('e-DISIPLIN ' + r.ReportID + ' — SULIT');
      insert_('ATTACHMENTS', {
        AttachmentID: id, ReportID: r.ReportID, DriveFileID: f.getId(), NamaFail: file.name, JenisFail: file.mime,
        UploadedBy: ctx.userId, UploadedAt: nowIso_(), SaizBait: file.size, IsDeleted: 'N'
      });
      writeAuditLog_(ctx, 'MUAT_NAIK_LAMPIRAN', r.ReportID, 'BERJAYA', file.name + ' (' + file.size + ' bait)');
      return { attachmentId: id, nama: file.name, jenis: file.mime, saiz: file.size };
    });
  });
}

function deleteAttachment(token, payload) {
  return secured_(token, null, function (ctx) {
    var p = obj_(payload);
    return withLock_(function () {
      var a = findOne_('ATTACHMENTS', 'AttachmentID', vStr_(p.attachmentId, 'Lampiran', { required: true, max: 20 }));
      if (!a || a.IsDeleted === 'Y') throw AppError_('TIDAK_DIJUMPAI', 'Lampiran tidak dijumpai.');
      var r = getReportRow_(a.ReportID);
      if (!canEdit_(ctx, r)) throw AppError_('TIADA_KEBENARAN', 'Lampiran hanya boleh dipadam sebelum laporan dihantar.');
      update_('ATTACHMENTS', a._row, { IsDeleted: 'Y' });
      try { DriveApp.getFileById(a.DriveFileID).setTrashed(true); } catch (e) { /* fail mungkin sudah tiada */ }
      writeAuditLog_(ctx, 'PADAM_LAMPIRAN', r.ReportID, 'BERJAYA', a.NamaFail);
      return { attachmentId: a.AttachmentID, deleted: true };
    });
  });
}

/** Lampiran dihantar sebagai base64 kepada pengguna yang dibenarkan — tiada pautan awam. */
function getAttachment(token, payload) {
  return secured_(token, null, function (ctx) {
    var a = findOne_('ATTACHMENTS', 'AttachmentID', vStr_(obj_(payload).attachmentId, 'Lampiran', { required: true, max: 20 }));
    if (!a || a.IsDeleted === 'Y') throw AppError_('TIDAK_DIJUMPAI', 'Lampiran tidak dijumpai.');
    var r = getReportRow_(a.ReportID);
    requireView_(ctx, r);
    var blob = DriveApp.getFileById(a.DriveFileID).getBlob();
    writeAuditLog_(ctx, 'LIHAT_LAMPIRAN', r.ReportID, 'BERJAYA', a.NamaFail);
    return { nama: a.NamaFail, jenis: a.JenisFail, base64: Utilities.base64Encode(blob.getBytes()) };
  });
}

/* ------------------------------------------------------------------ */
/* Notifikasi dalam aplikasi                                           */
/* ------------------------------------------------------------------ */

function notify_(recipientIds, reportId, message) {
  var seen = {};
  (recipientIds || []).forEach(function (id) {
    if (!id || seen[id]) return;
    seen[id] = true;
    insert_('NOTIFICATIONS', {
      NotificationID: shortId_('NTF'), RecipientID: id, ReportID: reportId || '',
      Message: String(message).slice(0, 300), IsRead: 'N', CreatedAt: nowIso_()
    });
  });
}

function getNotifications(token, payload) {
  return secured_(token, null, function (ctx) {
    var limit = Math.min(Number(obj_(payload).limit) || 50, 200);
    var mine = all_('NOTIFICATIONS').filter(function (n) { return n.RecipientID === ctx.userId; })
      .sort(function (a, b) { return cmp_(b.CreatedAt, a.CreatedAt); });
    var unread = mine.filter(function (n) { return n.IsRead !== 'Y'; }).length;
    return {
      unread: unread,
      items: mine.slice(0, limit).map(function (n) {
        return { notificationId: n.NotificationID, reportId: n.ReportID, message: n.Message, isRead: n.IsRead === 'Y', createdAt: n.CreatedAt };
      })
    };
  });
}

function markNotificationRead(token, payload) {
  return secured_(token, null, function (ctx) {
    var id = vStr_(obj_(payload).notificationId, 'Notifikasi', { required: true, max: 20 });
    return withLock_(function () {
      var count = 0;
      var sh = sheet_('NOTIFICATIONS');
      var t = table_('NOTIFICATIONS');
      var col = t.headers.indexOf('IsRead') + 1;
      t.rows.forEach(function (n) {
        if (n.RecipientID === ctx.userId && n.IsRead !== 'Y' && (id === 'ALL' || n.NotificationID === id)) {
          sh.getRange(n._row, col).setValue('Y');
          count++;
        }
      });
      delete DBC_.t.NOTIFICATIONS;
      return { updated: count };
    });
  });
}
