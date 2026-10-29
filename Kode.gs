// ===== Code.gs =====
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
    setHandler: setHandler, setReportTahap: setReportTahap, addDisciplineAction: addDisciplineAction, addApproval: addApproval,
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


// ===== Database.gs =====
/**
 * e-DISIPLIN MURID 2026
 * Database.gs — skema Google Sheets, setupDatabase(), akses jadual, tetapan sekolah & senarai murid.
 */

var SCHEMA = {
  USERS: ['UserID', 'NamaPenuh', 'IDGuru', 'Email', 'Telefon', 'Sekolah', 'Jawatan', 'Role', 'AuthProviderID',
    'StatusAkaun', 'TarikhDaftar', 'LastLogin', 'DiluluskanOleh', 'TarikhLulus'],
  STUDENTS: ['StudentID', 'NamaMurid', 'Tingkatan', 'Kelas', 'Sesi', 'Status', 'Jantina', 'UpdatedAt'],
  REPORTS: ['ReportID', 'StudentID', 'NamaMurid', 'Tingkatan', 'Kelas', 'Sesi', 'TarikhKejadian', 'MasaKejadian',
    'Tempat', 'KategoriKesalahan', 'JenisKesalahan', 'TahapKesalahan', 'Keterangan', 'Saksi', 'ReporterID',
    'NamaPelapor', 'Status', 'CreatedAt', 'UpdatedAt',
    // kolum tambahan
    'Jantina', 'CatatanTambahan', 'IDGuruPelapor', 'HandlerID', 'NamaHandler', 'SubmittedAt', 'TarikhSelesai', 'IsDeleted'],
  ACTIONS: ['ActionID', 'ReportID', 'OfficerID', 'JenisTindakan', 'Catatan', 'StatusTindakan', 'TarikhTindakan',
    'NamaPegawai', 'CreatedAt'],
  APPROVALS: ['ApprovalID', 'ReportID', 'UserID', 'Role', 'Keputusan', 'Ulasan', 'TarikhKeputusan', 'NamaPegawai'],
  ATTACHMENTS: ['AttachmentID', 'ReportID', 'DriveFileID', 'NamaFail', 'JenisFail', 'UploadedBy', 'UploadedAt',
    'SaizBait', 'IsDeleted'],
  STATUS_HISTORY: ['HistoryID', 'ReportID', 'DariStatus', 'KeStatus', 'UserID', 'NamaPengguna', 'Role', 'Ulasan', 'Timestamp'],
  AUDIT_LOG: ['LogID', 'UserID', 'Aktiviti', 'ReportID', 'Timestamp', 'Result', 'Email', 'Butiran', 'Hash'],
  SETTINGS: ['SettingKey', 'SettingValue', 'UpdatedAt'],
  NOTIFICATIONS: ['NotificationID', 'RecipientID', 'ReportID', 'Message', 'IsRead', 'CreatedAt']
};

var PROTECTED_SHEETS = ['AUDIT_LOG', 'STATUS_HISTORY'];

var TINGKATAN_LIST = ['Peralihan', '1', '2', '3', '4', '5', '6 Rendah', '6 Atas'];
var SESI_LIST = ['Pagi', 'Petang'];
var TAHAP_LIST = ['Ringan', 'Sederhana', 'Berat'];

