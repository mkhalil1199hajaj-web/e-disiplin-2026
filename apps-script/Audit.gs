/**
 * e-DISIPLIN MURID 2026
 * Audit.gs — audit log berantai hash (tamper-evident), sandaran, eksport data.
 */

var AUDIT_CLIENT_EVENTS = ['CETAK_LAPORAN', 'MUAT_TURUN_PDF', 'MUAT_TURUN_RINGKASAN', 'MUAT_TURUN_CSV'];

function auditPayload_(e) {
  return [e.LogID, e.UserID, e.Email, e.Aktiviti, e.ReportID, e.Timestamp, e.Result, e.Butiran].join('|');
}

/**
 * Tulis audit log. Setiap entri menyimpan hash SHA-256 = H(hash_sebelum | data),
 * jadi sebarang suntingan manual pada sheet akan dikesan oleh verifyAuditChain().
 */
function writeAuditLog_(actor, aktiviti, reportId, result, detail) {
  try {
    withLock_(function () {
      var prev = prop_('AUDIT_LAST_HASH') || 'GENESIS';
      var e = {
        LogID: 'LOG-' + Date.now().toString(36).toUpperCase() + '-' + Utilities.getUuid().slice(0, 4).toUpperCase(),
        UserID: (actor && actor.userId) || '', Email: (actor && actor.email) || '',
        Aktiviti: String(aktiviti || ''), ReportID: String(reportId || ''), Timestamp: nowIso_(),
        Result: String(result || ''), Butiran: String(detail || '').slice(0, 500)
      };
      e.Hash = sha256_(prev + '|' + auditPayload_(e));
      insert_('AUDIT_LOG', e);
      setProp_('AUDIT_LAST_HASH', e.Hash);
    });
  } catch (err) {
    console.error('Audit log gagal ditulis: ' + (err && err.message));
  }
}

/** Pelayar hanya boleh merekod jenis aktiviti tertentu (contoh: cetak). Identiti tetap dari sesi. */
function writeAuditLog(token, payload) {
  return secured_(token, null, function (ctx) {
    var p = obj_(payload);
    var aktiviti = vStr_(p.aktiviti, 'Aktiviti', { required: true, oneOf: AUDIT_CLIENT_EVENTS });
    var reportId = vStr_(p.reportId, 'ID laporan', { max: 20, pattern: /^DIS-\d{4}-\d{5}$/ });
    if (reportId) requireView_(ctx, getReportRow_(reportId));
    writeAuditLog_(ctx, aktiviti, reportId, 'BERJAYA', vStr_(p.butiran, 'Butiran', { max: 200 }));
    return { logged: true };
  });
}

function getAuditLog(token, payload) {
  return secured_(token, [ROLES.ADMIN], function () {
    var p = obj_(payload);
    var q = vStr_(p.q, 'Carian', { max: 80 }).toLowerCase();
    var limit = Math.min(Number(p.limit) || 200, 1000);
    var rows = all_('AUDIT_LOG').slice().reverse();
    if (q) rows = rows.filter(function (a) { return (a.Aktiviti + ' ' + a.Email + ' ' + a.ReportID + ' ' + a.Butiran + ' ' + a.Result).toLowerCase().indexOf(q) >= 0; });
    return rows.slice(0, limit).map(function (a) {
      return { logId: a.LogID, email: a.Email, aktiviti: a.Aktiviti, reportId: a.ReportID, masa: a.Timestamp, result: a.Result, butiran: a.Butiran };
    });
  });
}

/** Semak keutuhan rantaian hash audit log. */
function verifyAuditChain(token) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var rows = all_('AUDIT_LOG');
    var prev = 'GENESIS';
    for (var i = 0; i < rows.length; i++) {
      var e = rows[i];
      if (sha256_(prev + '|' + auditPayload_(e)) !== e.Hash) {
        writeAuditLog_(ctx, 'SEMAK_AUDIT', '', 'GAGAL', 'Rantaian putus pada ' + e.LogID);
        return { ok: false, checked: i, brokenAt: e.LogID, row: e._row, message: 'Rekod audit pada baris ' + e._row + ' (' + e.LogID + ') telah diubah atau dipadam.' };
      }
      prev = e.Hash;
    }
    var tailOk = !rows.length || prev === (prop_('AUDIT_LAST_HASH') || prev);
    writeAuditLog_(ctx, 'SEMAK_AUDIT', '', tailOk ? 'BERJAYA' : 'GAGAL', rows.length + ' rekod');
    return tailOk
      ? { ok: true, checked: rows.length, message: 'Semua ' + rows.length + ' rekod audit utuh.' }
      : { ok: false, checked: rows.length, message: 'Rekod audit terakhir telah dipadam.' };
  });
}

