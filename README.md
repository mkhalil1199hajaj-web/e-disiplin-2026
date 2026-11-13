# e-DISIPLIN MURID 2026

Sistem Pelaporan dan Pengurusan Kes Disiplin Sekolah.
*Pelaporan Pantas, Pengurusan Sistematik, Sekolah Harmoni.*

- **Aplikasi (UI)**: GitHub Pages — `index.html` (landing), `app.html` (aplikasi), `panduan.html`
- **Backend**: Google Apps Script (`doPost` JSON API) + Google Sheets + Google Drive
- **Log masuk**: "Sign in with Google" — token disahkan di pelayan, tiada kata laluan disimpan
- **5 peranan**: Admin, Guru Disiplin, PK HEM, Pengetua, Guru Biasa — dikuatkuasakan di pelayan
- **Aliran kerja**: Draf → Dihantar → Dalam Semakan → Dalam Tindakan → Selesai (+ Dipulangkan untuk Pembetulan)
- **PDF A4**: laporan kes individu, ringkasan bulanan & tahunan
- **Audit log** berantai hash, notifikasi dalam aplikasi, sandaran harian

## Mula pantas

1. script.google.com (akaun pemilik) → projek baharu → salin fail dalam `apps-script/`.
2. Jalankan `setupDatabase()` dan `installBackupTrigger()`.
3. Google Cloud Console → OAuth client ID (Web) → origin `https://<username>.github.io` → Publish app.
4. Script Properties: `GOOGLE_CLIENT_ID = <client id>`.
5. Deploy → Web app → Execute as **Me** → Who has access **Anyone** → salin URL `/exec`.
6. Isi `APP_URL` dan `GOOGLE_CLIENT_ID` dalam `config.js`.
7. Jalankan senarai semak ujian peranan dalam `PANDUAN.md` §6 sebelum guna data murid sebenar.

Butiran penuh: **[PANDUAN.md](PANDUAN.md)**.

## PWA (boleh dipasang)

- `manifest.webmanifest`, `sw.js`, `js/pwa.js`, `icons/` — app boleh dipasang dari Chrome/Edge (butang **Pasang app**) dan Safari iOS (Kongsi → Tambah ke Skrin Utama).
- Pustaka JS dan fon disimpan dalam `vendor/` (tiada CDN kecuali log masuk Google).
- Tailwind kini dibina sebagai `css/tailwind.css`. **Selepas menambah/menukar kelas Tailwind dalam HTML/JS, jalankan `npm install` (sekali) dan `npm run build:css`, kemudian commit `css/tailwind.css`.**
- `sw.js`: halaman & kod = network-first (kemas kini terus sampai); `vendor/` & `icons/` = cache-first. **Naikkan `VERSI` dalam `sw.js` bila menukar fail `vendor/` atau `icons/`.** Data laporan tidak pernah di-cache.

## APK Android (TWA)

- `twa/twa-manifest.json` + `twa/build-twa.mjs` (Bubblewrap) → `.github/workflows/android-apk.yml` membina APK dan menerbitkannya ke GitHub Releases.
- Link tetap: https://github.com/mkhalil1199hajaj-web/e-disiplin-2026/releases/latest/download/e-disiplin.apk
- APK membuka PWA dalam Chrome (log masuk Google berfungsi). Kemas kini web sampai terus; APK baharu hanya perlu bila ikon/nama/twa-manifest berubah.
- Kunci tetap: tambah secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Tanpanya, setiap build guna kunci sementara.