var DEFAULT_SETTINGS = {
  NAMA_SEKOLAH: 'Nama Sekolah Anda',
  ALAMAT_SEKOLAH: 'Alamat sekolah',
  LOGO_FILE_ID: '',
  SESSION_TIMEOUT_MIN: '30',
  MAX_FILE_MB: '5',
  MAX_LAMPIRAN: '5',
  RETENTION_NOTE: 'Rekod disimpan mengikut arahan sekolah dan KPM yang berkuat kuasa.',
  KATEGORI: JSON.stringify([
    {nama: 'BARANGAN LARANGAN', jenis: ['PEMETIK API', 'PERALATAN YANG BERKAITAN SEKSUAL', 'MANCIS', 'MINUMAN MEMABUKKAN', 'MINUMAN BERALKOHOL', 'SENJATA TAJAM', 'SENJATA BERBAHAYA', 'SENJATA API', 'SEBARANG BENTUK ALATAN MEDIA ELEKTRONIK DAN APA JUA JENIS ALAT KOMUNIKASI', 'PERALATAN YANG MENGANCAM KESELAMATAN', 'BAHAN BACAAN BERUNSURKAN TAHYUL', 'ALATAN YANG MENDORONG KEPADA BUDAYA VANDALISME', 'BARANG KEMAS DAN AKSESORI', 'PAKAIAN YANG MELAMBANGKAN PERTUBUHAN EKSTRIM', 'PAKAIAN YANG TIDAK MENEPATI PERATURAN', 'BARANG KOSMETIK', 'HAIWAN PELIHARAAN', 'KONDOM', 'PERALATAN PENGINTIP', 'DRONE', 'LAIN-LAIN']},
    {nama: 'KEKEMASAN DIRI', jenis: ['BERKUKU PANJANG', 'BERAMBUT PANJANG', 'RAMBUT BERFESYEN', 'MEMAKAI TALI PINGGANG YANG TIDAK DIBENARKAN', 'MEWARNA KUKU', 'BERMISAI', 'MEMAKAI PAKAIAN TIDAK MENGIKUT PERATURAN', 'MEMAKAI BARANG KEMAS', 'MENCUKUR BULU KENING', 'MEMAKAI ALAT SOLEK', 'MEWARNA RAMBUT', 'TIDAK MEMAKAI BAJU (CAMISOLE)', 'MEMAKAI PAKAIAN YANG SENDAT DAN JARANG', 'MEMAKAI PAKAIAN YANG MEMAPARKAN UNSUR NEGATIF', 'MEMAKAI SELIPAR TANPA KEBENARAN', 'TIDAK MEMAKAI LENCANA SEKOLAH', 'TIDAK MEMAKAI TANDA NAMA', 'MEMAKAI SANDAL TANPA KEBENARAN', 'MEMAKAI AKSESORI PERHIASAN', 'TIDAK MEMAKAI COLI', 'TIDAK MEMAKAI KAIN DALAM', 'TIDAK MEMAKAI SELUAR DALAM', 'MEMAKAI KANTA LEKAP YANG BERFESYEN', 'MEMAKAI KOPIAH', 'BERJANGGUT', 'BERINAI', 'LAIN-LAIN']},
    {nama: 'KENAKALAN', jenis: ['MENUNGGANG MOTOSIKAL DALAM KAWASAN SEKOLAH', 'MENGGANGGU SEMASA PENGAJARAN DAN PEMBELAJARAN', 'TIDAK IKUT GILIRAN', 'MEMBAWA MERCUN ATAU BUNGA API', 'MASUK TANDAS BERLAINAN JANTINA', 'SENGAJA MEMBUNYIKAN LOCENG KECEMASAN ATAU PENGGERA', 'MENGUBAHSUAI PENDAWAIAN ELEKTRIK', 'KELUAR KAWASAN SEKOLAH TANPA KEBENARAN', 'PERBUATAN YANG MENCEMARKAN NAMA BAIK INSTITUSI PENDIDIKAN', 'PERKATAAN YANG MENCEMARKAN NAMA BAIK INSTITUSI PENDIDIKAN', 'MENUNGGANG BASIKAL DALAM KAWASAN SEKOLAH', 'MENUNGGANG BASIKAL ELEKTRIK DALAM KAWASAN SEKOLAH', 'MENYALAHGUNAKAN ALAT PEMADAM API', 'TERJUN DARI TEMPAT TINGGI KERANA KENAKALAN', 'MASUK TANDAS UNTUK MURID BERKEPERLUAN PENDIDIKAN KHAS', 'MASUK DAN MENGGUNAKAN TANDAS GURU', 'MAKAN DALAM KELAS TANPA KEBENARAN', 'MENCEROBOH KAWASAN LARANGAN', 'BERADA DALAM KAWASAN SEKOLAH SEMASA TEMPOH HUKUMAN GANTUNG ATAU BUANG SEKOLAH', 'BERADA DALAM KAWASAN SEKOLAH MELEBIHI KETETAPAN YANG DIBENARKAN BAGI PEPERIKSAAN SEMASA TEMPOH HUKUMAN BUANG SEKOLAH', 'BERMAIN DAUN TERUP DALAM KAWASAN SEKOLAH', 'BERMAIN DI DALAM KELAS/BILIK KHAS', 'BEREBUT-REBUT', 'BERTOLAK-TOLAK', 'MENYALAHGUNAKAN KEMUDAHAN DAN PERALATAN SEKOLAH', 'BERMAIN MERCUN ATAU BUNGA API', 'MENJUAL MERCUN ATAU BUNGA API', 'MEMBEKAL MERCUN ATAU BUNGA API', 'MELAKUKAN AKTIVITI TANPA PENGAWASAN GURU', 'MENYALAHGUNAKAN GELUNG HOS KEBAKARAN', 'TIDAK MENYIAPKAN NOTA', 'TIDAK MENYIAPKAN LATIHAN', 'TIDAK MENYIAPKAN TUGASAN', 'KELUAR KELAS TANPA KEBENARAN', 'MASUK DAN MENGGUNAKAN TANDAS KAKITANGAN', 'MENGGUNAKAN KEMUDAHAN DAN PERALATAN SEKOLAH TANPA KEBENARAN', 'MAKAN ATAU MINUM DI DALAM TANDAS', 'MELANGGAR PERATURAN YANG DITETAPKAN DI BILIK KHAS', 'MAKAN BEKALAN MAKANAN ATAU MINUMAN RAKAN MURID TANPA KEBENARAN', 'MEMANDU KENDERAAN DALAM KAWASAN SEKOLAH', 'LAIN-LAIN']},
    {nama: 'KESALAHAN ASRAMA', jenis: ['LAIN-LAIN']},
    {nama: 'KESALAHAN SIBER', jenis: ['GANGGUAN SEKSUAL', 'PERKATAAN LUCAH', 'PERBUATAN MENCEMARKAN NAMA SEKOLAH', 'ISU PERKAUMAN', 'PENYEBARAN BERITA PALSU', 'TIDAK MENGHORMATI NEGARA MALAYSIA', 'PENULARAN VIDEO YANG BOLEH MENGAIBKAN SESEORANG', 'KATA-KATA KESAT', 'PERBUATAN LUCAH', 'PERKATAAN YANG MENYEBABKAN PROVOKASI', 'PERKATAAN YANG MENCEMARKAN NAMA SEKOLAH', 'FITNAH', 'JUDI SIBER', 'PENIPUAN SIBER', 'MENGGODAM MANA-MANA PROGRAM', 'TIDAK MENGHORMATI NEGARA LAIN', 'TIDAK MENGHORMATI NEGERI DI MALAYSIA', 'TIDAK MENGHORMATI SEKOLAH', 'TIDAK MENGHORMATI DAERAH', 'PENULARAN GAMBAR YANG BOLEH MENGAIBKAN SESEORANG', 'PERBUATAN YANG MENYEBABKAN PROVOKASI', 'MENGGODAM MANA-MANA SISTEM', 'MENGGODAM MANA-MANA APLIKASI', 'MENGGODAM MANA-MANA DATA YANG DISIMPAN', 'LAIN-LAIN']},
    {nama: 'PENGLIBATAN POLITIK', jenis: ['PENGLIBATAN DALAM PERHIMPUNAN POLITIK', 'MERAYU UNDI DALAM PILIHANRAYA', 'MENYEBAR PENULISAN POLITIK', 'MEMILIKI BARANG ATAU BAHAN BERKAITAN POLITIK', 'PENGLIBATAN DALAM PERARAKAN POLITIK', 'MENYEBAR DOKUMEN POLITIK', 'MENYEBAR PROPAGANDA POLITIK', 'MEMBAWA BARANG ATAU BAHAN BERKAITAN POLITIK', 'MEMAKAI BARANG ATAU BAHAN BERKAITAN POLITIK', 'LAIN-LAIN']},
    {nama: 'SALAH LAKU BULI', jenis: ['BULI BAHASA KEPADA MURID', 'BULI FIZIKAL KEPADA MURID', 'BULI BUKAN LISAN', 'BULI SIBER', 'LAIN-LAIN']},
    {nama: 'SALAH LAKU PONTENG', jenis: ['PONTENG SEKOLAH', 'PONTENG KELAS', 'PONTENG AKTIVITI KOKURIKULUM', 'PONTENG PERHIMPUNAN', 'PONTENG UJIAN', 'PONTENG ACARA RASMI SEKOLAH', 'PONTENG KELAS TAMBAHAN', 'PONTENG SESI KAUSELING', 'PONTENG PEPERIKSAAN', 'PONTENG SOLAT', 'PONTENG AKTIVITI KEROHANIAN DAN MORAL', 'LAIN-LAIN']},
    {nama: 'SALAH LAKU ROKOK', jenis: ['MEMILIKI ROKOK', 'MEMBEKAL ROKOK', 'MENJUAL ROKOK', 'MENGHISAP ROKOK', 'MENYIMPAN ROKOK', 'MEMBELI ROKOK', 'MENGIKLANKAN ROKOK', 'MENAWARKAN ROKOK', 'LAIN-LAIN']},
    {nama: 'SALAH LAKU ROKOK ELEKTRONIK', jenis: ['MENGIKLANKAN ROKOK ELEKTRONIK/ VAPE', 'MENAWARKAN ROKOK ELEKTRONIK/ VAPE', 'MENGHISAP ROKOK ELEKTRONIK/ VAPE', 'MEMILIKI CECAIR ROKOK ELEKTRONIK/ VAPE', 'MEMBEKAL CECAIR ROKOK ELEKTRONIK/ VAPE', 'MENJUAL CECAIR ROKOK ELEKTRONIK/ VAPE', 'MEMBELI CECAIR ROKOK ELEKTRONIK/ VAPE', 'MENGIKLANKAN CECAIR ROKOK ELEKTRONIK/ VAPE', 'MENAWARKAN CECAIR ROKOK ELEKTRONIK/ VAPE', 'MEMILIKI PERKAKASAN BERKAITAN ROKOK ELEKTRONIK/ VAPE', 'MENYIMPAN PERKAKASAN BERKAITAN ROKOK ELEKTRONIK/ VAPE', 'MEMBEKAL PERKAKASAN BERKAITAN ROKOK ELEKTRONIK/ VAPE', 'MENJUAL PERKAKASAN BERKAITAN ROKOK ELEKTRONIK/ VAPE', 'MENGIKLANKAN PERKAKASAN BERKAITAN ROKOK ELEKTRONIK/ VAPE', 'MENAWARKAN PERKAKASAN BERKAITAN ROKOK ELEKTRONIK/ VAPE', 'MEMILIKI ROKOK ELEKTRONIK/ VAPE', 'MENYIMPAN ROKOK ELEKTRONIK/ VAPE', 'MEMBEKAL ROKOK ELEKTRONIK/ VAPE', 'MENJUAL ROKOK ELEKTRONIK/ VAPE', 'MEMBELI ROKOK ELEKTRONIK/ VAPE', 'LAIN-LAIN']},
    {nama: 'SALAH LAKU TELEFON BIMBIT', jenis: ['MEMBAWA TELEFON BIMBIT KE DALAM KAWASAN SEKOLAH', 'MENGGUNAKAN TELEFON BIMBIT DI DALAM KAWASAN SEKOLAH', 'MENYALAHGUNAKAN FUNGSI TELEFON BIMBIT', 'URUS NIAGA YANG MELIBATKAN TELEFON BIMBIT', 'LAIN-LAIN']},
    {nama: 'SALAH LAKU TIDAK AMANAH', jenis: ['TIDAK AMANAH', 'BERBOHONG', 'TIDAK BERTANGGUNGJAWAB', 'TIDAK JUJUR', 'MEMBUAT FITNAH', 'MENIRU', 'SUBAHAT', 'PLAGIAT/ CIPLAK', 'LAIN-LAIN']},
    {nama: 'SEKSUAL', jenis: ['KOMUNIKASI SECARA SEKSUAL', 'PENGANTUNAN KANAK-KANAK', 'AMANG SEKSUAL SECARA FIZIKAL', 'AMANG SEKSUAL BUKAN FIZIKAL ATAS KANAK-KANAK', 'ROGOL', 'ROGOL STATUTORI', 'SUMBANG MAHRAM', 'MELIWAT', 'CABUL', 'MELAKUKAN SEKS MENGGUNAKAN OBJEK', 'LESBIAN', 'GAY', 'TRANSGENDER', 'BISEXUAL', 'PEKERJA SEKS', 'LAIN-LAIN']},
    {nama: 'TINGKAH LAKU JENAYAH', jenis: ['MENCURI', 'MENGANCAM GURU', 'MENGANCAM KAKITANGAN DAN PEKERJA BUKAN GURU', 'MENGANCAM MURID', 'GENGSTERISME', 'PERAS UGUT', 'BERGADUH', 'MEMUKUL GURU', 'MEMUKUL KAKITANGAN DAN PEKERJA BUKAN GURU', 'MEMUKUL MURID', 'MENCEDERAKAN GURU', 'MENCEDERAKAN KAKITANGAN DAN PEKERJA BUKAN GURU', 'MENCEDERAKAN MURID', 'MERUSUH', 'PUNCA RUSUHAN BERLAKU', 'BERSUBAHAT DALAM PERGADUHAN', 'MENGANGGOTAI KUMPULAN GENGSTERISME', 'MEREKRUT MURID MENJADI AHLI GENGSTERISME', 'PUNCA PERGADUHAN BERLAKU', 'BERSUBAHAT DALAM MERUSUH', 'MEMILIKI BAHAN LETUPAN', 'MEMILIKI BAHAN KAKISAN', 'MEMILIKI SENJATA', 'MENAWARKAN BAHAN LETUPAN', 'MENAWARKAN BAHAN KAKISAN', 'MENAWARKAN SENJATA', 'MEMBEKAL BAHAN LETUPAN', 'MEMBEKAL BAHAN KAKISAN', 'MEMBEKAL SENJATA', 'MENJUAL BAHAN LETUPAN', 'MENJUAL BAHAN KAKISAN', 'MENJUAL SENJATA', 'MENGGUNAKAN BAHAN LETUPAN', 'MENGGUNAKAN BAHAN KAKISAN', 'MENGGUNAKAN SENJATA', 'BERJUDI', 'LAIN-LAIN']},
    {nama: 'TINGKAH LAKU KURANG SOPAN/ BIADAP', jenis: ['BIADAB KEPADA GURU', 'BIADAB KEPADA MURID', 'BIADAP KEPADA KAKITANGAN DAN PEKERJA BUKAN GURU', 'BIADAP KEPADA TETAMU', 'MEMBUANG SAMPAH MERATA-RATA', 'INGKAR ARAHAN GURU', 'INGKAR ARAHAN PENGAWAS', 'MELUDAH DI TEMPAT TIDAK SEPATUTNYA', 'MEMBUANG AIR KECIL ATAU AIR BESAR MERATA-RATA', 'TIDAK MENGURUSKAN TUALA WANITA DENGAN BETUL', 'MEMBUANG APA-APA OBJEK DALAM LUBANG/MANGKUK TANDAS', 'TIDAK MENGHORMATI LAGU KEBANGSAAN', 'TIDAK MENGHORMATI LAGU NEGERI', 'TIDAK MENGHORMATI LAGU SEKOLAH', 'TIDAK MENGHORMATI IKRAR RUKUN NEGARA', 'TIDAK MENGHORMATI RUMAH IBADAT', 'TIDAK MENGHORMATI AGAMA', 'LAIN-LAIN']},
    {nama: 'TINGKAH LAKU LUCAH', jenis: ['BAWA BAHAN LUCAH', 'MENGINTAI', 'MEMELUK MURID LAIN JANTINA', 'BERCUMBUAN', 'BERKHALWAT', 'MENGEDAR BAHAN LUCAH', 'MENGGUNAKAN KATA-KATA LUCAH', 'MENULIS KATA-KATA LUCAH', 'MENONTON VIDEO LUCAH', 'BERDUA-DUAAN YANG MENIMBULKAN SYAK', 'MEMBEKAL BAHAN LUCAH', 'MENJUAL BAHAN LUCAH', 'MENAWARKAN DAN BERKONGSI BAHAN LUCAH', 'MENGIKLANKAN BAHAN LUCAH', 'MEMILIKI BAHAN LUCAH', 'MELAKUKAN PERBUATAN LUCAH', 'MELUKIS GAMBAR LUCAH', 'LAIN-LAIN']},
    {nama: 'TINGKAH LAKU TIDAK PENTINGKAN MASA', jenis: ['LEWAT KE SEKOLAH', 'LEWAT KE PERHIMPUNAN', 'LEWAT MASUK KELAS', 'LEWAT DATANG AKTIVITI KOKURIKULUM', 'LEWAT MASUK KE KELAS TAMBAHAN', 'LEWAT DATANG AKTIVITI LUAR KELAS', 'LEWAT MASUK BILIK KHAS', 'LEWAT MASUK KE KELAS PERSEDIAAN', 'LAIN-LAIN']},
    {nama: 'VANDALISME', jenis: ['MEROSAKKAN HARTA BENDA SEKOLAH', 'MEROSAKKAN PERALATAN BILIK-BILIK KHAS', 'MEROSAKKAN HARTA BENDA ASRAMA', 'MEROSAKKAN HARTA BENDA KANTIN', 'MEROSAKKAN TANAMAN TUMBUHAN ATAU TANAMAN HIASAN', 'MENCONTENG DINDING BANGUNAN SEKOLAH', 'MENGOYAK BUKU', 'MEROSAKKAN PERALATAN SUKAN', 'MEROSAKKAN KENDERAAN PENGETUA ATAU GURU BESAR', 'MEROSAKKAN HARTA MURID', 'MEROSAKKAN HARTA GURU', 'MENCONTENG BUKU', 'MEROSAKKAN HARTA KAKITANGAN DAN PEKERJA BUKAN GURU', 'MEROSAKKAN HARTA PENGETUA ATAU GURU BESAR', 'MEROSAKKAN KENDERAAN GURU', 'MEROSAKKAN KENDERAAN KAKITANGAN DAN PEKERJA BUKAN GURU', 'MEROSAKKAN KENDERAAN MURID', 'MEROSAKKAN KENDERAAN PELAWAT', 'LAIN-LAIN']}
  ]),
  JENIS_TINDAKAN: JSON.stringify([
    'Nasihat / teguran', 'Sesi kaunseling', 'Amaran lisan', 'Amaran bertulis',
    'Surat panggilan ibu bapa / penjaga', 'Rujukan kepada Guru Bimbingan dan Kaunseling',
    'Tindakan mengikut peraturan sekolah', 'Rujukan kepada pihak luar yang berkaitan', 'Lain-lain'
  ]),
  TEMPAT: JSON.stringify([
    'Bilik darjah', 'Kantin', 'Padang', 'Tandas', 'Koridor', 'Pintu pagar sekolah', 'Makmal',
    'Perpustakaan', 'Surau', 'Asrama', 'Dewan', 'Luar kawasan sekolah', 'Lain-lain'
  ])
};

