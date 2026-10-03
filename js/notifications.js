/* Reminders. Backend-free, so reminders can only fire while UniBalance is running.
   - In-app reminders (Home): always work when "Task reminders" is on.
   - System notifications: only while the app is open or recently used, and only after the user allows them.
   - Reminders that come due while the app is closed appear in-app the next time it opens.
   reminderAt is a local 'YYYY-MM-DDTHH:MM'. For recurring tasks it is applied as an offset from the due time of each occurrence. */
const Notifications = (() => {
  const DAY = 864e5, FRESH_MS = 30 * 60 * 1000; // older reminders stay in-app only
  const REM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  const sent = new Set(), toasted = new Set(), failed = new Set(); // per-session guards
  const $ = id => document.getElementById(id);
  const RS = () => Store.data.reminderState;
  const enabled = () => !!Store.data.settings.remindersEnabled;
  const supported = () => typeof Notification !== 'undefined';
  const permission = () => supported() ? Notification.permission : 'unsupported';
  const atMs = (d, t) => { const [y, m, dd] = d.split('-').map(Number), [h, mi] = (t || '00:00').split(':').map(Number); return new Date(y, m - 1, dd, h, mi).getTime(); };

  // Reminders that are due now or within the next 24 hours, not done and not dismissed. `now` is injectable for tests.
  function compute(now = Date.now()) {
    if (!enabled()) return [];
    const out = [], td = DateUtil.iso(new Date(now)), dis = RS().dismissed;
    for (const t of Store.data.tasks) {
      if (!t.dueDate || !REM.test(t.reminderAt || '')) continue;
      const rec = !!t.recurrence && t.recurrence !== 'none';
      const off = atMs(t.reminderAt.slice(0, 10), t.reminderAt.slice(11)) - atMs(t.dueDate, t.dueTime);
      const dates = [];
      if (rec) for (let i = -14; i <= 14; i++) dates.push(DateUtil.addDays(td, i)); else dates.push(t.dueDate);
      for (const d of dates) {
        if (!Tasks.occursOn(t, d) || Tasks.isDone(t, d)) continue;
        const at = atMs(d, t.dueTime) + off, key = t.id + '|' + d + '|' + t.reminderAt;
        if (at > now + DAY || (rec && at < now - 14 * DAY) || dis[key]) continue;
        out.push({ t, d, key, at, due: at <= now, late: Tasks.isOverdue(t, d) });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }

  async function send(it) {
    const title = 'UniBalance reminder', opts = { body: it.t.title, tag: it.key, icon: 'assets/icons/icon-192.png' };
    try {
      if ('serviceWorker' in navigator) {
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 1500))]);
        if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; } // required on iOS
      }
      if (supported()) { new Notification(title, opts); return true; }
    } catch (e) { /* fall through */ }
    return false;
  }

  async function check(now = Date.now()) {
    if (!enabled()) return;
    const items = compute(now), rs = RS();
    let changed = false;
    const fresh = items.filter(i => i.due && !toasted.has(i.key));
    fresh.forEach(i => toasted.add(i.key));
    if (fresh.length) UI.toast(fresh.length === 1 ? 'Reminder: ' + fresh[0].t.title : fresh.length + ' reminders are due');
    if (permission() === 'granted') {
      for (const i of items) {
        if (!i.due || rs.fired[i.key] || sent.has(i.key) || failed.has(i.key) || now - i.at > FRESH_MS) continue;
        sent.add(i.key);
        if (await send(i)) { rs.fired[i.key] = now; changed = true; } else failed.add(i.key);
      }
    }
    const ids = new Set(Store.data.tasks.map(t => t.id)); // forget state of deleted tasks
    ['fired', 'dismissed'].forEach(k => Object.keys(rs[k]).forEach(key => { if (!ids.has(key.split('|')[0])) { delete rs[k][key]; changed = true; } }));
    if (changed) Store.commit();
  }

  function explain() {
    if (!supported() || permission() !== 'default') return;
    UI.confirm('UniBalance can show system notifications for your task reminders, and your device will ask for permission next. They work while the app is open or was used recently. They cannot wake the app when it is fully closed, so a reminder that comes due then appears on Home the next time you open UniBalance.',
      request, 'Continue', 'Allow system notifications?');
  }
  function request() { // runs inside the tap on Continue, which iOS requires
    const done = () => { render(); check(); };
    try { const p = Notification.requestPermission(done); if (p && p.then) p.then(done, done); } catch (e) { render(); }
  }

  const when = at => { const d = new Date(at); return DateUtil.label(DateUtil.iso(d)) + ', ' + DateUtil.pad(d.getHours()) + ':' + DateUtil.pad(d.getMinutes()); };
  function render() {
    const items = compute().slice(0, 5), box = $('home-reminders');
    box.hidden = !items.length;
    $('home-reminders-list').innerHTML = items.map(i =>
      `<div class="row tap" data-rem="${UI.esc(i.key)}" data-id="${i.t.id}"><div><b>${UI.esc(i.t.title)}</b><small>${i.due ? 'Reminder due' : 'Reminds ' + UI.esc(when(i.at))}${i.late ? ' · <span class="exp">Overdue</span>' : ''}</small></div><button class="link" data-dismiss aria-label="Dismiss reminder">Dismiss</button></div>`).join('');
    const p = permission(), st = $('notify-status'), btn = $('btn-notify');
    btn.hidden = !(enabled() && p === 'default');
    st.textContent = p === 'unsupported' ? 'Not available here. On iPhone, add UniBalance to your Home Screen (iOS 16.4 or later) and open it from there.'
      : p === 'denied' ? 'Blocked. Allow notifications for UniBalance in your device settings.'
      : p === 'granted' ? (enabled() ? 'On while the app is open.' : 'Allowed, but task reminders are off.')
      : (enabled() ? 'Not turned on yet.' : 'Turn on task reminders first.');
  }

  function init() {
    $('btn-notify').addEventListener('click', explain);
    $('home-reminders-list').addEventListener('click', e => {
      const r = e.target.closest('[data-rem]'); if (!r) return;
      if (e.target.closest('[data-dismiss]')) { RS().dismissed[r.dataset.rem] = true; Store.commit(); } else Tasks.edit(r.dataset.id);
    });
    Store.subscribe(() => check());
    setInterval(() => { if (!document.hidden) { check(); render(); } }, 30000);
  }
  return { init, render, check, compute, onEnabled: explain, permission };
})();
