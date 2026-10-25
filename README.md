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