/* ------------------------------------------------------------------ */
/* setupDatabase()                                                     */
/* ------------------------------------------------------------------ */

/**
 * Jalankan SEKALI dari editor Apps Script oleh pemilik skrip.
 * Selamat dijalankan semula: hanya menambah apa yang tiada, tidak memadam data.
 */
function setupDatabase() {
  if (!isOwnerRun_()) {
    throw new Error('setupDatabase() hanya boleh dijalankan oleh pemilik skrip dari editor Apps Script.');
  }
  var log = [];
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');
  var ss;
  if (ssId) {
    ss = SpreadsheetApp.openById(ssId);
    log.push('Guna spreadsheet sedia ada: ' + ss.getName());
  } else {
    ss = SpreadsheetApp.create('e-DISIPLIN MURID 2026 — DATABASE');
    props.setProperty('SPREADSHEET_ID', ss.getId());
    log.push('Spreadsheet baharu dicipta: ' + ss.getId());
  }
  try { ss.setSpreadsheetTimeZone(APP.TZ); } catch (e) { /* abaikan */ }

  Object.keys(SCHEMA).forEach(function (name) {
    var headers = SCHEMA[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      log.push('Sheet dicipta: ' + name);
    }
    var lastCol = sh.getLastColumn();
    var existing = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    var missing = headers.filter(function (h) { return existing.indexOf(h) < 0; });
    if (existing.filter(String).length === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else if (missing.length) {
      sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      log.push(name + ': kolum ditambah ' + missing.join(', '));
    }
    var totalCols = Math.max(headers.length, existing.length + missing.length);
    sh.getRange(1, 1, 1, totalCols).setFontWeight('bold').setBackground('#10284f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    // Simpan semua nilai sebagai teks biasa supaya tarikh/ID tidak ditukar automatik.
    sh.getRange(1, 1, sh.getMaxRows(), totalCols).setNumberFormat('@');
  });

  // Buang sheet lalai yang kosong.
  ss.getSheets().forEach(function (sh) {
    if (!SCHEMA[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });

  // Lindungi sheet audit & sejarah daripada disunting secara manual oleh editor lain.
  PROTECTED_SHEETS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    var existingP = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existingP.length === 0) {
      var p = sh.protect().setDescription('Dilindungi oleh e-DISIPLIN: rekod tidak boleh diubah.');
      try {
        p.removeEditors(p.getEditors());
        if (p.canDomainEdit()) p.setDomainEdit(false);
      } catch (e) { /* pemilik kekal sebagai editor */ }
      log.push('Perlindungan ditetapkan: ' + name);
    }
  });

  DBC_.ss = ss;
  DBC_.t = {};

  ensureFolders_(log);

  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (!findOne_('SETTINGS', 'SettingKey', k)) {
      insert_('SETTINGS', { SettingKey: k, SettingValue: DEFAULT_SETTINGS[k], UpdatedAt: nowIso_() });
    }
  });
  log.push('Tetapan lalai disemak.');

  // Bootstrap: pemilik skrip menjadi Admin pertama.
  var ownerEmail = Session.getEffectiveUser().getEmail().toLowerCase();
  var owner = findUserByEmail_(ownerEmail);
  if (!owner) {
    insert_('USERS', {
      UserID: shortId_('USR'), NamaPenuh: 'Pentadbir Sistem', IDGuru: 'ADMIN', Email: ownerEmail, Telefon: '',
      Sekolah: getSetting_('NAMA_SEKOLAH'), Jawatan: 'Admin', Role: ROLES.ADMIN, AuthProviderID: 'GOOGLE:OWNER',
      StatusAkaun: ACCOUNT.AKTIF, TarikhDaftar: nowIso_(), LastLogin: '', DiluluskanOleh: 'SISTEM', TarikhLulus: nowIso_()
    });
    log.push('Admin pertama dicipta untuk ' + ownerEmail + ' (kemas kini nama & ID Guru di Tetapan).');
  } else if (owner.Role !== ROLES.ADMIN || owner.StatusAkaun !== ACCOUNT.AKTIF) {
    update_('USERS', owner._row, { Role: ROLES.ADMIN, StatusAkaun: ACCOUNT.AKTIF });
    log.push('Akaun pemilik dipulihkan sebagai Admin aktif.');
  }

  writeAuditLog_({ userId: owner ? owner.UserID : 'SISTEM', email: ownerEmail }, 'SETUP_DATABASE', '', 'BERJAYA', log.length + ' langkah');
  log.push('URL database: ' + ss.getUrl());
  if (!prop_('GOOGLE_CLIENT_ID')) log.push('PERHATIAN: tetapkan GOOGLE_CLIENT_ID dalam Script Properties sebelum pengguna boleh log masuk.');
  log.push('SELESAI. Seterusnya: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).');
  Logger.log(log.join('\n'));
  return log;
}

