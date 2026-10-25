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