/* ------------------------------------------------------------------ */
/* Sandaran                                                            */
/* ------------------------------------------------------------------ */

var BACKUP_KEEP = 30;

function doBackup_(label) {
  var folder = DriveApp.getFolderById(prop_('BACKUP_FOLDER_ID'));
  var name = 'SANDARAN e-DISIPLIN ' + Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HHmm') + ' (' + label + ')';
  var copy = DriveApp.getFileById(prop_('SPREADSHEET_ID')).makeCopy(name, folder);
  setProp_('LAST_BACKUP_AT', String(Date.now()));
  // Simpan BACKUP_KEEP sandaran terkini sahaja; yang lama dipindah ke Trash (boleh dipulih 30 hari).
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  files.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
  return { nama: name, fileId: copy.getId() };
}

function backupNow(token) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var res = withLock_(function () { return doBackup_('manual'); });
    writeAuditLog_(ctx, 'SANDARAN_MANUAL', '', 'BERJAYA', res.nama);
    return { nama: res.nama };
  });
}

function listBackups(token) {
  return secured_(token, [ROLES.ADMIN], function () {
    var folder = DriveApp.getFolderById(prop_('BACKUP_FOLDER_ID'));
    var out = [];
    var it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      out.push({ nama: f.getName(), tarikh: Utilities.formatDate(f.getDateCreated(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss") });
    }
    return out.sort(function (a, b) { return cmp_(b.tarikh, a.tarikh); });
  });
}

/** Pengendali trigger harian. Selamat jika dipanggil berulang (dihadkan sekali setiap 20 jam). */
function cronDailyBackup() {
  var last = Number(prop_('LAST_BACKUP_AT') || 0);
  if (Date.now() - last < 20 * 3600 * 1000) return 'Dilangkau: sandaran terkini masih baharu.';
  var res = withLock_(function () { return doBackup_('auto'); });
  writeAuditLog_({ userId: 'SISTEM', email: 'trigger' }, 'SANDARAN_AUTO', '', 'BERJAYA', res.nama);
  return res.nama;
}

/** Jalankan SEKALI dari editor untuk memasang sandaran automatik setiap hari jam 2 pagi. */
function installBackupTrigger() {
  if (!isOwnerRun_()) throw new Error('Hanya pemilik skrip boleh memasang trigger dari editor.');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cronDailyBackup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cronDailyBackup').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Trigger sandaran harian dipasang (jam 2 pagi).');
  return 'OK';
}

/* ------------------------------------------------------------------ */
/* Eksport                                                             */
/* ------------------------------------------------------------------ */

function csvCell_(v) {
  var s = String(v === null || v === undefined ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

/** Admin eksport laporan (tidak termasuk draf) sebagai CSV. */
function exportReportsCsv(token, filters) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var rows = applyFilters_(all_('REPORTS').filter(function (r) { return r.IsDeleted !== 'Y' && r.Status !== STATUS.DRAF; }), filters);
    var cols = ['ReportID', 'TarikhKejadian', 'MasaKejadian', 'StudentID', 'NamaMurid', 'Tingkatan', 'Kelas', 'Sesi', 'Jantina',
      'Tempat', 'KategoriKesalahan', 'JenisKesalahan', 'TahapKesalahan', 'Keterangan', 'Saksi', 'NamaPelapor',
      'NamaHandler', 'Status', 'SubmittedAt', 'TarikhSelesai'];
    var lines = [cols.map(csvCell_).join(',')];
    rows.forEach(function (r) { lines.push(cols.map(function (c) { return csvCell_(r[c]); }).join(',')); });
    writeAuditLog_(ctx, 'EKSPORT_CSV', '', 'BERJAYA', rows.length + ' rekod');
    return { filename: 'e-disiplin-laporan-' + todayYmd_() + '.csv', csv: '﻿' + lines.join('\r\n'), count: rows.length };
  });
}
