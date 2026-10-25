# e-DISIPLIN MURID 2026 — Panduan Pemasangan, Deploy & Keselamatan

Dokumen ini untuk Admin / pentadbir ICT sekolah. Panduan pengguna akhir ada dalam `github-pages/panduan.html`.

---

## 0. Seni bina (baca dahulu)

```
 Pengguna (telefon / komputer)
        │  1. buka https://<akaun>.github.io/e-disiplin-2026/
        ▼
 GitHub Pages  (index.html, app.html, css/, js/, config.js)   ← UI sahaja, tiada data, tiada rahsia
        │  2. "Sign in with Google"  → ID token Google (JWT)
        │  3. fetch POST text/plain {fn, args} → URL Web App (/exec)
        ▼
 Google Apps Script Web App  (doPost JSON API)
   • Sahkan ID token dengan Google (audience = GOOGLE_CLIENT_ID, tamat tempoh, e-mel disahkan)
   • Keluarkan token sesi aplikasi (CacheService), tamat bila tidak aktif
   • RBAC disemak di pelayan pada SETIAP panggilan
        │
        ├── Google Sheets  (database: USERS, REPORTS, ACTIONS, …)
        └── Google Drive   (lampiran bukti, logo, sandaran — semua peribadi pemilik)
```

Seni bina ini membolehkan **akaun Gmail peribadi** menjadi pemilik sistem, dan guru boleh log masuk dengan **mana-mana akaun Google** (Gmail atau DELIMa). Hanya akaun yang **diluluskan Admin** boleh mengakses data.

**Perbezaan daripada master prompt asal (disengajakan):**

| Spec asal | Pelaksanaan | Sebab |
|---|---|---|
| Kata laluan sendiri, "lupa kata laluan" | "Sign in with Google" (Google Identity Services). Tiada kata laluan disimpan | Spreadsheet bukan tempat selamat untuk hash kata laluan, had cubaan log masuk dan pemulihan akaun. Google sudah menyediakan semua itu (termasuk 2FA) |
| `login.html`, `register.html`, `dashboard.html` … berasingan | Satu aplikasi halaman tunggal `app.html` + `css/style.css` + `js/core.js, views.js, report.js, admin.js, pdf.js` | Sesi kekal dalam memori; tiada token disimpan dalam localStorage |
| `js/api.js`, `js/auth.js` | Digabung dalam `js/core.js` | Lapisan sambungan dan log masuk saling bergantung |
| Fail `Code.gs` … `Audit.gs` | Sama, dengan `doPost` sebagai satu-satunya titik masuk API | Hanya fungsi dalam `apiMap_()` boleh dipanggil |
| — | Sheet tambahan `STATUS_HISTORY`, audit log berantai hash | Sejarah status dan rekod audit yang boleh disemak keutuhannya |

**Tentang CORS:** aplikasi menghantar `POST` dengan `Content-Type: text/plain` (permintaan "simple" — tiada preflight) dan membaca respons JSON yang dialihkan oleh Google ke `script.googleusercontent.com`. `mode: 'no-cors'` **tidak** digunakan.

---

## 1. Prasyarat

1. Satu akaun Google sebagai **pemilik sistem** (Gmail peribadi pun boleh). Disyorkan akaun khusus, contoh `edisiplin.smkxxx@gmail.com`, bukan akaun peribadi guru, supaya sistem tidak terjejas apabila guru bertukar sekolah. Aktifkan **2-Step Verification** pada akaun ini.
2. Akaun GitHub (untuk laman aplikasi).
3. Projek **Google Cloud** percuma (untuk OAuth Client ID — §2.5).
4. Pelayar moden (Chrome, Edge, Safari, Firefox).

---

## 2. Menyediakan Google Sheets, Apps Script & log masuk Google

### 2.1 Cipta projek Apps Script
1. Log masuk ke **script.google.com** dengan akaun pemilik → **New project**. Namakan `e-DISIPLIN MURID 2026`.
2. **Project Settings** (ikon gear) → tandakan **Show "appsscript.json" manifest file in editor**.
3. Tetapkan **Time zone**: `(GMT+08:00) Kuala Lumpur`.

### 2.2 Salin fail
Cipta fail Script berikut (`+` → Script) dan tampal kandungan daripada folder `apps-script/` (nama mesti sama):
`Code`, `Database`, `Auth`, `Reports`, `Dashboard`, `Audit`. Ganti juga kandungan `appsscript.json`.

