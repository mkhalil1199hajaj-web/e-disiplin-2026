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
  APP_URL: 'TAMPAL_URL_WEB_APP_DI_SINI',
  GOOGLE_CLIENT_ID: 'TAMPAL_CLIENT_ID_DI_SINI',
  NAMA_SEKOLAH: ''
};
