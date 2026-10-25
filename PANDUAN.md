# e-DISIPLIN MURID 2026 — Panduan Pemasangan, Deploy & Keselamatan

Dokumen ini untuk Admin / pentadbir ICT sekolah. Panduan pengguna akhir ada dalam `github-pages/panduan.html`.

---

## 0. Seni bina (baca dahulu)

```
 Pengguna (telefon / komputer)
        │  1. buka landing page
        ▼
 GitHub Pages  (index.html, panduan.html, config.js)   ← tiada data, tiada rahsia
        │  2. butang LOG MASUK / DAFTAR → URL Web App
        ▼
 Google Apps Script Web App (HtmlService)              ← UI aplikasi + backend
   • Identiti: akaun Google sekolah (Session.getActiveUser)
   • Sesi aplikasi: token rawak dalam CacheService, tamat bila tidak aktif
   • RBAC disemak di pelayan pada SETIAP panggilan
        │
        ├── Google Sheets  (database: USERS, REPORTS, ACTIONS, …)
        └── Google Drive   (lampiran bukti, logo, sandaran — semua peribadi)
```

**Perbezaan daripada master prompt asal (disengajakan):**

| Spec asal | Pelaksanaan | Sebab |
|---|---|---|
| Frontend penuh di GitHub Pages memanggil Apps Script | GitHub Pages = landing page sahaja. UI aplikasi dihidang oleh Apps Script `HtmlService` | Apps Script tiada sokongan CORS preflight. Apabila Web App "Execute as me" dipanggil dari domain luar, pelayan tidak dapat mengenal pasti pengguna. HtmlService membolehkan identiti Google disahkan dengan selamat tanpa API gateway |
| Kata laluan sendiri, "lupa kata laluan" | Log masuk dengan akaun Google sekolah (DELIMa / Workspace). Tiada kata laluan disimpan | Spreadsheet bukan tempat selamat untuk hash kata laluan, had cubaan log masuk dan pemulihan akaun. Google sudah menyediakan semua itu (termasuk 2FA) |
| Fail `login.html`, `dashboard.html` dll. | Satu aplikasi halaman tunggal: `Index.html` + `JsCore/JsViews/JsReport/JsAdmin/JsPdf.html` | Format fail yang disokong HtmlService |
| — | Sheet tambahan `STATUS_HISTORY`, kolum tambahan di beberapa sheet, audit log berantai hash | Sejarah status, tindakan dan pengesahan yang boleh diaudit |

---

## 1. Prasyarat — PENTING

1. **Akaun Google Workspace sekolah** (contoh DELIMa `@moe-dl.edu.my`) untuk menjadi **pemilik skrip**. Semua pengguna mesti berada dalam **domain yang sama** dengan pemilik.
   - Dengan "Execute as: Me", Google hanya mendedahkan e-mel pengguna kepada skrip jika pengguna berada dalam domain Workspace yang sama dengan pemilik.
   - Jika skrip dimiliki akaun **Gmail peribadi**, hanya pemilik sahaja boleh menggunakan sistem. Pengguna lain akan melihat "Akaun tidak dikenali".
   - Jika sekolah tidak mempunyai akaun Workspace sendiri, minta pentadbir DELIMa sekolah atau PPD untuk menjadi/menyediakan akaun pemilik.
2. Akaun GitHub (untuk landing page).
3. Pelayar moden (Chrome, Edge, Safari, Firefox).

> Gunakan akaun **khusus sistem** (contoh `edisiplin@sekolah…`) sebagai pemilik jika boleh, bukan akaun peribadi guru, supaya sistem tidak terjejas apabila guru bertukar sekolah.

---

## 2. Menyediakan Google Sheets & Apps Script

### 2.1 Cipta projek
1. Log masuk ke **script.google.com** dengan akaun pemilik → **New project**. Namakan `e-DISIPLIN MURID 2026`.
2. **Project Settings** (ikon gear) → tandakan **Show "appsscript.json" manifest file in editor**.
3. Tetapkan **Time zone**: `(GMT+08:00) Kuala Lumpur`.

### 2.2 Salin fail
Dalam editor, cipta fail berikut dan tampal kandungan daripada folder `apps-script/` (nama mesti sama, tanpa sambungan):

| Jenis | Fail |
|---|---|
| Script (`+` → Script) | `Code`, `Database`, `Auth`, `Reports`, `Dashboard`, `Audit` |
| HTML (`+` → HTML) | `Index`, `Styles`, `JsCore`, `JsViews`, `JsReport`, `JsAdmin`, `JsPdf` |
| Manifest | Ganti kandungan `appsscript.json` |

