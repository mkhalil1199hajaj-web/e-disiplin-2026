/**
 * e-DISIPLIN MURID 2026
 * Code.gs — titik masuk API (doPost), pemalar sistem, pembalut respons & utiliti.
 *
 * SENI BINA
 *   Pelayar (GitHub Pages) --fetch POST text/plain--> doPost --> fungsi dalam API_LIST.
 *   Identiti: ID token "Sign in with Google" disahkan di pelayan (Auth.gs),
 *   kemudian token sesi aplikasi digunakan untuk setiap permintaan.
 *
 * NOTA KESELAMATAN
 *   - Hanya fungsi yang tersenarai dalam apiMap_() boleh dipanggil dari luar.
 *   - Fungsi dalaman berakhir dengan "_".
 */

var APP = { NAME: 'e-DISIPLIN MURID 2026', VERSION: '1.1.0', TZ: 'Asia/Kuala_Lumpur' };

var ROLES = { ADMIN: 'ADMIN', GD: 'GURU_DISIPLIN', PKHEM: 'PK_HEM', PENGETUA: 'PENGETUA', GURU: 'GURU_BIASA' };
var ROLE_LIST = ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM', 'PENGETUA', 'GURU_BIASA'];
var ROLE_LABEL = { ADMIN: 'Admin', GURU_DISIPLIN: 'Guru Disiplin', PK_HEM: 'PK HEM', PENGETUA: 'Pengetua', GURU_BIASA: 'Guru Biasa' };
/** Peranan yang boleh melihat laporan seluruh sekolah. */
var PRIV_ROLES = ['ADMIN', 'GURU_DISIPLIN', 'PK_HEM', 'PENGETUA'];
var JAWATAN_LIST = ['Guru Biasa', 'Guru Disiplin', 'PK HEM', 'Pengetua'];

var STATUS = {
  DRAF: 'DRAF', DIHANTAR: 'DIHANTAR', SEMAKAN: 'DALAM_SEMAKAN',
  TINDAKAN: 'DALAM_TINDAKAN', SELESAI: 'SELESAI', DIPULANGKAN: 'DIPULANGKAN'
};
var STATUS_LABEL = {
  DRAF: 'Draf', DIHANTAR: 'Dihantar', DALAM_SEMAKAN: 'Dalam Semakan',
  DALAM_TINDAKAN: 'Dalam Tindakan', SELESAI: 'Selesai', DIPULANGKAN: 'Dipulangkan untuk Pembetulan'
};

var ACCOUNT = { MENUNGGU: 'MENUNGGU_KELULUSAN', AKTIF: 'AKTIF', NYAHAKTIF: 'NYAHAKTIF', DITOLAK: 'DITOLAK' };

/* ------------------------------------------------------------------ */
/* Web app / API                                                       */
/* ------------------------------------------------------------------ */

var MAX_REQUEST_BYTES = 12 * 1024 * 1024;

/** Senarai fungsi yang boleh dipanggil melalui doPost. Fungsi editor (setupDatabase dll.) TIDAK termasuk. */
function apiMap_() {
  return {
    getBootInfo: getBootInfo, startSession: startSession, registerUser: registerUser, logout: logout, ping: ping,
    getCurrentUser: getCurrentUser, getUserRole: getUserRole, updateMyProfile: updateMyProfile,
    listUsers: listUsers, approveUser: approveUser, rejectUser: rejectUser, updateUserRole: updateUserRole, setUserStatus: setUserStatus,
    createReport: createReport, saveDraft: saveDraft, updateReport: updateReport, submitReport: submitReport, deleteDraft: deleteDraft,
    getMyReports: getMyReports, getAllReports: getAllReports, getReportById: getReportById, updateReportStatus: updateReportStatus,
    setHandler: setHandler, addDisciplineAction: addDisciplineAction, addApproval: addApproval,
    uploadEvidence: uploadEvidence, deleteAttachment: deleteAttachment, getAttachment: getAttachment,
    getNotifications: getNotifications, markNotificationRead: markNotificationRead,
    getDashboardStats: getDashboardStats, getSummaryReport: getSummaryReport, getReportForPdf: getReportForPdf,
    getSchoolSettings: getSchoolSettings, updateSchoolSettings: updateSchoolSettings, uploadLogo: uploadLogo, getLogo: getLogo,
    searchStudents: searchStudents, importStudents: importStudents, studentCount: studentCount,
    writeAuditLog: writeAuditLog, getAuditLog: getAuditLog, verifyAuditChain: verifyAuditChain,
    backupNow: backupNow, listBackups: listBackups, exportReportsCsv: exportReportsCsv
  };
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Semua panggilan daripada aplikasi: POST body = JSON {"fn": "...", "args": [...]}
 * dihantar sebagai Content-Type text/plain (permintaan "simple", tiada CORS preflight).
 */
function doPost(e) {
  var raw = (e && e.postData && e.postData.contents) || '';
  if (!raw || raw.length > MAX_REQUEST_BYTES) {
    return jsonOut_({ ok: false, error: { code: 'PERMINTAAN_TIDAK_SAH', message: 'Permintaan tidak sah atau terlalu besar.' } });
  }
  var req;
  try { req = JSON.parse(raw); } catch (err) {
    return jsonOut_({ ok: false, error: { code: 'PERMINTAAN_TIDAK_SAH', message: 'Format permintaan tidak sah.' } });
  }
  var map = apiMap_();
  var name = req && typeof req.fn === 'string' ? req.fn : '';
  if (!Object.prototype.hasOwnProperty.call(map, name)) {
    return jsonOut_({ ok: false, error: { code: 'FUNGSI_TIDAK_DIKENALI', message: 'Fungsi tidak dikenali.' } });
  }
  var args = Array.isArray(req.args) ? req.args.slice(0, 3) : [];
  var out;
  try { out = map[name].apply(null, args); } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    out = { ok: false, error: { code: 'RALAT_DALAMAN', message: 'Ralat dalaman pelayan.' } };
  }
  return jsonOut_(out);
}