function ensureFolders_(log) {
  var props = PropertiesService.getScriptProperties();
  function getOrCreate(key, name, parent) {
    var id = props.getProperty(key);
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (e) { /* dicipta semula di bawah */ }
    }
    var f = parent ? parent.createFolder(name) : DriveApp.createFolder(name);
    try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) { /* domain mungkin menyekat */ }
    props.setProperty(key, f.getId());
    log.push('Folder Drive dicipta: ' + name);
    return f;
  }
  var root = getOrCreate('ROOT_FOLDER_ID', 'e-DISIPLIN 2026 (SULIT)', null);
  getOrCreate('ATTACHMENT_FOLDER_ID', 'Lampiran Bukti', root);
  getOrCreate('BACKUP_FOLDER_ID', 'Sandaran', root);
  getOrCreate('ASSET_FOLDER_ID', 'Aset Sekolah', root);
}

/** Diagnostik — jalankan dari editor jika ada masalah. */
function diagnose() {
  var out = [];
  out.push('Pengguna aktif: ' + (Session.getActiveUser().getEmail() || '(kosong)'));
  out.push('Pengguna efektif (pemilik): ' + Session.getEffectiveUser().getEmail());
  ['GOOGLE_CLIENT_ID', 'SPREADSHEET_ID', 'ATTACHMENT_FOLDER_ID', 'BACKUP_FOLDER_ID', 'ASSET_FOLDER_ID', 'ALLOWED_DOMAINS'].forEach(function (k) {
    out.push(k + ': ' + (prop_(k) || '(belum ditetapkan)'));
  });
  try {
    var ss = ss_();
    Object.keys(SCHEMA).forEach(function (n) {
      var sh = ss.getSheetByName(n);
      out.push('Sheet ' + n + ': ' + (sh ? (sh.getLastRow() - 1) + ' rekod' : 'TIADA'));
    });
  } catch (e) {
    out.push('Database: ' + e.message);
  }
  out.push('Trigger: ' + ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).join(', '));
  Logger.log(out.join('\n'));
  return out;
}

/* ------------------------------------------------------------------ */
/* Akses jadual                                                        */
/* ------------------------------------------------------------------ */

var DBC_ = { ss: null, t: {} };

function ss_() {
  if (!DBC_.ss) {
    var id = prop_('SPREADSHEET_ID');
    if (!id) throw AppError_('TIADA_DB', 'Database belum disediakan. Pemilik skrip perlu menjalankan setupDatabase().');
    DBC_.ss = SpreadsheetApp.openById(id);
  }
  return DBC_.ss;
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw AppError_('TIADA_DB', 'Sheet ' + name + ' tiada. Jalankan setupDatabase().');
  return sh;
}

function toCell_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, APP.TZ, "yyyy-MM-dd'T'HH:mm:ss");
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  var s = String(v);
  // Halang formula / CSV injection.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function fromCell_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, APP.TZ, "yyyy-MM-dd'T'HH:mm:ss");
  var s = String(v);
  if (/^'[=+\-@]/.test(s)) s = s.slice(1);
  return s;
}

function table_(name) {
  if (DBC_.t[name]) return DBC_.t[name];
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var headers = (values[0] || []).map(String);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var o = { _row: i + 1 };
    var empty = true;
    for (var j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      o[headers[j]] = fromCell_(values[i][j]);
      if (o[headers[j]] !== '') empty = false;
    }
    if (!empty) rows.push(o);
  }
  DBC_.t[name] = { headers: headers, rows: rows };
  return DBC_.t[name];
}

function all_(name) { return table_(name).rows; }

function findOne_(name, key, val) {
  var rows = all_(name);
  for (var i = 0; i < rows.length; i++) if (rows[i][key] === val) return rows[i];
  return null;
}

