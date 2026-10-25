# e-DISIPLIN MURID 2026

Sistem Pelaporan dan Pengurusan Kes Disiplin Sekolah.
*Pelaporan Pantas, Pengurusan Sistematik, Sekolah Harmoni.*

- **Backend + aplikasi**: Google Apps Script (HtmlService) + Google Sheets + Google Drive
- **Landing page**: GitHub Pages
- **Log masuk**: akaun Google sekolah (DELIMa / Google Workspace) — tiada kata laluan disimpan
- **5 peranan**: Admin, Guru Disiplin, PK HEM, Pengetua, Guru Biasa — dikuatkuasakan di pelayan
- **Aliran kerja**: Draf → Dihantar → Dalam Semakan → Dalam Tindakan → Selesai (+ Dipulangkan untuk Pembetulan)
- **PDF A4**: laporan kes individu, ringkasan bulanan & tahunan
- **Audit log** berantai hash, notifikasi dalam aplikasi, sandaran harian

## Mula pantas

1. Akaun pemilik **mesti** akaun Google Workspace dalam domain yang sama dengan guru (contoh DELIMa).
2. script.google.com → projek baharu → salin semua fail dalam `apps-script/`.
3. Jalankan `setupDatabase()` → benarkan kebenaran.
4. Script Properties: `ALLOWED_DOMAINS = moe-dl.edu.my` (atau domain sekolah).
5. Jalankan `installBackupTrigger()`.
6. Deploy → Web app → Execute as **Me** → Access **Anyone within domain**.
7. Tampal URL `/exec` dalam `github-pages/config.js`, terbitkan folder `github-pages/` di GitHub Pages.
8. Jalankan senarai semak ujian peranan dalam `PANDUAN.md` §6 sebelum guna data murid sebenar.

Butiran penuh: **[PANDUAN.md](PANDUAN.md)**.
