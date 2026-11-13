/* =====================================================================
 * PWA: daftar service worker + butang "Pasang app"
 * Butang: mana-mana elemen dengan kelas .installBtn (tersembunyi secara lalai).
 * ===================================================================== */
(function () {
  'use strict';
  var NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  window.EDISIPLIN_NATIVE = NATIVE;
  if (NATIVE) return;

  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;

  function buttons() { return Array.prototype.slice.call(document.querySelectorAll('.installBtn')); }
  function show(on) { buttons().forEach(function (b) { b.classList.toggle('hidden', !on); }); }

  function note(msg) {
    if (typeof window.toast === 'function') { window.toast(msg, 'success'); return; }
    var d = document.createElement('div');
    d.textContent = msg;
    d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:#0b1d3a;color:#fff;padding:12px 18px;border-radius:12px;font:600 14px/1.4 "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:90vw;text-align:center';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 4500);
  }

  function iosHelp() {
    var msg = 'Untuk pasang di iPhone/iPad: buka pautan ini dalam Safari, tekan butang Kongsi (petak dengan anak panah ke atas), kemudian pilih "Tambah ke Skrin Utama".';
    if (window.Swal) window.Swal.fire({ icon: 'info', title: 'Pasang e-DISIPLIN', text: msg, confirmButtonText: 'Faham', confirmButtonColor: '#2453c7' });
    else note(msg);
  }

  function onClick(e) {
    e.preventDefault();
    if (deferred) {
      var p = deferred; deferred = null;
      p.prompt();
      p.userChoice.then(function (r) { if (r.outcome !== 'accepted') { deferred = p; } else { show(false); } });
    } else if (isIOS) {
      iosHelp();
    }
  }

  function bind() {
    buttons().forEach(function (b) { if (!b.dataset.pwaBound) { b.dataset.pwaBound = '1'; b.addEventListener('click', onClick); } });
    if (!standalone && isIOS) show(true); // iOS tiada beforeinstallprompt: tunjuk arahan manual
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    show(true);
  });
  window.addEventListener('appinstalled', function () {
    deferred = null; show(false);
    note('e-DISIPLIN dipasang. Buka dari skrin utama atau senarai app anda.');
  });

  // Butang yang dijana kemudian (cth. skrin log masuk) — ikat semula bila DOM berubah.
  window.edisiplinBindInstall = function () { bind(); if (deferred) show(true); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

  var host = location.hostname;
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !/script\.google|googleusercontent/.test(host)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function (err) { console.warn('[PWA] SW gagal didaftar', err); });
    });
  }
})();