function insert_(name, obj) {
  var t = table_(name);
  var row = t.headers.map(function (h) { return toCell_(obj[h]); });
  sheet_(name).appendRow(row);
  delete DBC_.t[name];
  return obj;
}

function update_(name, rowNum, patch) {
  var t = table_(name);
  var rec = null;
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i]._row === rowNum) { rec = t.rows[i]; break; }
  if (!rec) throw AppError_('TIDAK_DIJUMPAI', 'Rekod tidak dijumpai.');
  var merged = t.headers.map(function (h) { return toCell_(Object.prototype.hasOwnProperty.call(patch, h) ? patch[h] : rec[h]); });
  sheet_(name).getRange(rowNum, 1, 1, t.headers.length).setValues([merged]);
  delete DBC_.t[name];
  var out = {};
  t.headers.forEach(function (h, idx) { out[h] = fromCell_(merged[idx]); });
  out._row = rowNum;
  return out;
}

/* ------------------------------------------------------------------ */
/* Tetapan                                                             */
/* ------------------------------------------------------------------ */

function getSetting_(k) {
  var r = findOne_('SETTINGS', 'SettingKey', k);
  return r ? r.SettingValue : (DEFAULT_SETTINGS[k] || '');
}

function setSetting_(k, v) {
  var r = findOne_('SETTINGS', 'SettingKey', k);
  if (r) update_('SETTINGS', r._row, { SettingValue: v, UpdatedAt: nowIso_() });
  else insert_('SETTINGS', { SettingKey: k, SettingValue: v, UpdatedAt: nowIso_() });
}

function settingJson_(k) {
  try {
    var v = JSON.parse(getSetting_(k));
    if (Array.isArray(v)) return v;
  } catch (e) { /* guna lalai */ }
  return JSON.parse(DEFAULT_SETTINGS[k]);
}

function timeoutMin_() {
  var n = Number(getSetting_('SESSION_TIMEOUT_MIN'));
  return (n >= 5 && n <= 240) ? n : 30;
}

function publicSettings_() {
  return {
    namaSekolah: getSetting_('NAMA_SEKOLAH'),
    alamatSekolah: getSetting_('ALAMAT_SEKOLAH'),
    kategori: settingJson_('KATEGORI'),
    jenisTindakan: settingJson_('JENIS_TINDAKAN'),
    tempat: settingJson_('TEMPAT'),
    tingkatan: TINGKATAN_LIST,
    sesi: SESI_LIST,
    tahap: TAHAP_LIST,
    jawatan: JAWATAN_LIST,
    roleLabel: ROLE_LABEL,
    statusLabel: STATUS_LABEL,
    maxFileMb: Number(getSetting_('MAX_FILE_MB')) || 5,
    maxLampiran: Number(getSetting_('MAX_LAMPIRAN')) || 5,
    timeoutMin: timeoutMin_(),
    hasLogo: !!getSetting_('LOGO_FILE_ID'),
    retentionNote: getSetting_('RETENTION_NOTE'),
    version: APP.VERSION
  };
}

/** Tetapan sekolah untuk semua pengguna aktif. */
function getSchoolSettings(token) {
  return secured_(token, null, function () { return publicSettings_(); });
}

/** Admin sahaja. */
function updateSchoolSettings(token, payload) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var p = obj_(payload);
    return withLock_(function () {
      var changed = [];
      if ('namaSekolah' in p) { setSetting_('NAMA_SEKOLAH', vStr_(p.namaSekolah, 'Nama sekolah', { required: true, max: 150 })); changed.push('NAMA_SEKOLAH'); }
      if ('alamatSekolah' in p) { setSetting_('ALAMAT_SEKOLAH', vStr_(p.alamatSekolah, 'Alamat sekolah', { max: 400 })); changed.push('ALAMAT_SEKOLAH'); }
      if ('timeoutMin' in p) {
        var n = Number(p.timeoutMin);
        if (!(n >= 5 && n <= 240)) throw AppError_('INPUT_TIDAK_SAH', 'Tempoh sesi mesti antara 5 hingga 240 minit.');
        setSetting_('SESSION_TIMEOUT_MIN', String(Math.round(n))); changed.push('SESSION_TIMEOUT_MIN');
      }
      if ('retentionNote' in p) { setSetting_('RETENTION_NOTE', vStr_(p.retentionNote, 'Dasar penyimpanan', { max: 1000 })); changed.push('RETENTION_NOTE'); }
      if ('kategori' in p) {
        if (!Array.isArray(p.kategori) || !p.kategori.length) throw AppError_('INPUT_TIDAK_SAH', 'Senarai kategori tidak sah.');
        var seen = {};
        var kat = p.kategori.slice(0, 50).map(function (k) {
          var nama = vStr_(k && k.nama, 'Nama kategori', { required: true, max: 100 });
          if (seen[nama]) throw AppError_('INPUT_TIDAK_SAH', 'Kategori berulang: ' + nama);
          seen[nama] = true;
          var jenis = (Array.isArray(k.jenis) ? k.jenis : []).map(function (j) { return vStr_(j, 'Jenis kesalahan', { max: 150 }); }).filter(String);
          if (!jenis.length) jenis = ['Lain-lain'];
          return { nama: nama, jenis: jenis.slice(0, 60) };
        });
        setSetting_('KATEGORI', JSON.stringify(kat)); changed.push('KATEGORI');
      }
      ['jenisTindakan:JENIS_TINDAKAN', 'tempat:TEMPAT'].forEach(function (pair) {
        var a = pair.split(':');
        if (a[0] in p) {
          if (!Array.isArray(p[a[0]])) throw AppError_('INPUT_TIDAK_SAH', 'Senarai tidak sah.');
          var list = p[a[0]].map(function (x) { return vStr_(x, 'Item senarai', { max: 150 }); }).filter(String).slice(0, 60);
          if (!list.length) throw AppError_('INPUT_TIDAK_SAH', 'Senarai tidak boleh kosong.');
          setSetting_(a[1], JSON.stringify(list)); changed.push(a[1]);
        }
      });
      writeAuditLog_(ctx, 'KEMASKINI_TETAPAN', '', 'BERJAYA', changed.join(', '));
      return publicSettings_();
    });
  });
}

/** Admin muat naik logo sekolah (PNG/JPEG, maks 1MB). */
function uploadLogo(token, payload) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var p = obj_(payload);
    var file = decodeUpload_(p, ['image/png', 'image/jpeg'], 1);
    return withLock_(function () {
      var folder = DriveApp.getFolderById(prop_('ASSET_FOLDER_ID'));
      var old = getSetting_('LOGO_FILE_ID');
      var f = folder.createFile(file.blob.setName('logo-sekolah.' + (file.mime === 'image/png' ? 'png' : 'jpg')));
      setSetting_('LOGO_FILE_ID', f.getId());
      if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) { /* abaikan */ } }
      writeAuditLog_(ctx, 'MUAT_NAIK_LOGO', '', 'BERJAYA', f.getName());
      return { hasLogo: true };
    });
  });
}