Padam fail `Code.gs` lalai dahulu jika anda mencipta `Code` baharu, atau tampal terus ke dalamnya.

> Alternatif untuk pengguna teknikal: guna [clasp](https://github.com/google/clasp) — `clasp create --type standalone`, salin folder `apps-script/`, `clasp push`.

### 2.3 Jalankan `setupDatabase()`
1. Pilih fail `Database`, pilih fungsi **setupDatabase** di bar atas → **Run**.
2. Benarkan kebenaran (Sheets, Drive, e-mel, trigger). Jika muncul amaran "Google hasn't verified this app", klik **Advanced → Go to e-DISIPLIN** (ini skrip anda sendiri).
3. Lihat **Execution log**. Fungsi ini akan:
   - mencipta spreadsheet `e-DISIPLIN MURID 2026 — DATABASE` (atau guna `SPREADSHEET_ID` sedia ada dalam Script Properties),
   - mencipta 10 sheet dengan tajuk kolum, format teks, dan melindungi `AUDIT_LOG` & `STATUS_HISTORY`,
   - mencipta folder Drive peribadi `e-DISIPLIN 2026 (SULIT)` → `Lampiran Bukti`, `Sandaran`, `Aset Sekolah`,
   - mengisi tetapan lalai (kategori kesalahan, jenis tindakan, tempat),
   - menjadikan **akaun pemilik sebagai Admin pertama**.
4. Selamat dijalankan semula — ia hanya menambah apa yang tiada, tidak memadam data.

### 2.4 Script Properties (Project Settings → Script Properties)

| Property | Nilai | Wajib |
|---|---|---|
| `SPREADSHEET_ID` | Diisi automatik oleh `setupDatabase()` | Auto |
| `ATTACHMENT_FOLDER_ID`, `BACKUP_FOLDER_ID`, `ASSET_FOLDER_ID`, `ROOT_FOLDER_ID` | Auto | Auto |
| `ALLOWED_DOMAINS` | Contoh `moe-dl.edu.my` (boleh lebih satu, dipisah koma) | **Disyorkan** |
| `AUDIT_LAST_HASH`, `SEQ_REPORT_2026`, `LAST_BACKUP_AT` | Diurus sistem — **jangan ubah** | Auto |

### 2.5 Sandaran automatik
Jalankan fungsi **installBackupTrigger** sekali dari editor. Sandaran penuh spreadsheet dibuat setiap hari sekitar jam 2 pagi ke folder `Sandaran` (30 terkini disimpan).

### 2.6 Jangan kongsi spreadsheet / folder
Pengguna **tidak perlu** akses terus kepada spreadsheet atau folder Drive. Skrip membaca/menulis sebagai pemilik. Jika spreadsheet dikongsi, sesiapa yang ada akses boleh membaca semua data murid tanpa melalui RBAC.

---

## 3. Deploy Google Apps Script sebagai Web App

1. **Deploy → New deployment** → ikon gear → **Web app**.
2. Tetapan:
   - **Description**: `v1.0.0`
   - **Execute as**: **Me (akaun pemilik)**
   - **Who has access**: **Anyone within [domain sekolah]** (contoh *Anyone within moe-dl.edu.my*)
3. **Deploy** → salin **Web app URL** (berakhir dengan `/exec`).
4. Buka URL tersebut. Anda (Admin) sepatutnya melihat skrin **Log Masuk**.
5. Pergi ke **Tetapan → Profil saya** dan kemas kini nama sebenar serta ID Guru Admin. Kemudian **Tetapan → Sekolah**: nama, alamat dan logo sekolah.

### Mengemas kini kod kemudian
**Deploy → Manage deployments** → pilih deployment → ✏️ **Edit** → **Version: New version** → **Deploy**. URL kekal sama. (Jangan cipta "New deployment" baharu — URL akan bertukar.)

---

## 4. Menghubungkan landing page (frontend) dengan backend

1. Buka `github-pages/config.js`.
2. Tampal URL Web App:
   ```js
   window.EDISIPLIN_CONFIG = {
     APP_URL: 'https://script.google.com/a/macros/moe-dl.edu.my/s/AKfycb.../exec',
     NAMA_SEKOLAH: 'SMK Taman Contoh'
   };
   ```
3. Butang **LOG MASUK** membuka `APP_URL?view=login`, **DAFTAR AKAUN** membuka `APP_URL?view=register`.

URL Web App bukan rahsia. Ia hanya pintu masuk — akses sebenar dikawal oleh akaun Google domain sekolah + kelulusan Admin + RBAC di pelayan.

---

## 5. Menerbitkan landing page melalui GitHub Pages

1. Di GitHub: **New repository** → contoh `e-disiplin-2026` → Public (Pages percuma) → Create.
2. **Add file → Upload files** → muat naik **kandungan** folder `github-pages/` (`index.html`, `panduan.html`, `config.js`, `robots.txt`) ke akar repo → Commit.
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `/ (root)` → Save.
4. Tunggu 1–2 minit. Laman tersedia di `https://<username>.github.io/e-disiplin-2026/`. Tandakan **Enforce HTTPS**.
5. Jangan sekali-kali memuat naik folder `apps-script/` yang telah diubah suai dengan ID sebenar, fail CSV murid, sandaran, atau tangkapan layar yang mengandungi data murid ke repo ini.

---

## 6. Menguji akses setiap peranan

Gunakan sekurang-kurangnya 5 akaun ujian dalam domain sekolah. Buka setiap akaun dalam profil pelayar / tetingkap inkognito berasingan.

### 6.1 Persediaan
1. Daftar 4 akaun guru melalui **DAFTAR AKAUN**.
2. Sebagai Admin: **Pengurusan Pengguna** → luluskan sebagai Guru Biasa (2 akaun), Guru Disiplin, PK HEM, Pengetua.

### 6.2 Senarai semak

| # | Ujian | Dijangka |
|---|---|---|
| 1 | Akaun baharu cuba log masuk sebelum diluluskan | Skrin "Menunggu kelulusan Admin" |
| 2 | Guru A buat laporan, Simpan Draf, muat naik gambar & PDF | ID `DIS-2026-xxxxx` dijana, lampiran tersenarai |
| 3 | Guru A muat naik fail `.exe` yang dinamakan `.pdf` | Ditolak: kandungan tidak sepadan |
| 4 | Guru Disiplin cari draf Guru A | Tidak kelihatan (draf peribadi) |
| 5 | Guru A **Hantar Laporan** | Status Dihantar, Guru Disiplin dapat notifikasi. Tahap Berat → PK HEM & Pengetua turut dapat notifikasi |
| 6 | Guru B buka Senarai Laporan | Hanya laporan sendiri. Menu Statistik / Tindakan / Pengguna tiada |
| 7 | Guru A cuba sunting laporan yang sudah dihantar | Butang tiada; pelayan juga menolak |
| 8 | Guru Disiplin: Terima untuk semakan → Pulangkan (dengan sebab) | Guru A nampak sebab, boleh betulkan & hantar semula |
| 9 | Guru Disiplin cuba Tandakan Selesai tanpa tindakan | Ditolak |
| 10 | Guru Disiplin: Rekod tindakan → Pengesahan | Status Dalam Tindakan, pengesahan GD direkod |
| 11 | PK HEM: Ulasan + Sahkan. Pengetua: Sahkan | Kotak pengesahan PDF menunjukkan nama & tarikh sebenar |
| 12 | Tandakan Selesai, kemudian PK HEM buka semula (dengan sebab) | Sejarah status mencatat kedua-dua perubahan |
| 13 | Guru A buka laporan yang sama | Nampak jenis tindakan & status; catatan siasatan & ulasan dalaman tidak dipaparkan |
| 14 | Muat turun PDF sebagai Guru A dan Guru Disiplin | Kandungan berbeza ikut peranan; `EKSPORT_PDF` dalam audit log |
| 15 | Admin nyahaktifkan Guru B semasa Guru B sedang log masuk | Panggilan seterusnya Guru B ditolak serta-merta |
| 16 | Admin cuba nyahaktif diri sendiri / tukar admin terakhir kepada Guru | Ditolak |
| 17 | Biarkan sesi tidak aktif melebihi tempoh | Dilog keluar automatik |
| 18 | Log keluar, tekan butang Back pelayar | Tiada data dipaparkan; perlu log masuk semula |
| 19 | Admin: Tetapan → Audit log → Semak keutuhan | "Semua rekod audit utuh" |
| 20 | Buka URL dengan akaun Gmail peribadi | "Akaun tidak dikenali" / ditolak domain |

### 6.3 Ujian automatik yang telah dijalankan
Kod ini telah diuji dalam simulasi Apps Script (Node.js) sebelum diserahkan:
- **242 semakan backend**: pendaftaran, kelulusan, sesi & tamat masa, semua peralihan status, RBAC setiap fungsi, pengesahan input, fail palsu, suntikan formula, audit log & pengesanan pengubahan, sandaran, eksport, notifikasi. Setiap fungsi awam disahkan menolak panggilan tanpa sesi sah.
- **Ujian UI hujung-ke-hujung** (jsdom): daftar → lulus → buat laporan + lampiran → hantar → proses GD → selesai → PDF → log keluar → tamat sesi automatik, termasuk semakan XSS.

Simulasi bukan Google sebenar. **Jalankan senarai semak 6.2 di persekitaran sebenar dengan data ujian sebelum memasukkan data murid sebenar.**

---

## 7. Keselamatan & privasi

### 7.1 Kawalan yang dilaksanakan
- **Identiti** daripada akaun Google, bukan input pelayar. `role`, `userId` dan `email` yang dihantar dari pelayar diabaikan.
- **RBAC di pelayan**: setiap fungsi awam melalui `secured_()` yang mengesahkan token sesi, padanan e-mel Google, status akaun AKTIF dan peranan — dibaca semula dari sheet pada setiap panggilan.
- **Sesi**: token rawak 68 aksara dalam CacheService, disimpan dalam memori pelayar sahaja (tiada localStorage). Tamat bila tidak aktif (lalai 30 min) dan maksimum 10 jam. Token yang digunakan oleh akaun lain dibatalkan.
- **Draf peribadi**: draf hanya kelihatan kepada pelapor.
- **Pengasingan data guru biasa**: catatan siasatan dan ulasan dalaman ditapis di pelayan, termasuk dalam data PDF.
- **Lampiran**: hanya JPG/PNG/PDF, maks 5MB, semakan *magic bytes* di pelayan, nama fail disanitasi, disimpan dalam folder Drive peribadi pemilik, dihantar sebagai base64 kepada pengguna yang dibenarkan sahaja. Tiada pautan perkongsian.
- **Suntikan formula / CSV**: nilai bermula `= + - @` disimpan sebagai teks.
- **XSS**: semua data dipaparkan melalui `esc()`.
- **Audit log berantai SHA-256**: setiap entri bergantung pada hash entri sebelumnya. Sebarang suntingan atau pemadaman manual pada sheet dikesan oleh **Semak keutuhan audit log**. Sheet juga dilindungi.
- **Tiada padam kekal**: laporan dihantar tidak boleh dipadam. Draf dipadam secara lembut (`IsDeleted = Y`).
- **Kunci** (`LockService`) untuk semua penulisan & penjanaan ID.
- **Sandaran** harian + manual.

### 7.2 Tanggungjawab sekolah
- Jangan kongsi spreadsheet atau folder Drive sistem.
- Aktifkan 2-Step Verification untuk akaun pemilik dan Admin.
- Semak **Pengurusan Pengguna** setiap awal penggal: nyahaktif guru yang bertukar.
- Tetapkan **Dasar penyimpanan** (Tetapan → Sekolah) mengikut arahan sekolah dan KPM. Sistem tidak memadam rekod secara automatik; arkib/padam rekod lama dibuat secara manual oleh pemilik mengikut dasar tersebut.
- Fail CSV eksport dan PDF mengandungi maklumat SULIT — simpan dengan selamat.

### 7.3 Pemulihan data
1. **Sheet tersilap diubah**: buka spreadsheet → **File → Version history** → pulihkan versi.
2. **Pulih daripada sandaran**: buka folder `Sandaran` → pilih salinan → salin sheet yang diperlukan ke spreadsheet utama, **atau** tukar `SPREADSHEET_ID` dalam Script Properties kepada ID salinan sandaran (rekod selepas tarikh sandaran akan hilang).
3. Selepas memulihkan `AUDIT_LOG`, semakan keutuhan mungkin gagal kerana `AUDIT_LAST_HASH` merujuk entri yang lebih baharu — catat kejadian ini dan kemas kini property itu kepada `Hash` baris terakhir.

---

## 8. Penyelesaian masalah

| Masalah | Punca & penyelesaian |
|---|---|
| "Akaun tidak dikenali" untuk semua pengguna kecuali pemilik | Pemilik skrip ialah akaun Gmail peribadi atau domain berbeza. Pindahkan skrip kepada akaun Workspace dalam domain yang sama (lihat §1) |
| "Akaun tidak dikenali" untuk sesetengah pengguna | Pengguna log masuk ke beberapa akaun Google; akaun lalai bukan akaun sekolah. Guna tetingkap inkognito dengan akaun sekolah sahaja |
| "Sistem belum disediakan" | `setupDatabase()` belum dijalankan / `SPREADSHEET_ID` salah |
| "Bukan daripada domain yang dibenarkan" | Semak `ALLOWED_DOMAINS` |
| Halaman kosong / ikon tidak keluar | Rangkaian sekolah menyekat `cdn.jsdelivr.net`, `cdn.tailwindcss.com` atau `fonts.googleapis.com`. Minta pentadbir rangkaian membenarkannya |
| Pengguna kerap dilog keluar | Naikkan tempoh di Tetapan → Sekolah (5–240 minit) |
| PDF tidak dimuat turun | Klik "Buka di tab baharu" pada makluman, atau benarkan pop-up |
| "Sistem sedang sibuk" | Terlalu ramai menulis serentak. Cuba semula selepas beberapa saat |
| Ralat selepas kemas kini kod | Pastikan anda membuat **New version** dalam deployment sedia ada; jalankan `diagnose()` dan semak Executions |
| Lampiran gagal | Fail > 5MB, bukan JPG/PNG/PDF, atau fail rosak |

**Fungsi diagnostik**: jalankan `diagnose()` dari editor untuk melihat identiti, property, bilangan rekod setiap sheet dan trigger.

**Log pelayan**: Apps Script editor → **Executions**.

### Had platform (dari pengetahuan umum — sahkan dengan dokumentasi Google semasa)
- Apps Script mengehadkan masa satu panggilan (~6 minit) dan bilangan pelaksanaan serentak. Untuk sekolah biasa (puluhan guru) ini mencukupi.
- Prestasi kekal baik sehingga beberapa ribu laporan. Jika `REPORTS` melebihi ~20,000 baris, pertimbangkan mengarkibkan tahun lama ke spreadsheet berasingan.

---

## 9. Struktur fail

```
e-disiplin/
├── README.md
├── PANDUAN.md                ← dokumen ini
├── apps-script/              ← tampal ke projek Apps Script
│   ├── appsscript.json
│   ├── Code.gs               doGet, pemalar, pembalut respons, kunci, utiliti
│   ├── Database.gs           SCHEMA, setupDatabase(), diagnose(), akses jadual, tetapan, murid, muat naik
│   ├── Auth.gs               identiti, daftar, sesi, log keluar, pengurusan pengguna
│   ├── Reports.gs            laporan, aliran kerja, tindakan, pengesahan, lampiran, notifikasi
│   ├── Dashboard.gs          statistik, ringkasan bulanan/tahunan, data PDF
│   ├── Audit.gs              audit log berantai hash, sandaran, eksport CSV
│   ├── Index.html            kerangka aplikasi
│   ├── Styles.html           CSS
│   ├── JsCore.html           keadaan, API, log masuk, sesi, menu
│   ├── JsViews.html          dashboard, senarai, butiran, tindakan, statistik, notifikasi, PDF
│   ├── JsReport.html         borang laporan & lampiran
│   ├── JsAdmin.html          pengurusan pengguna & tetapan
│   └── JsPdf.html            penjana PDF A4
└── github-pages/             ← muat naik ke repo GitHub Pages
    ├── index.html            landing page
    ├── panduan.html          panduan pengguna
    ├── config.js             APP_URL
    └── robots.txt
```

### Fungsi backend (dipanggil melalui `google.script.run`)
`getBootInfo`, `startSession`, `registerUser`, `logout`, `ping`, `getCurrentUser`, `getUserRole`, `updateMyProfile`, `listUsers`, `approveUser`, `rejectUser`, `updateUserRole`, `setUserStatus`, `createReport`, `saveDraft`, `updateReport`, `submitReport`, `deleteDraft`, `getMyReports`, `getAllReports`, `getReportById`, `updateReportStatus`, `setHandler`, `addDisciplineAction`, `addApproval`, `uploadEvidence`, `deleteAttachment`, `getAttachment`, `getNotifications`, `markNotificationRead`, `getDashboardStats`, `getSummaryReport`, `getReportForPdf`, `getSchoolSettings`, `updateSchoolSettings`, `uploadLogo`, `getLogo`, `searchStudents`, `importStudents`, `studentCount`, `writeAuditLog`, `getAuditLog`, `verifyAuditChain`, `backupNow`, `listBackups`, `exportReportsCsv`.

Fungsi editor sahaja (pemilik): `setupDatabase`, `diagnose`, `installBackupTrigger`. Pengendali trigger: `cronDailyBackup`.

Semua respons berbentuk `{ ok: true, data }` atau `{ ok: false, error: { code, message } }`.
