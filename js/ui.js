/* Shared UI helpers: glass bottom-sheet forms, confirmations, toasts. */
const UI = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let modal, toastEl, opener, timer;
  const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function close() { modal.hidden = true; modal.innerHTML = ''; if (opener && document.body.contains(opener)) opener.focus(); }
  function open(html) {
    if (modal.hidden) opener = document.activeElement;
    modal.innerHTML = html; modal.hidden = false;
    modal.querySelector('.scrim').addEventListener('click', close);
    modal.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', close));
  }
  function field(f, v) {
    const val = v[f.name] != null ? v[f.name] : (f.def != null ? f.def : '');
    let h;
    if (f.type === 'select') h = `<select name="${f.name}">${f.options.map(o => `<option value="${esc(o.v)}"${String(o.v) === String(val) ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
    else if (f.type === 'seg') h = `<div class="seg" data-seg="${f.name}">${f.options.map(o => `<button type="button" data-v="${esc(o.v)}"${String(o.v) === String(val) ? ' class="on"' : ''}>${esc(o.l)}</button>`).join('')}</div><input type="hidden" name="${f.name}" value="${esc(val)}">`;
    else if (f.type === 'textarea') h = `<textarea name="${f.name}" rows="3">${esc(val)}</textarea>`;
    else h = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}"${f.mode ? ` inputmode="${f.mode}"` : ''}${f.ph ? ` placeholder="${esc(f.ph)}"` : ''} autocomplete="off">`;
    return `<div class="field${f.half ? ' half' : ''}"><label>${esc(f.label)}</label>${h}</div>`;
  }
  function confirm(msg, onYes, yesLabel = 'Delete', title = 'Are you sure?') {
    open(`<div class="scrim"></div><section class="sheet mini glass l3" role="alertdialog" aria-label="${esc(title)}"><header class="top"><h1>${esc(title)}</h1></header><div class="sheet-body"><p class="note">${esc(msg)}</p><div class="actions"><button class="btn" data-x>Cancel</button><button class="btn danger" data-yes>${esc(yesLabel)}</button></div></div></section>`);
    modal.querySelector('[data-yes]').addEventListener('click', () => { close(); onYes(); });
  }
  // o: { title, fields, values, submit, onSave(values) -> error string | undefined, onDelete, deleteMsg }
  function form(o) {
    const v = o.values || {};
    open(`<div class="scrim"></div><section class="sheet mini glass l3" role="dialog" aria-modal="true" aria-label="${esc(o.title)}"><header class="top"><h1>${esc(o.title)}</h1><button class="icon-btn" data-x aria-label="Close">${X}</button></header><form class="sheet-body" novalidate><div class="fields">${o.fields.map(f => field(f, v)).join('')}</div><p class="err" role="alert"></p><div class="actions">${o.onDelete ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}<button type="submit" class="btn solid">${esc(o.submit || 'Save')}</button></div></form></section>`);
    const f = modal.querySelector('form');
    f.querySelectorAll('[data-seg]').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      f.elements[g.dataset.seg].value = b.dataset.v;
    }));
    f.addEventListener('submit', e => {
      e.preventDefault();
      const vals = {};
      Array.from(f.elements).forEach(el => { if (el.name) vals[el.name] = el.value.trim(); });
      const err = o.onSave(vals);
      if (err) f.querySelector('.err').textContent = err; else close();
    });
    if (o.onDelete) f.querySelector('[data-del]').addEventListener('click', () => confirm(o.deleteMsg || 'Delete this item? This cannot be undone.', o.onDelete));
  }
  function toast(msg, ms = 3500) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(timer); timer = setTimeout(() => { toastEl.hidden = true; }, ms);
  }
  const empty = (t, s) => `<div class="empty"><b>${esc(t)}</b><small>${esc(s)}</small></div>`;
  function bind(container, sel, cb) { // group selector: calls cb(data-v) and handles clicks only inside container
    container.addEventListener('click', e => { const b = e.target.closest(sel); if (b && container.contains(b)) cb(b.dataset.v); });
  }
  function init() { modal = document.getElementById('modal'); toastEl = document.getElementById('toast'); }
  return { init, esc, form, confirm, toast, empty, bind, close };
})();
