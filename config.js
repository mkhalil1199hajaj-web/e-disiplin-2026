/*
 * e-DISIPLIN MURID 2026 — konfigurasi aplikasi
 *
 * APP_URL          : URL Web App Google Apps Script (berakhir dengan /exec)
 * GOOGLE_CLIENT_ID : OAuth 2.0 Client ID jenis "Web application" dari Google Cloud Console
 *
 * Kedua-dua nilai ini BUKAN rahsia (ia dihantar kepada pelayar setiap pengguna).
 * Keselamatan sebenar: pelayan mengesahkan ID token Google, kelulusan Admin dan peranan.
 * JANGAN letak sebarang kata laluan, client secret, ID spreadsheet atau data murid di sini.
 */
window.EDISIPLIN_CONFIG = {
  APP_URL: 'https://script.google.com/macros/s/AKfycbwa-jty4lrpfED3K9tzkWXBj4WO9Y0yiZshv9XafOdhk340jkGKdsRa56Z0XE1kPIraMw/exec',
  GOOGLE_CLIENT_ID: '823216331340-qu1rsoita2ut5lqjqus2uk6tlrup1krr.apps.googleusercontent.com',
  NAMA_SEKOLAH: ''
};
