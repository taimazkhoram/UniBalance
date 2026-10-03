/* Settings module: sheet UI, preferences, and JSON backup export/import. Notification permission arrives in Stage 5. */
const Settings = (() => {
  let sheet, opener, fileInput;
  const S = () => Store.data.settings;
  const set = (k, v) => { S()[k] = v; Store.commit(); };
  const msg = html => { document.getElementById('backup-msg').innerHTML = html; };
  const bad = t => msg('<span class="exp">' + UI.esc(t) + '</span>');
  const good = t => msg('<span class="inc">' + UI.esc(t) + '</span>');
  const summary = c => `${c.courses} courses, ${c.tasks} tasks, ${c.events} events, ${c.transactions} transactions`;

  function sync() {
    document.getElementById('set-reminders').checked = !!S().remindersEnabled;
    document.getElementById('set-currency').value = S().currency;
    sheet.querySelectorAll('.seg[data-setting]').forEach(g =>
      g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S()[g.dataset.setting])));
  }
  function open() { opener = document.activeElement; sync(); sheet.hidden = false; sheet.querySelector('.icon-btn').focus(); }
  function close() { sheet.hidden = true; if (opener) opener.focus(); }

  async function doExport() {
    const name = Store.exportName(), file = new File([Store.exportJSON()], name, { type: 'application/json' });
    try { // on touch devices the share sheet offers "Save to Files"
      if (navigator.maxTouchPoints > 0 && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return good('Backup shared: ' + name);
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    good('Backup file created: ' + name + '. Check your Downloads or Files app.');
  }

  async function onFile() {
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return bad('That file is too large to be a UniBalance backup.');
    let text;
    try { text = await f.text(); } catch (e) { return bad('The file could not be read.'); }
    fileInput.value = ''; // lets the same file be chosen again
    const r = Store.parseBackup(text);
    if (!r.ok) return bad(r.error + ' Nothing was changed.');
    UI.confirm(`Replace everything in UniBalance with this backup${r.exportedAt ? ' from ' + r.exportedAt : ''}? It contains ${summary(r.counts)}. You currently have ${summary(Store.counts())}. Current data will be overwritten.`,
      () => {
        if (Store.replace(r.data)) { sync(); good('Backup imported: ' + summary(r.counts) + '.'); }
        else bad('Import failed because the device storage is full or blocked. Nothing was changed.');
      }, 'Replace data', 'Import backup?');
  }

  function init() {
    sheet = document.getElementById('settings');
    fileInput = document.getElementById('file-import');
    document.getElementById('open-settings').addEventListener('click', open);
    sheet.querySelectorAll('[data-close-settings]').forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });
    document.getElementById('set-reminders').addEventListener('change', e => { set('remindersEnabled', e.target.checked); if (e.target.checked) Notifications.onEnabled(); });
    document.getElementById('set-currency').addEventListener('change', e => set('currency', e.target.value));
    sheet.querySelectorAll('.seg[data-setting]').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      set(g.dataset.setting, b.dataset.v); sync();
    }));
    document.getElementById('btn-export').addEventListener('click', doExport);
    document.getElementById('btn-import').addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
    fileInput.addEventListener('change', onFile);
    sync();
  }
  return { init, open, close };
})();
