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