/** GET hanya untuk semakan kesihatan. Aplikasi dibuka di GitHub Pages. */
function doGet() {
  return jsonOut_({ ok: true, app: APP.NAME, version: APP.VERSION, message: 'API e-DISIPLIN aktif. Buka aplikasi melalui laman GitHub Pages sekolah.' });
}

/* ------------------------------------------------------------------ */
/* Respons & ralat                                                     */
/* ------------------------------------------------------------------ */

function AppError_(code, message) {
  var e = new Error(message);
  e.code = code;
  e.isApp = true;
  return e;
}

/** Semua respons kepada pelayar: { ok:true, data } atau { ok:false, error:{code,message} } */
function respond_(fn) {
  try {
    var data = fn();
    return { ok: true, data: data === undefined ? null : data };
  } catch (err) {
    if (err && err.isApp) return { ok: false, error: { code: err.code, message: err.message } };
    console.error(err && err.stack ? err.stack : String(err));
    return { ok: false, error: { code: 'RALAT_DALAMAN', message: 'Ralat dalaman pelayan. Sila cuba lagi atau hubungi Admin.' } };
  } finally {
    DBC_.t = {};
  }
}

/**
 * Pembalut untuk setiap fungsi yang memerlukan pengguna log masuk.
 * @param {string} token  token sesi dari startSession()
 * @param {string[]|null} roles  peranan dibenarkan (null = semua pengguna aktif)
 */
function secured_(token, roles, fn) {
  return respond_(function () {
    var ctx = requireSession_(token);
    if (roles && roles.indexOf(ctx.role) < 0) {
      writeAuditLog_(ctx, 'AKSES_DITOLAK', '', 'DITOLAK', 'Peranan ' + ctx.role + ' cuba akses fungsi terhad');
      throw AppError_('TIADA_KEBENARAN', 'Anda tidak mempunyai kebenaran untuk tindakan ini.');
    }
    return fn(ctx);
  });
}

/* ------------------------------------------------------------------ */
/* Kunci (LockService) — reentrant dalam satu execution                */
/* ------------------------------------------------------------------ */

var LOCK_DEPTH_ = 0;

function withLock_(fn) {
  if (LOCK_DEPTH_ > 0) {
    LOCK_DEPTH_++;
    try { return fn(); } finally { LOCK_DEPTH_--; }
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw AppError_('SIBUK', 'Sistem sedang sibuk. Sila cuba sebentar lagi.');
  LOCK_DEPTH_ = 1;
  try {
    return fn();
  } finally {
    LOCK_DEPTH_ = 0;
    try { SpreadsheetApp.flush(); } catch (e) { /* abaikan */ }
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Utiliti                                                             */
/* ------------------------------------------------------------------ */

function nowIso_() { return Utilities.formatDate(new Date(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function todayYmd_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }
function thisYear_() { return Number(Utilities.formatDate(new Date(), APP.TZ, 'yyyy')); }

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, String(v)); }

function shortId_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
}

function sha256_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function isOwnerRun_() {
  var active = (Session.getActiveUser().getEmail() || '').toLowerCase();
  var eff = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  return !!active && active === eff;
}

/**
 * Pengesahan input teks.
 * opt: { required, min, max, pattern, oneOf }
 */
function vStr_(v, label, opt) {
  opt = opt || {};
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (opt.required && !s) throw AppError_('INPUT_TIDAK_SAH', label + ' wajib diisi.');
  if (!s) return '';
  if (opt.max && s.length > opt.max) throw AppError_('INPUT_TIDAK_SAH', label + ' terlalu panjang (maksimum ' + opt.max + ' aksara).');
  if (opt.min && s.length < opt.min) throw AppError_('INPUT_TIDAK_SAH', label + ' terlalu pendek (minimum ' + opt.min + ' aksara).');
  if (opt.pattern && !opt.pattern.test(s)) throw AppError_('INPUT_TIDAK_SAH', label + ' tidak sah.');
  if (opt.oneOf && opt.oneOf.indexOf(s) < 0) throw AppError_('INPUT_TIDAK_SAH', label + ' tidak sah.');
  return s;
}

function vDate_(v, label, required) {
  var s = vStr_(v, label, { required: required, pattern: /^\d{4}-\d{2}-\d{2}$/ });
  if (!s) return '';
  var p = s.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  if (d.getFullYear() !== p[0] || d.getMonth() !== p[1] - 1 || d.getDate() !== p[2]) {
    throw AppError_('INPUT_TIDAK_SAH', label + ' tidak sah.');
  }
  return s;
}

/** Pembanding stabil untuk sort (0 jika sama). */
function cmp_(x, y) { return x > y ? 1 : (x < y ? -1 : 0); }

function obj_(p) { return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {}; }

function ping(token) {
  return secured_(token, null, function () { return { at: nowIso_() }; });
}
