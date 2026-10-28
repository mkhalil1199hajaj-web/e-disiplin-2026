'use strict';
/* =====================================================================
 * JsAdmin — pengurusan pengguna dan tetapan sistem
 * ===================================================================== */

const JAWATAN_TO_ROLE = { 'Guru Biasa': 'GURU_BIASA', 'Guru Disiplin': 'GURU_DISIPLIN', 'PK HEM': 'PK_HEM', 'Pengetua': 'PENGETUA' };
const ROLE_OPTIONS = ['GURU_BIASA', 'GURU_DISIPLIN', 'PK_HEM', 'PENGETUA', 'ADMIN'];
const ACC_LABEL = { MENUNGGU_KELULUSAN: 'Menunggu kelulusan', AKTIF: 'Aktif', NYAHAKTIF: 'Nyahaktif', DITOLAK: 'Ditolak' };
const ACC_STYLE = { MENUNGGU_KELULUSAN: 'st-DALAM_SEMAKAN', AKTIF: 'st-SELESAI', NYAHAKTIF: 'st-DRAF', DITOLAK: 'st-DIPULANGKAN' };

/* =====================================================================
 * PENGURUSAN PENGGUNA
 * ===================================================================== */
VIEWS.pengguna = async (main, params) => {
  setTitle('Pengurusan Pengguna', 'Luluskan pendaftaran, tetapkan peranan dan urus akaun');
  const users = await callT('listUsers');
  const tab = params.tab || (users.some(u => u.status === 'MENUNGGU_KELULUSAN') ? 'MENUNGGU_KELULUSAN' : 'AKTIF');
  const tabs = [['MENUNGGU_KELULUSAN', 'Menunggu kelulusan'], ['AKTIF', 'Aktif'], ['LAIN', 'Nyahaktif / ditolak']];
  const list = users.filter(u => tab === 'LAIN' ? ['NYAHAKTIF', 'DITOLAK'].includes(u.status) : u.status === tab);
  const roleSel = (u) => `<select class="inp inp-sm u-role" data-id="${esc(u.userId)}">${ROLE_OPTIONS.map(r => `<option value="${r}" ${r === (u.role || JAWATAN_TO_ROLE[u.jawatan]) ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>`;
  main.innerHTML = `<div class="card"><div class="tabs px-4">${tabs.map(t => `<button class="tab ${t[0] === tab ? 'active' : ''}" data-tab="${t[0]}">${t[1]} <span class="ml-1 text-xs text-slate-400">${users.filter(u => t[0] === 'LAIN' ? ['NYAHAKTIF', 'DITOLAK'].includes(u.status) : u.status === t[0]).length}</span></button>`).join('')}</div>
    <div class="p-4">${list.length ? `<div class="space-y-3">${list.map(u => `
      <div class="rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <span class="h-10 w-10 shrink-0 rounded-full bg-navy-800 text-white text-sm font-bold flex items-center justify-center">${esc(initials(u.nama))}</span>
          <div class="min-w-0"><p class="font-semibold text-navy-900 truncate">${esc(u.nama)} ${u.userId === S.user.userId ? '<span class="text-xs text-royal-600">(anda)</span>' : ''}</p>
          <p class="text-xs text-slate-500 truncate">${esc(u.email)} · ID ${esc(u.idGuru)}${u.telefon ? ' · ' + esc(u.telefon) : ''}</p>
          <p class="text-xs text-slate-500">Jawatan dimohon: <b>${esc(u.jawatan)}</b> · Daftar ${fmtDate(u.tarikhDaftar)}${u.lastLogin ? ' · Log masuk terakhir ' + fmtDateTime(u.lastLogin) : ''}</p></div></div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge ${ACC_STYLE[u.status]}">${esc(ACC_LABEL[u.status] || u.status)}</span>
          ${u.status === 'MENUNGGU_KELULUSAN' ? `${roleSel(u)}<button class="btn btn-success btn-sm u-approve" data-id="${esc(u.userId)}"><i data-lucide="user-check"></i> Luluskan</button><button class="btn btn-danger btn-sm u-reject" data-id="${esc(u.userId)}">Tolak</button>` : ''}
          ${u.status === 'AKTIF' ? `${roleSel(u)}<button class="btn btn-ghost btn-sm u-saverole" data-id="${esc(u.userId)}">Simpan peranan</button>${u.userId !== S.user.userId ? `<button class="btn btn-danger btn-sm u-deact" data-id="${esc(u.userId)}"><i data-lucide="user-x"></i> Nyahaktif</button>` : ''}` : ''}
          ${u.status === 'NYAHAKTIF' ? `<button class="btn btn-ghost btn-sm u-act" data-id="${esc(u.userId)}">Aktifkan semula</button>` : ''}
          ${u.status === 'DITOLAK' ? `${roleSel(u)}<button class="btn btn-ghost btn-sm u-approve" data-id="${esc(u.userId)}">Luluskan</button>` : ''}
        </div></div>`).join('')}</div>` : emptyState('Tiada pengguna dalam kategori ini', '', 'users')}</div></div>`;
  $$('[data-tab]', main).forEach(b => b.onclick = () => go('pengguna', { tab: b.dataset.tab }));
  const roleOf = id => $(`.u-role[data-id="${id}"]`).value;
  const run = async (label, fn, payload, msg) => {
    try { await withLoading(label, () => callT(fn, payload)); toast(msg); go('pengguna', { tab }); } catch (e) { alertErr(e); }
  };
  $$('.u-approve', main).forEach(b => b.onclick = async () => {
    const role = roleOf(b.dataset.id);
    if (!await confirmBox('Luluskan akaun?', `Akaun akan diaktifkan sebagai <b>${esc(ROLE_LABEL[role])}</b>.`, 'Luluskan')) return;
    run('Meluluskan…', 'approveUser', { userId: b.dataset.id, role }, 'Akaun diluluskan');
  });
  $$('.u-reject', main).forEach(b => b.onclick = async () => {
    if (!await confirmBox('Tolak pendaftaran?', 'Pengguna tidak akan dapat log masuk.', 'Tolak', 'warning')) return;
    run('Memproses…', 'rejectUser', { userId: b.dataset.id }, 'Pendaftaran ditolak');
  });
  $$('.u-saverole', main).forEach(b => b.onclick = async () => {
    const role = roleOf(b.dataset.id);
    if (!await confirmBox('Tukar peranan?', `Peranan baharu: <b>${esc(ROLE_LABEL[role])}</b>. Akses pengguna berubah serta-merta.`, 'Simpan')) return;
    run('Menyimpan…', 'updateUserRole', { userId: b.dataset.id, role }, 'Peranan dikemas kini');
  });
  $$('.u-deact', main).forEach(b => b.onclick = async () => {
    if (!await confirmBox('Nyahaktifkan akaun?', 'Pengguna akan dilog keluar serta-merta dan tidak dapat log masuk. Rekod laporan mereka kekal.', 'Nyahaktif', 'warning')) return;
    run('Memproses…', 'setUserStatus', { userId: b.dataset.id, status: 'NYAHAKTIF' }, 'Akaun dinyahaktifkan');
  });
  $$('.u-act', main).forEach(b => b.onclick = () => run('Memproses…', 'setUserStatus', { userId: b.dataset.id, status: 'AKTIF' }, 'Akaun diaktifkan semula'));
};

/* =====================================================================
 * TETAPAN
 * ===================================================================== */
VIEWS.tetapan = async (main, params) => {
  const admin = hasRole('ADMIN');
  setTitle('Tetapan', admin ? 'Konfigurasi sekolah dan sistem' : 'Profil pengguna');
  const tabs = admin
    ? [['sekolah', 'Sekolah'], ['kategori', 'Kategori & perincian kes'], ['senarai', 'Senarai pilihan'], ['murid', 'Data murid'], ['sandaran', 'Sandaran & eksport'], ['audit', 'Audit log'], ['profil', 'Profil saya']]
    : [['profil', 'Profil saya']];
  const tab = tabs.some(t => t[0] === params.tab) ? params.tab : tabs[0][0];
  main.innerHTML = `<div class="card">${tabs.length > 1 ? `<div class="tabs px-4">${tabs.map(t => `<button class="tab ${t[0] === tab ? 'active' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>` : ''}<div class="card-b" id="tt-body"></div></div>`;
  $$('[data-tab]', main).forEach(b => b.onclick = () => go('tetapan', { tab: b.dataset.tab }));
  const body = $('#tt-body');
  await (SETTINGS_TABS[tab] || SETTINGS_TABS.profil)(body);
  icons();
};

async function saveSettings(payload, msg) {
  try {
    S.settings = await withLoading('Menyimpan tetapan…', () => callT('updateSchoolSettings', payload));
    $('#sb-school').textContent = S.settings.namaSekolah;
    toast(msg || 'Tetapan disimpan');
  } catch (e) { alertErr(e); }
}

const SETTINGS_TABS = {
  async profil(body) {
    const u = S.user;
    body.innerHTML = `<form id="pf" class="max-w-xl space-y-4">
      <div class="field"><label class="req">Nama penuh</label><input name="nama" class="inp" maxlength="120" value="${esc(u.nama)}"></div>
      <div class="grid sm:grid-cols-2 gap-4"><div class="field"><label>ID Guru</label><input name="idGuru" class="inp" value="${esc(u.idGuru)}" ${hasRole('ADMIN') ? '' : 'readonly'}></div>
      <div class="field"><label>No. telefon</label><input name="telefon" class="inp" maxlength="20" value="${esc(u.telefon || '')}"></div></div>
      <div class="grid sm:grid-cols-2 gap-4"><div class="field"><label>E-mel</label><input class="inp" value="${esc(u.email)}" readonly></div>
      <div class="field"><label>Peranan</label><input class="inp" value="${esc(ROLE_LABEL[u.role])}" readonly></div></div>
      <p class="hint">Peranan hanya boleh ditukar oleh Admin. Kata laluan diurus melalui akaun Google anda.</p>
      <button class="btn btn-primary"><i data-lucide="save"></i> Simpan profil</button></form>`;
    $('#pf').onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target).entries());
      try {
        S.user = await withLoading('Menyimpan…', () => callT('updateMyProfile', f));
        $('#sb-name').textContent = S.user.nama; $('#sb-avatar').textContent = initials(S.user.nama);
        toast('Profil dikemas kini');
      } catch (e) { alertErr(e); }
    };
  },

  async sekolah(body) {
    const st = S.settings;
    let logo = '';
    try { logo = (await callT('getLogo')).dataUrl; } catch (e) {}
    body.innerHTML = `<div class="grid lg:grid-cols-3 gap-6">
      <form id="sf" class="lg:col-span-2 space-y-4">
        <div class="field"><label class="req">Nama sekolah</label><input name="namaSekolah" class="inp" maxlength="150" value="${esc(st.namaSekolah)}"></div>
        <div class="field"><label>Alamat sekolah</label><textarea name="alamatSekolah" class="inp" style="min-height:80px" maxlength="400">${esc(st.alamatSekolah)}</textarea></div>
        <div class="grid sm:grid-cols-2 gap-4"><div class="field"><label>Tamat sesi selepas tidak aktif (minit)</label><input name="timeoutMin" type="number" min="5" max="240" class="inp" value="${esc(st.timeoutMin)}"></div></div>
        <div class="field"><label>Dasar penyimpanan & pemadaman data</label><textarea name="retentionNote" class="inp" style="min-height:80px" maxlength="1000">${esc(st.retentionNote || '')}</textarea>
          <p class="hint">Catat tempoh simpanan rekod mengikut arahan sekolah dan KPM. Sistem tidak memadam rekod secara automatik.</p></div>
        <button class="btn btn-primary"><i data-lucide="save"></i> Simpan</button></form>
      <div><p class="lbl">Logo sekolah (untuk PDF)</p>
        <div class="rounded-xl border border-slate-200 p-4 flex flex-col items-center gap-3">
          ${logo ? `<img src="${logo}" class="max-h-28 object-contain" alt="Logo sekolah">` : '<div class="h-24 w-24 rounded-xl bg-slate-100 flex items-center justify-center"><i data-lucide="school" class="h-8 w-8 text-slate-400"></i></div>'}
          <label class="btn btn-ghost btn-sm cursor-pointer"><i data-lucide="upload"></i> Muat naik logo<input id="logo-file" type="file" accept="image/png,image/jpeg" class="hidden"></label>
          <p class="hint text-center">PNG atau JPG, maksimum 1MB.</p></div></div></div>`;
    $('#sf').onsubmit = ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target).entries()); f.timeoutMin = Number(f.timeoutMin); saveSettings(f).then(() => { S.timeoutMin = S.settings.timeoutMin; }); };
    $('#logo-file').onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return;
      if (!['image/png', 'image/jpeg'].includes(f.type) || f.size > 1048576) return alertErr({ message: 'Logo mesti PNG/JPG dan tidak melebihi 1MB.' });
      try {
        const dataUrl = await readAsDataUrl(f);
        await withLoading('Memuat naik logo…', () => callT('uploadLogo', { fileName: f.name, mimeType: f.type, base64: dataUrl.split(',')[1] }));
        toast('Logo dikemas kini'); go('tetapan', { tab: 'sekolah' });
      } catch (e) { alertErr(e); }
    };
  },

  async kategori(body) {
    const text = S.settings.kategori.map(k => `${k.nama} | ${k.jenis.join('; ')}`).join('\n');
    body.innerHTML = `<div class="max-w-3xl space-y-3">
      <p class="text-sm text-slate-600">Satu kategori setiap baris. Format: <code class="bg-slate-100 px-1.5 py-0.5 rounded">Kategori kes | perincian 1; perincian 2; perincian 3</code>. Masukkan "LAIN-LAIN" dalam senarai perincian jika guru boleh memilih perincian lain. Maksimum 50 kategori dan 60 perincian setiap kategori.</p>
      <div class="rounded-xl bg-gold-100 border border-gold-200 p-3 text-xs text-navy-800">Pastikan kategori selaras dengan peraturan sekolah dan garis panduan pengurusan disiplin KPM yang berkuat kuasa. Laporan lama mengekalkan kategori asalnya.</div>
      <textarea id="kt" class="inp font-mono text-xs" style="min-height:340px">${esc(text)}</textarea>
      <button class="btn btn-primary" id="kt-save"><i data-lucide="save"></i> Simpan kategori</button></div>`;
    $('#kt-save').onclick = () => {
      const kategori = $('#kt').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [nama, jenis] = l.split('|');
        return { nama: (nama || '').trim(), jenis: String(jenis || '').split(';').map(s => s.trim()).filter(Boolean) };
      });
      saveSettings({ kategori }, 'Kategori dan perincian kes disimpan');
    };
  },

  async senarai(body) {
    const st = S.settings;
    body.innerHTML = `<div class="grid lg:grid-cols-2 gap-6">
      <div><label class="lbl">Jenis tindakan disiplin (satu setiap baris)</label><textarea id="ls-tind" class="inp" style="min-height:280px">${esc(st.jenisTindakan.join('\n'))}</textarea>
        <button class="btn btn-primary mt-3" id="ls-tind-save"><i data-lucide="save"></i> Simpan</button></div>
      <div><label class="lbl">Tempat kejadian (satu setiap baris)</label><textarea id="ls-temp" class="inp" style="min-height:280px">${esc(st.tempat.join('\n'))}</textarea>
        <button class="btn btn-primary mt-3" id="ls-temp-save"><i data-lucide="save"></i> Simpan</button></div></div>`;
    const lines = id => $(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    $('#ls-tind-save').onclick = () => saveSettings({ jenisTindakan: lines('#ls-tind') }, 'Jenis tindakan disimpan');
    $('#ls-temp-save').onclick = () => saveSettings({ tempat: lines('#ls-temp') }, 'Senarai tempat disimpan');
  },

  async murid(body) {
    const c = await callT('studentCount');
    body.innerHTML = `<div class="max-w-3xl space-y-3">
      <p class="text-sm text-slate-600">Jumlah murid dalam senarai: <b>${c.total}</b>. Senarai ini digunakan untuk carian pantas dalam borang laporan.</p>
      <p class="text-sm text-slate-600">Tampal data CSV (boleh salin terus dari Excel / Google Sheets). Susunan kolum:</p>
      <code class="block text-xs bg-slate-100 rounded-lg p-3">ID Murid, Nama Murid, Tingkatan, Kelas, Sesi, Jantina<br>M2026001, Ahmad bin Ali, 3, 3 Bestari, Pagi, Lelaki</code>
      <p class="hint">Tingkatan: ${esc(S.settings.tingkatan.join(', '))} · Sesi: Pagi / Petang · Jantina: Lelaki / Perempuan. ID yang sudah wujud akan dikemas kini.</p>
      <textarea id="mi" class="inp font-mono text-xs" style="min-height:260px" placeholder="ID Murid, Nama Murid, Tingkatan, Kelas, Sesi, Jantina"></textarea>
      <button class="btn btn-primary" id="mi-go"><i data-lucide="upload"></i> Import murid</button><div id="mi-res"></div></div>`;
    $('#mi-go').onclick = async () => {
      const csv = $('#mi').value.trim(); if (!csv) return;
      try {
        const r = await withLoading('Mengimport…', () => callT('importStudents', { csv }));
        $('#mi-res').innerHTML = `<div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm mt-2">Ditambah: <b>${r.added}</b> · Dikemas kini: <b>${r.updated}</b> · Ralat: <b>${r.errors.length}</b>
          ${r.errors.length ? `<ul class="mt-2 text-xs text-red-700 list-disc pl-5">${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}</div>`;
      } catch (e) { alertErr(e); }
    };
  },

  async sandaran(body) {
    let backups = [];
    try { backups = await callT('listBackups'); } catch (e) {}
    body.innerHTML = `<div class="grid lg:grid-cols-2 gap-6">
      <div class="space-y-3"><p class="font-bold text-navy-900">Sandaran database</p>
        <p class="text-sm text-slate-600">Salinan penuh spreadsheet disimpan dalam folder Drive "Sandaran" milik pemilik sistem. ${backups.length} sandaran tersimpan (30 terkini dikekalkan).</p>
        <button class="btn btn-navy" id="bk-now"><i data-lucide="hard-drive-download"></i> Buat sandaran sekarang</button>
        <div class="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-72 overflow-y-auto">${backups.length ? backups.map(b => `<div class="px-3 py-2 text-xs flex justify-between gap-2"><span class="truncate">${esc(b.nama)}</span><span class="text-slate-400 shrink-0">${fmtDateTime(b.tarikh)}</span></div>`).join('') : '<p class="p-3 text-xs text-slate-500">Belum ada sandaran.</p>'}</div>
        <p class="hint">Sandaran automatik harian dipasang oleh pemilik skrip melalui fungsi installBackupTrigger() (lihat panduan).</p></div>
      <div class="space-y-3"><p class="font-bold text-navy-900">Eksport data laporan (CSV)</p>
        <p class="text-sm text-slate-600">Semua laporan yang telah dihantar (tidak termasuk draf). Fail mengandungi maklumat murid yang SULIT — simpan dengan selamat.</p>
        <div class="grid grid-cols-2 gap-2"><div><label class="lbl">Dari</label><input type="date" id="ex-dari" class="inp"></div><div><label class="lbl">Hingga</label><input type="date" id="ex-hingga" class="inp"></div></div>
        <button class="btn btn-ghost" id="ex-go"><i data-lucide="file-spreadsheet"></i> Muat turun CSV</button></div></div>`;
    $('#bk-now').onclick = async () => {
      try { const r = await withLoading('Membuat sandaran…', () => callT('backupNow')); toast('Sandaran dibuat'); go('tetapan', { tab: 'sandaran' }); } catch (e) { alertErr(e); }
    };
    $('#ex-go').onclick = async () => {
      if (!await confirmBox('Eksport data?', 'Eksport ini akan direkodkan dalam audit log.', 'Eksport')) return;
      try {
        const r = await withLoading('Menjana CSV…', () => callT('exportReportsCsv', { dari: $('#ex-dari').value, hingga: $('#ex-hingga').value }));
        downloadText(r.filename, r.csv, 'text/csv;charset=utf-8');
        callT('writeAuditLog', { aktiviti: 'MUAT_TURUN_CSV', butiran: r.count + ' rekod' }).catch(() => {});
        toast(r.count + ' rekod dieksport');
      } catch (e) { alertErr(e); }
    };
  },

  async audit(body) {
    body.innerHTML = `<div class="flex flex-wrap gap-2 items-center mb-4"><input id="au-q" class="inp max-w-sm" placeholder="Cari aktiviti / e-mel / ID laporan">
      <button class="btn btn-ghost" id="au-verify"><i data-lucide="shield-check"></i> Semak keutuhan audit log</button></div><div id="au-list"></div>`;
    const load = async () => {
      const rows = await callT('getAuditLog', { q: $('#au-q').value, limit: 300 });
      $('#au-list').innerHTML = rows.length ? `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Masa</th><th>Aktiviti</th><th>Pengguna</th><th>Laporan</th><th>Keputusan</th><th>Butiran</th></tr></thead><tbody>
        ${rows.map(a => `<tr class="cursor-default"><td class="whitespace-nowrap text-xs">${fmtDateTime(a.masa)}</td><td class="text-xs font-bold">${esc(a.aktiviti)}</td><td class="text-xs">${esc(a.email)}</td><td class="text-xs">${esc(a.reportId)}</td>
        <td class="text-xs ${a.result === 'BERJAYA' ? 'text-emerald-700' : 'text-red-700'} font-semibold">${esc(a.result)}</td><td class="text-xs text-slate-500">${esc(a.butiran)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('Tiada rekod');
    };
    $('#au-q').addEventListener('input', debounce(load, 400));
    $('#au-verify').onclick = async () => {
      try {
        const r = await withLoading('Menyemak rantaian hash…', () => callT('verifyAuditChain'));
        Swal.fire({ icon: r.ok ? 'success' : 'error', title: r.ok ? 'Audit log utuh' : 'Perubahan dikesan', text: r.message });
      } catch (e) { alertErr(e); }
    };
    await load();
  }
};
