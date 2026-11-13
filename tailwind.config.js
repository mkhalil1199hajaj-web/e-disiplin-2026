/** Konfigurasi Tailwind (dahulu dalam <script> CDN setiap halaman).
 *  Bina semula CSS: npm run build:css  (GitHub Actions juga membinanya secara automatik). */
module.exports = {
  content: ['./*.html', './js/**/*.js', './config.js'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#071327', 900: '#0b1d3a', 800: '#10284f', 700: '#163667', 600: '#1d4585' },
        royal: { 700: '#1c45a8', 600: '#2453c7', 500: '#2f66e0', 200: '#c9d8fb', 100: '#e5edfd', 50: '#f2f6fe' },
        gold: { 600: '#b8860b', 500: '#d4a017', 400: '#e3b93d', 200: '#f3e2a6', 100: '#fbf3dc' }
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'Segoe UI', 'sans-serif'] }
    }
  }
};