function getLogoDataUrl_() {
  var id = getSetting_('LOGO_FILE_ID');
  if (!id) return '';
  try {
    var blob = DriveApp.getFileById(id).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { return ''; }
}

function getLogo(token) {
  return secured_(token, null, function () { return { dataUrl: getLogoDataUrl_() }; });
}

/* ------------------------------------------------------------------ */
/* Murid                                                               */
/* ------------------------------------------------------------------ */

/** Carian murid untuk autolengkap borang (semua pengguna aktif, maks 15 hasil). */
function searchStudents(token, payload) {
  return secured_(token, null, function () {
    var q = vStr_(obj_(payload).q, 'Carian', { max: 60 }).toLowerCase();
    if (q.length < 2) return [];
    return all_('STUDENTS')
      .filter(function (s) { return s.Status !== 'TIDAK_AKTIF' && (s.NamaMurid.toLowerCase().indexOf(q) >= 0 || s.StudentID.toLowerCase().indexOf(q) >= 0); })
      .slice(0, 15)
      .map(function (s) { return { studentId: s.StudentID, namaMurid: s.NamaMurid, tingkatan: s.Tingkatan, kelas: s.Kelas, sesi: s.Sesi, jantina: s.Jantina }; });
  });
}

/**
 * Admin import murid. Format CSV setiap baris:
 * ID Murid, Nama Murid, Tingkatan, Kelas, Sesi, Jantina
 */
function importStudents(token, payload) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var csv = vStr_(obj_(payload).csv, 'Data CSV', { required: true, max: 500000 });
    var lines = csv.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(String);
    if (lines.length > 3000) throw AppError_('INPUT_TIDAK_SAH', 'Maksimum 3000 baris setiap import.');
    var added = 0, updated = 0, errors = [];
    withLock_(function () {
      var existing = {};
      all_('STUDENTS').forEach(function (s) { existing[s.StudentID] = s; });
      var newRows = [];
      lines.forEach(function (line, idx) {
        var c = parseCsvLine_(line);
        if (idx === 0 && /id\s*murid|studentid/i.test(c[0] || '')) return; // baris tajuk
        try {
          var rec = {
            StudentID: vStr_(c[0], 'ID Murid', { required: true, max: 30, pattern: /^[A-Za-z0-9\-\/]+$/ }),
            NamaMurid: vStr_(c[1], 'Nama Murid', { required: true, max: 120 }),
            Tingkatan: vStr_(c[2], 'Tingkatan', { oneOf: TINGKATAN_LIST }),
            Kelas: vStr_(c[3], 'Kelas', { max: 40 }),
            Sesi: vStr_(c[4], 'Sesi', { oneOf: SESI_LIST }),
            Jantina: vStr_(c[5], 'Jantina', { oneOf: ['Lelaki', 'Perempuan'] }),
            Status: 'AKTIF', UpdatedAt: nowIso_()
          };
          if (existing[rec.StudentID]) { update_('STUDENTS', existing[rec.StudentID]._row, rec); updated++; }
          else { newRows.push(rec); existing[rec.StudentID] = rec; added++; }
        } catch (e) {
          errors.push('Baris ' + (idx + 1) + ': ' + e.message);
        }
      });
      if (newRows.length) {
        var t = table_('STUDENTS');
        var sh = sheet_('STUDENTS');
        var values = newRows.map(function (r) { return t.headers.map(function (h) { return toCell_(r[h]); }); });
        sh.getRange(sh.getLastRow() + 1, 1, values.length, t.headers.length).setValues(values);
        delete DBC_.t.STUDENTS;
      }
    });
    writeAuditLog_(ctx, 'IMPORT_MURID', '', 'BERJAYA', 'Tambah ' + added + ', kemas kini ' + updated + ', ralat ' + errors.length);
    return { added: added, updated: updated, errors: errors.slice(0, 50) };
  });
}

function studentCount(token) {
  return secured_(token, [ROLES.ADMIN], function () { return { total: all_('STUDENTS').length }; });
}

function parseCsvLine_(line) {
  var out = [], cur = '', q = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' || ch === '\t') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Tambah/kemas kini murid daripada laporan yang dihantar. */
function upsertStudentFromReport_(r) {
  if (!r.StudentID) return;
  var s = findOne_('STUDENTS', 'StudentID', r.StudentID);
  var rec = { StudentID: r.StudentID, NamaMurid: r.NamaMurid, Tingkatan: r.Tingkatan, Kelas: r.Kelas, Sesi: r.Sesi, Jantina: r.Jantina, UpdatedAt: nowIso_() };
  if (s) update_('STUDENTS', s._row, rec);
  else { rec.Status = 'AKTIF'; insert_('STUDENTS', rec); }
}

/* ------------------------------------------------------------------ */
/* Muat naik fail (pengesahan sebelah pelayan)                         */
/* ------------------------------------------------------------------ */

var FILE_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46, 0x2D]]
};
var EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

function decodeUpload_(p, allowedMimes, maxMb) {
  var mime = vStr_(p.mimeType, 'Jenis fail', { required: true, max: 60 });
  if (allowedMimes.indexOf(mime) < 0) throw AppError_('FAIL_TIDAK_SAH', 'Jenis fail tidak dibenarkan. Hanya ' + allowedMimes.map(function (m) { return EXT_BY_MIME[m].toUpperCase(); }).join(', ') + '.');
  var b64 = String(p.base64 || '');
  if (!b64 || b64.length > Math.ceil(maxMb * 1024 * 1024 * 4 / 3) + 16) throw AppError_('FAIL_TIDAK_SAH', 'Saiz fail melebihi had ' + maxMb + 'MB.');
  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { throw AppError_('FAIL_TIDAK_SAH', 'Kandungan fail rosak.'); }
  if (!bytes.length || bytes.length > maxMb * 1024 * 1024) throw AppError_('FAIL_TIDAK_SAH', 'Saiz fail melebihi had ' + maxMb + 'MB.');
  var sigOk = FILE_SIGNATURES[mime].some(function (sig) {
    return sig.every(function (b, i) { var v = bytes[i] < 0 ? bytes[i] + 256 : bytes[i]; return v === b; });
  });
  if (!sigOk) throw AppError_('FAIL_TIDAK_SAH', 'Kandungan fail tidak sepadan dengan jenisnya.');
  var base = vStr_(p.fileName, 'Nama fail', { max: 120 }).replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9 _\-()]/g, '').trim() || 'lampiran';
  var name = base.slice(0, 80) + '.' + EXT_BY_MIME[mime];
  return { blob: Utilities.newBlob(bytes, mime, name), mime: mime, name: name, size: bytes.length };
}


// ===== Auth.gs =====
/**
 * e-DISIPLIN MURID 2026
 * Auth.gs — identiti Google, pendaftaran, sesi aplikasi, peranan & pengurusan pengguna.
 *
 * Model keselamatan:
 *  - Pengguna log masuk dengan "Sign in with Google" di laman aplikasi. Pelayar
 *    menghantar ID token Google (JWT); pelayan mengesahkannya dengan Google
 *    (tandatangan, audience = GOOGLE_CLIENT_ID, issuer, tamat tempoh, e-mel disahkan).
 *  - E-mel pengguna diambil daripada token yang disahkan, BUKAN daripada data borang.
 *  - Tiada kata laluan disimpan. Kata laluan, 2FA dan pemulihan akaun diurus Google.
 *  - Selepas log masuk, token sesi aplikasi rawak (CacheService) digunakan untuk setiap
 *    permintaan, dengan tamat tempoh tidak aktif.
 *  - Peranan & status akaun dibaca semula dari sheet USERS pada SETIAP permintaan.
 */

var SESSION_MAX_HOURS = 10;
var GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Sahkan ID token Google melalui endpoint rasmi tokeninfo.
 * @return {{email:string, sub:string}}
 */
function verifyIdToken_(idToken) {
  var clientId = prop_('GOOGLE_CLIENT_ID');
  if (!clientId) throw AppError_('TIADA_KONFIG', 'Sistem belum dikonfigurasi: GOOGLE_CLIENT_ID belum ditetapkan dalam Script Properties.');
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4096 || !/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(idToken)) {
    throw AppError_('TIADA_IDENTITI', 'Sila log masuk dengan akaun Google anda.');
  }
  var cache = CacheService.getScriptCache();
  var key = 'IDT_' + sha256_(idToken).slice(0, 48);
  var cached = cache.get(key);
  var info;
  if (cached) {
    info = JSON.parse(cached);
  } else {
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw AppError_('TIADA_IDENTITI', 'Log masuk Google tidak sah atau telah tamat. Sila log masuk semula.');
    info = JSON.parse(res.getContentText());
  }
  var nowSec = Math.floor(Date.now() / 1000);
  if (info.aud !== clientId || GOOGLE_ISSUERS.indexOf(info.iss) < 0 || String(info.email_verified) !== 'true' || !info.email || Number(info.exp) <= nowSec) {
    throw AppError_('TIADA_IDENTITI', 'Log masuk Google tidak sah atau telah tamat. Sila log masuk semula.');
  }
  if (!cached) {
    var keep = { aud: info.aud, iss: info.iss, email: info.email, email_verified: String(info.email_verified), sub: info.sub, exp: info.exp };
    cache.put(key, JSON.stringify(keep), Math.max(30, Math.min(600, Number(info.exp) - nowSec)));
  }
  return { email: String(info.email).trim().toLowerCase(), sub: String(info.sub || '') };
}