> Alternatif: [clasp](https://github.com/google/clasp) — `clasp create --type standalone`, salin `apps-script/`, `clasp push`.

### 2.3 Jalankan `setupDatabase()`
1. Pilih fail `Database`, pilih fungsi **setupDatabase** → **Run**.
2. Benarkan kebenaran (Sheets, Drive, sambungan luar, trigger). Jika muncul "Google hasn't verified this app", klik **Advanced → Go to e-DISIPLIN** (ini skrip anda sendiri).
3. Fungsi ini akan:
   - mencipta spreadsheet `e-DISIPLIN MURID 2026 — DATABASE` dalam Drive pemilik,
   - mencipta 10 sheet dengan tajuk kolum dan melindungi `AUDIT_LOG` & `STATUS_HISTORY`,
   - mencipta folder Drive peribadi `e-DISIPLIN 2026 (SULIT)` → `Lampiran Bukti`, `Sandaran`, `Aset Sekolah`,
   - mengisi tetapan lalai (kategori kesalahan, jenis tindakan, tempat),
   - menjadikan **akaun pemilik sebagai Admin pertama**.
4. Selamat dijalankan semula — ia hanya menambah apa yang tiada.

### 2.4 Sandaran automatik
Jalankan **installBackupTrigger** sekali dari editor. Sandaran penuh dibuat setiap hari sekitar jam 2 pagi (30 terkini disimpan).

### 2.5 Cipta OAuth Client ID ("Sign in with Google")
1. Buka **console.cloud.google.com** dengan akaun pemilik → pilih/cipta projek, contoh `e-DISIPLIN 2026`.
2. **APIs & Services → OAuth consent screen** (atau *Google Auth Platform*):
   - App name: `e-DISIPLIN MURID 2026`, User support email: e-mel pemilik.
   - Audience / User type: **External**.
   - Scopes: tidak perlu tambah (log masuk hanya guna `openid`, `email`, `profile`).
   - Selepas siap, klik **Publish app** / tetapkan status **In production**. Jika kekal *Testing*, hanya akaun yang disenaraikan sebagai *test users* boleh log masuk.
3. **Credentials / Clients → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `e-DISIPLIN Web`
   - **Authorized JavaScript origins**: `https://<username-github>.github.io` (contoh `https://mkhalil1199hajaj-web.github.io` — tanpa garis miring di hujung, tanpa nama repo)
   - Authorized redirect URIs: biarkan kosong.
4. **Create** → salin **Client ID** (bentuk `123456789-xxxx.apps.googleusercontent.com`). *Client secret* tidak diperlukan dan **jangan** dimasukkan ke mana-mana fail.

### 2.6 Script Properties (Apps Script → Project Settings → Script Properties)

| Property | Nilai | Wajib |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Client ID dari §2.5 (sama dengan dalam `config.js`) | **Ya** |
| `ALLOWED_DOMAINS` | Kosong = semua akaun Google boleh mendaftar (perlu kelulusan Admin). Isi contoh `moe-dl.edu.my,gmail.com` untuk menghadkan | Pilihan |
| `SPREADSHEET_ID`, `*_FOLDER_ID` | Diisi automatik oleh `setupDatabase()` | Auto |
| `AUDIT_LAST_HASH`, `SEQ_REPORT_2026`, `LAST_BACKUP_AT` | Diurus sistem — **jangan ubah** | Auto |

### 2.7 Jangan kongsi spreadsheet / folder
Pengguna **tidak perlu** akses terus kepada spreadsheet atau folder Drive. Jika dikongsi, sesiapa yang ada akses boleh membaca semua data murid tanpa melalui kawalan peranan.

---

## 3. Deploy Google Apps Script sebagai Web App

1. **Deploy → New deployment** → ikon gear → **Web app**.
2. Tetapan:
   - **Description**: `v1.1.0`
   - **Execute as**: **Me (akaun pemilik)**
   - **Who has access**: **Anyone**
     (perlu kerana aplikasi di GitHub Pages memanggil API secara terus. Ini selamat: setiap fungsi memerlukan ID token Google yang sah atau token sesi, dan akaun mesti diluluskan Admin.)
3. **Deploy** → salin **Web app URL** (berakhir dengan `/exec`).
4. Semak: buka URL itu dalam pelayar — anda patut melihat JSON `{"ok":true,"app":"e-DISIPLIN MURID 2026",…}`.

### Mengemas kini kod kemudian
**Deploy → Manage deployments** → ✏️ **Edit** → **Version: New version** → **Deploy**. URL kekal sama. (Jangan cipta "New deployment" baharu — URL akan bertukar.)

---

## 4. Menghubungkan aplikasi (GitHub Pages) dengan backend

Edit `config.js` dalam repo GitHub:
```js
window.EDISIPLIN_CONFIG = {
  APP_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
  GOOGLE_CLIENT_ID: '123456789-xxxx.apps.googleusercontent.com',
  NAMA_SEKOLAH: 'SMK Taman Contoh'
};
```
Kedua-dua nilai **bukan rahsia** (ia sampai ke pelayar setiap pengguna). Keselamatan sebenar berada di pelayan.

Selepas `config.js` dikemas kini:
1. Buka `https://<username>.github.io/e-disiplin-2026/app.html` → **Sign in with Google** dengan akaun pemilik → **LOG MASUK**.
2. **Tetapan → Profil saya**: kemas kini nama sebenar dan ID Guru Admin.
3. **Tetapan → Sekolah**: nama, alamat dan logo sekolah.

---

## 5. Menerbitkan melalui GitHub Pages

1. Muat naik kandungan folder `github-pages/` ke akar repo (`index.html`, `app.html`, `panduan.html`, `config.js`, `css/`, `js/`, `robots.txt`, `.nojekyll`).
2. **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
3. Laman tersedia di `https://<username>.github.io/<repo>/` dalam 1–2 minit. HTTPS dikuatkuasakan secara automatik untuk `github.io`.
4. Jangan sekali-kali memuat naik fail CSV murid, sandaran, PDF laporan atau tangkapan layar yang mengandungi data murid ke repo ini — repo ini **public**.

---

## 6. Menguji akses setiap peranan

Gunakan sekurang-kurangnya 5 akaun Google ujian. Buka setiap akaun dalam profil pelayar / tetingkap inkognito berasingan.

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
| 20 | Jika `ALLOWED_DOMAINS` ditetapkan: log masuk dengan akaun di luar domain | "Akaun tidak dikenali" / ditolak domain |
| 21 | Panggil URL `/exec` secara terus dengan `{"fn":"setupDatabase"}` | Ditolak: fungsi tidak dikenali |

### 6.3 Ujian automatik yang telah dijalankan
Kod ini telah diuji dalam simulasi Apps Script (Node.js) sebelum diserahkan:
- **254 semakan backend melalui `doPost`**: pengesahan ID token Google (audience salah, tamat tempoh, e-mel belum disahkan, issuer palsu, tandatangan tidak sah), senarai putih fungsi API, pendaftaran, kelulusan, sesi & tamat masa, semua peralihan status, RBAC setiap fungsi, pengesahan input, fail palsu, suntikan formula, audit log & pengesanan pengubahan, sandaran, eksport, notifikasi. Setiap fungsi API disahkan menolak panggilan tanpa sesi sah.
- **Ujian UI hujung-ke-hujung** (jsdom, `app.html` → `fetch` → `doPost`): Sign in with Google → daftar → lulus → buat laporan + lampiran → hantar → proses GD → selesai → PDF → log keluar → tamat sesi automatik, termasuk semakan XSS.

Simulasi bukan Google sebenar — khususnya aliran CORS `fetch` ke Apps Script dan butang Google hanya boleh disahkan selepas deploy sebenar. **Jalankan senarai semak 6.2 di persekitaran sebenar dengan data ujian sebelum memasukkan data murid sebenar.**

---

## 7. Keselamatan & privasi

### 7.1 Kawalan yang dilaksanakan
- **Identiti** daripada ID token Google yang disahkan di pelayan (audience mesti `GOOGLE_CLIENT_ID`, issuer Google, belum tamat, e-mel disahkan). `role`, `userId` dan `email` dari pelayar diabaikan.
- **Satu titik masuk API**: `doPost` hanya memanggil fungsi dalam `apiMap_()`. Fungsi editor (`setupDatabase`, `diagnose`, trigger) dan fungsi dalaman tidak boleh dipanggil dari luar.
- **RBAC di pelayan**: setiap fungsi awam melalui `secured_()` yang mengesahkan token sesi, padanan e-mel Google, status akaun AKTIF dan peranan — dibaca semula dari sheet pada setiap panggilan.
- **Sesi**: token rawak 68 aksara dalam CacheService, disimpan dalam memori pelayar sahaja (tiada localStorage). ID token Google dibuang daripada memori sebaik sesi dicipta. Tamat bila tidak aktif (lalai 30 min) dan maksimum 10 jam. Status akaun disemak pada setiap panggilan, jadi akaun yang dinyahaktifkan terputus serta-merta.
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
- Jangan luluskan pendaftaran yang tidak dikenali — sesiapa yang mempunyai akaun Google boleh *mendaftar*, tetapi tiada akses sehingga diluluskan.
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
| Laman papar "Sistem belum dikonfigurasi" | `APP_URL` atau `GOOGLE_CLIENT_ID` dalam `config.js` belum diisi / format salah |
| Butang Google tidak muncul atau ralat `origin_mismatch` | Tambah `https://<username>.github.io` dalam *Authorized JavaScript origins* OAuth client (§2.5). Perubahan boleh ambil masa beberapa minit |
| "Access blocked: app is in testing" / hanya sesetengah orang boleh log masuk | Skrin persetujuan OAuth masih *Testing*. Klik **Publish app** (§2.5) |
| "Sistem belum disediakan: GOOGLE_CLIENT_ID…" | Tetapkan Script Property `GOOGLE_CLIENT_ID` (§2.6) |
| "Log masuk Google tidak sah" | Client ID dalam `config.js` dan Script Properties tidak sama, atau token tamat. Log masuk semula |
| "Sambungan ke pelayan gagal" | Deployment bukan *Who has access: Anyone*, URL salah, atau versi baharu belum di-deploy. Buka URL `/exec` terus — mesti papar JSON |
| "Sistem belum disediakan" | `setupDatabase()` belum dijalankan / `SPREADSHEET_ID` salah |
| "Bukan daripada domain yang dibenarkan" | Semak `ALLOWED_DOMAINS` |
| Halaman kosong / ikon tidak keluar | Rangkaian sekolah menyekat `cdn.jsdelivr.net`, `cdn.tailwindcss.com`, `accounts.google.com` atau `fonts.googleapis.com`. Minta pentadbir rangkaian membenarkannya |
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
e-disiplin-2026/                (repo GitHub = laman GitHub Pages)
├── index.html                  landing page
├── app.html                    aplikasi (log masuk, dashboard, laporan, admin)
├── panduan.html                panduan pengguna
├── config.js                   APP_URL + GOOGLE_CLIENT_ID
├── css/style.css
├── js/core.js                  keadaan, sambungan API, Sign in with Google, sesi, menu
├── js/views.js                 dashboard, senarai, butiran, tindakan, statistik, notifikasi, PDF
├── js/report.js                borang laporan & lampiran
├── js/admin.js                 pengurusan pengguna & tetapan
├── js/pdf.js                   penjana PDF A4
├── robots.txt, .nojekyll
├── README.md, PANDUAN.md
└── apps-script/                salinan kod backend — tampal ke projek Apps Script
    ├── appsscript.json
    ├── Code.gs                 doPost/doGet, senarai API, pemalar, utiliti
    ├── Database.gs             SCHEMA, setupDatabase(), diagnose(), akses jadual, tetapan, murid, muat naik
    ├── Auth.gs                 pengesahan ID token Google, daftar, sesi, pengurusan pengguna
    ├── Reports.gs              laporan, aliran kerja, tindakan, pengesahan, lampiran, notifikasi
    ├── Dashboard.gs            statistik, ringkasan bulanan/tahunan, data PDF
    └── Audit.gs                audit log berantai hash, sandaran, eksport CSV
```

Folder `apps-script/` dalam repo hanyalah salinan rujukan. Ia tiada ID, kunci atau data, jadi selamat berada dalam repo public. Kod sebenar yang berjalan ialah yang ditampal dalam projek Apps Script.

### Fungsi API (dipanggil melalui `doPost`)
`getBootInfo(idToken)`, `startSession(idToken)`, `registerUser(idToken, data)`, `logout`, `ping`, `getCurrentUser`, `getUserRole`, `updateMyProfile`, `listUsers`, `approveUser`, `rejectUser`, `updateUserRole`, `setUserStatus`, `createReport`, `saveDraft`, `updateReport`, `submitReport`, `deleteDraft`, `getMyReports`, `getAllReports`, `getReportById`, `updateReportStatus`, `setHandler`, `addDisciplineAction`, `addApproval`, `uploadEvidence`, `deleteAttachment`, `getAttachment`, `getNotifications`, `markNotificationRead`, `getDashboardStats`, `getSummaryReport`, `getReportForPdf`, `getSchoolSettings`, `updateSchoolSettings`, `uploadLogo`, `getLogo`, `searchStudents`, `importStudents`, `studentCount`, `writeAuditLog`, `getAuditLog`, `verifyAuditChain`, `backupNow`, `listBackups`, `exportReportsCsv`.

Fungsi lain dipanggil sebagai `fn(tokenSesi, data)`.

Fungsi editor sahaja (tidak boleh dipanggil melalui API): `setupDatabase`, `diagnose`, `installBackupTrigger`. Pengendali trigger: `cronDailyBackup`.

Semua respons berbentuk `{ ok: true, data }` atau `{ ok: false, error: { code, message } }`.