function checkDomain_(email) {
  var allowed = (prop_('ALLOWED_DOMAINS') || '').toLowerCase().split(',').map(function (d) { return d.trim(); }).filter(String);
  if (allowed.length && allowed.indexOf(email.split('@')[1]) < 0) {
    throw AppError_('DOMAIN_DITOLAK', 'Akaun ' + email + ' bukan daripada domain yang dibenarkan untuk sistem ini.');
  }
}

/** Identiti daripada ID token Google yang disahkan. */
function identity_(idToken) {
  var id = verifyIdToken_(idToken);
  checkDomain_(id.email);
  return id;
}

function findUserByEmail_(email) {
  email = String(email || '').toLowerCase();
  var rows = all_('USERS');
  for (var i = 0; i < rows.length; i++) if (rows[i].Email.toLowerCase() === email) return rows[i];
  return null;
}

function findUserById_(id) { return findOne_('USERS', 'UserID', id); }

function publicUser_(u) {
  return {
    userId: u.UserID, nama: u.NamaPenuh, idGuru: u.IDGuru, email: u.Email, telefon: u.Telefon,
    sekolah: u.Sekolah, jawatan: u.Jawatan, role: u.Role, roleLabel: ROLE_LABEL[u.Role] || '',
    status: u.StatusAkaun, tarikhDaftar: u.TarikhDaftar, lastLogin: u.LastLogin
  };
}

function isPriv_(ctx) { return PRIV_ROLES.indexOf(ctx.role) >= 0; }

function activeUsersByRole_(roles) {
  return all_('USERS').filter(function (u) { return u.StatusAkaun === ACCOUNT.AKTIF && roles.indexOf(u.Role) >= 0; });
}

/* ------------------------------------------------------------------ */
/* Boot & sesi                                                         */
/* ------------------------------------------------------------------ */

/** Memerlukan ID token Google (bukan token sesi). Memberitahu pelayar status akaun. */
function getBootInfo(idToken) {
  return respond_(function () {
    var email;
    try { email = identity_(idToken).email; } catch (e) {
      if (e.isApp) return { state: e.code, message: e.message };
      throw e;
    }
    var school = '';
    try { school = getSetting_('NAMA_SEKOLAH'); } catch (e) {
      if (e.isApp && e.code === 'TIADA_DB') return { state: 'TIADA_DB', message: e.message, email: email };
      throw e;
    }
    var u = findUserByEmail_(email);
    if (!u) return { state: 'BELUM_DAFTAR', email: email, sekolah: school, jawatan: JAWATAN_LIST };
    return { state: u.StatusAkaun, email: email, nama: u.NamaPenuh, sekolah: school };
  });
}

/** "LOG MASUK": tukar ID token Google yang sah kepada sesi aplikasi. */
function startSession(idToken) {
  return respond_(function () {
    var email = identity_(idToken).email;
    var u = findUserByEmail_(email);
    if (!u) throw AppError_('BELUM_DAFTAR', 'Akaun anda belum didaftarkan. Sila daftar dahulu.');
    if (u.StatusAkaun === ACCOUNT.MENUNGGU) throw AppError_('MENUNGGU_KELULUSAN', 'Akaun anda masih menunggu kelulusan Admin.');
    if (u.StatusAkaun !== ACCOUNT.AKTIF || ROLE_LIST.indexOf(u.Role) < 0) {
      writeAuditLog_({ userId: u.UserID, email: email }, 'LOG_MASUK', '', 'DITOLAK', 'Status ' + u.StatusAkaun);
      throw AppError_('AKAUN_TIDAK_AKTIF', 'Akaun anda tidak aktif. Sila hubungi Admin sekolah.');
    }
    var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    var timeout = timeoutMin_();
    var sess = { email: email, userId: u.UserID, created: Date.now() };
    CacheService.getScriptCache().put('S_' + token, JSON.stringify(sess), Math.min(timeout * 60, 21600));
    withLock_(function () { update_('USERS', u._row, { LastLogin: nowIso_() }); });
    writeAuditLog_({ userId: u.UserID, email: email }, 'LOG_MASUK', '', 'BERJAYA', '');
    return { token: token, user: publicUser_(u), settings: publicSettings_(), timeoutMin: timeout };
  });
}

/** Dipanggil oleh secured_() untuk setiap permintaan. */
function requireSession_(token) {
  if (!token || typeof token !== 'string' || token.length < 30 || token.length > 120 || !/^[A-Za-z0-9\-]+$/.test(token)) {
    throw AppError_('SESI_TAMAT', 'Sesi tidak sah. Sila log masuk semula.');
  }
  var cache = CacheService.getScriptCache();
  var key = 'S_' + token;
  var raw = cache.get(key);
  if (!raw) throw AppError_('SESI_TAMAT', 'Sesi anda telah tamat. Sila log masuk semula.');
  var s = JSON.parse(raw);
  var email = s.email;
  if (Date.now() - s.created > SESSION_MAX_HOURS * 3600 * 1000) {
    cache.remove(key);
    throw AppError_('SESI_TAMAT', 'Sesi anda telah tamat. Sila log masuk semula.');
  }
  var u = findUserByEmail_(email);
  if (!u || u.UserID !== s.userId || u.StatusAkaun !== ACCOUNT.AKTIF || ROLE_LIST.indexOf(u.Role) < 0) {
    cache.remove(key);
    throw AppError_('AKAUN_TIDAK_AKTIF', 'Akaun anda tidak lagi aktif. Sila hubungi Admin.');
  }
  cache.put(key, raw, Math.min(timeoutMin_() * 60, 21600)); // lanjutkan tempoh tidak aktif
  return {
    token: token, email: email, userId: u.UserID, role: u.Role, nama: u.NamaPenuh,
    idGuru: u.IDGuru, jawatan: u.Jawatan, user: u
  };
}

/** LOG KELUAR: tamatkan sesi di pelayan. */
function logout(token) {
  return respond_(function () {
    if (!token || typeof token !== 'string') return { loggedOut: true };
    var cache = CacheService.getScriptCache();
    var raw = cache.get('S_' + token);
    cache.remove('S_' + token);
    if (raw) {
      var s = JSON.parse(raw);
      writeAuditLog_({ userId: s.userId, email: s.email }, 'LOG_KELUAR', '', 'BERJAYA', '');
    }
    return { loggedOut: true };
  });
}

function getCurrentUser(token) {
  return secured_(token, null, function (ctx) { return publicUser_(ctx.user); });
}

function getUserRole(token) {
  return secured_(token, null, function (ctx) { return { role: ctx.role, roleLabel: ROLE_LABEL[ctx.role] }; });
}

/* ------------------------------------------------------------------ */
/* Pendaftaran                                                         */
/* ------------------------------------------------------------------ */

/**
 * DAFTAR AKAUN. E-mel diambil daripada ID token Google yang disahkan, bukan input borang.
 * Peranan TIDAK ditetapkan di sini — hanya Admin boleh menetapkannya.
 */
function registerUser(idToken, payload) {
  return respond_(function () {
    var id = identity_(idToken);
    var email = id.email;
    var p = obj_(payload);
    var rec = {
      NamaPenuh: vStr_(p.nama, 'Nama penuh', { required: true, min: 3, max: 120 }),
      IDGuru: vStr_(p.idGuru, 'ID Guru', { required: true, max: 30, pattern: /^[A-Za-z0-9\-\/]+$/ }).toUpperCase(),
      Telefon: vStr_(p.telefon, 'Nombor telefon', { max: 20, pattern: /^\+?[0-9\- ]{8,20}$/ }),
      Sekolah: vStr_(p.sekolah, 'Nama sekolah', { required: true, max: 150 }),
      Jawatan: vStr_(p.jawatan, 'Jawatan', { required: true, oneOf: JAWATAN_LIST })
    };
    return withLock_(function () {
      if (findUserByEmail_(email)) throw AppError_('SUDAH_DAFTAR', 'Akaun Google ini sudah didaftarkan.');
      var dupId = all_('USERS').some(function (u) { return u.IDGuru.toUpperCase() === rec.IDGuru; });
      if (dupId) throw AppError_('ID_BERULANG', 'ID Guru ini telah digunakan. Sila semak atau hubungi Admin.');
      rec.UserID = shortId_('USR');
      rec.Email = email;
      rec.Role = '';
      rec.AuthProviderID = 'GOOGLE:' + id.sub;
      rec.StatusAkaun = ACCOUNT.MENUNGGU;
      rec.TarikhDaftar = nowIso_();
      insert_('USERS', rec);
      notify_(activeUsersByRole_([ROLES.ADMIN]).map(function (a) { return a.UserID; }), '',
        'Pendaftaran baharu menunggu kelulusan: ' + rec.NamaPenuh + ' (' + rec.Jawatan + ')');
      writeAuditLog_({ userId: rec.UserID, email: email }, 'DAFTAR_AKAUN', '', 'BERJAYA', 'Jawatan dimohon: ' + rec.Jawatan);
      return { state: ACCOUNT.MENUNGGU, email: email };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Profil sendiri                                                      */
/* ------------------------------------------------------------------ */

function updateMyProfile(token, payload) {
  return secured_(token, null, function (ctx) {
    var p = obj_(payload);
    var patch = {
      NamaPenuh: vStr_(p.nama, 'Nama penuh', { required: true, min: 3, max: 120 }),
      Telefon: vStr_(p.telefon, 'Nombor telefon', { max: 20, pattern: /^\+?[0-9\- ]{8,20}$/ })
    };
    if (ctx.role === ROLES.ADMIN && p.idGuru) {
      patch.IDGuru = vStr_(p.idGuru, 'ID Guru', { max: 30, pattern: /^[A-Za-z0-9\-\/]+$/ }).toUpperCase();
    }
    return withLock_(function () {
      var u = update_('USERS', ctx.user._row, patch);
      writeAuditLog_(ctx, 'KEMASKINI_PROFIL', '', 'BERJAYA', '');
      return publicUser_(u);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Pengurusan pengguna (Admin)                                         */
/* ------------------------------------------------------------------ */

function listUsers(token) {
  return secured_(token, [ROLES.ADMIN], function () {
    return all_('USERS').map(publicUser_).sort(function (a, b) { return cmp_(b.tarikhDaftar, a.tarikhDaftar); });
  });
}

function approveUser(token, payload) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var p = obj_(payload);
    var role = vStr_(p.role, 'Peranan', { required: true, oneOf: ROLE_LIST });
    return withLock_(function () {
      var u = findUserById_(vStr_(p.userId, 'Pengguna', { required: true, max: 40 }));
      if (!u) throw AppError_('TIDAK_DIJUMPAI', 'Pengguna tidak dijumpai.');
      if (u.StatusAkaun !== ACCOUNT.MENUNGGU && u.StatusAkaun !== ACCOUNT.DITOLAK) {
        throw AppError_('STATUS_TIDAK_SAH', 'Akaun ini tidak menunggu kelulusan.');
      }
      var out = update_('USERS', u._row, { Role: role, StatusAkaun: ACCOUNT.AKTIF, DiluluskanOleh: ctx.userId, TarikhLulus: nowIso_() });
      notify_([u.UserID], '', 'Akaun anda telah diluluskan sebagai ' + ROLE_LABEL[role] + '.');
      writeAuditLog_(ctx, 'LULUS_AKAUN', '', 'BERJAYA', u.Email + ' -> ' + role);
      return publicUser_(out);
    });
  });
}

function rejectUser(token, payload) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var p = obj_(payload);
    return withLock_(function () {
      var u = findUserById_(vStr_(p.userId, 'Pengguna', { required: true, max: 40 }));
      if (!u) throw AppError_('TIDAK_DIJUMPAI', 'Pengguna tidak dijumpai.');
      if (u.StatusAkaun !== ACCOUNT.MENUNGGU) throw AppError_('STATUS_TIDAK_SAH', 'Hanya pendaftaran yang menunggu kelulusan boleh ditolak.');
      var out = update_('USERS', u._row, { StatusAkaun: ACCOUNT.DITOLAK, DiluluskanOleh: ctx.userId, TarikhLulus: nowIso_() });
      writeAuditLog_(ctx, 'TOLAK_AKAUN', '', 'BERJAYA', u.Email);
      return publicUser_(out);
    });
  });
}

function updateUserRole(token, payload) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var p = obj_(payload);
    var role = vStr_(p.role, 'Peranan', { required: true, oneOf: ROLE_LIST });
    return withLock_(function () {
      var u = findUserById_(vStr_(p.userId, 'Pengguna', { required: true, max: 40 }));
      if (!u) throw AppError_('TIDAK_DIJUMPAI', 'Pengguna tidak dijumpai.');
      if (u.StatusAkaun !== ACCOUNT.AKTIF) throw AppError_('STATUS_TIDAK_SAH', 'Hanya akaun aktif boleh ditukar peranan.');
      if (u.Role === ROLES.ADMIN && role !== ROLES.ADMIN) assertNotLastAdmin_(u);
      var out = update_('USERS', u._row, { Role: role });
      notify_([u.UserID], '', 'Peranan anda dikemas kini kepada ' + ROLE_LABEL[role] + '.');
      writeAuditLog_(ctx, 'TUKAR_PERANAN', '', 'BERJAYA', u.Email + ': ' + u.Role + ' -> ' + role);
      return publicUser_(out);
    });
  });
}

function setUserStatus(token, payload) {
  return secured_(token, [ROLES.ADMIN], function (ctx) {
    var p = obj_(payload);
    var status = vStr_(p.status, 'Status', { required: true, oneOf: [ACCOUNT.AKTIF, ACCOUNT.NYAHAKTIF] });
    return withLock_(function () {
      var u = findUserById_(vStr_(p.userId, 'Pengguna', { required: true, max: 40 }));
      if (!u) throw AppError_('TIDAK_DIJUMPAI', 'Pengguna tidak dijumpai.');
      if (u.UserID === ctx.userId && status !== ACCOUNT.AKTIF) throw AppError_('TIDAK_DIBENARKAN', 'Anda tidak boleh menyahaktifkan akaun sendiri.');
      if (status === ACCOUNT.AKTIF && ROLE_LIST.indexOf(u.Role) < 0) throw AppError_('STATUS_TIDAK_SAH', 'Akaun ini belum mempunyai peranan. Gunakan fungsi Luluskan.');
      if (status === ACCOUNT.NYAHAKTIF && u.Role === ROLES.ADMIN) assertNotLastAdmin_(u);
      var out = update_('USERS', u._row, { StatusAkaun: status });
      writeAuditLog_(ctx, status === ACCOUNT.AKTIF ? 'AKTIFKAN_AKAUN' : 'NYAHAKTIF_AKAUN', '', 'BERJAYA', u.Email);
      return publicUser_(out);
    });
  });
}

function assertNotLastAdmin_(u) {
  var admins = activeUsersByRole_([ROLES.ADMIN]).filter(function (a) { return a.UserID !== u.UserID; });
  if (!admins.length) throw AppError_('TIDAK_DIBENARKAN', 'Sistem mesti mempunyai sekurang-kurangnya seorang Admin aktif.');
}


// ===== Reports.gs =====
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


// ===== Dashboard.gs =====
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
      .slice(0, 8).map(function (r) { var s = summaryRow_(r); s.mine = true; if (!isPriv_(ctx)) s.tahap = ''; return s; });

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


// ===== Audit.gs =====
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
