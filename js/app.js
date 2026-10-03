/* App orchestrator: navigation, module start-up, re-rendering after data changes, PWA registration. */
const App = (() => {
  const screens = ['home', 'university', 'tasks', 'finance', 'calendar'];
  const modules = () => [Home, University, Tasks, Finance, CalendarView, Notifications];
  const renderAll = () => modules().forEach(m => m.render());

  function go(name) {
    if (!screens.includes(name)) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.go === name;
      t.classList.toggle('active', on);
      on ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current');
    });
    document.getElementById('screen-' + name).scrollTop = 0;
    history.replaceState(null, '', '#' + name);
  }

  function pwa() { // install status and service worker (needs https:// or localhost)
    const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    document.getElementById('install-status').textContent = standalone
      ? 'UniBalance is running as an installed app.'
      : 'UniBalance is running in the browser. Add it to your Home Screen to install it.';
    const off = document.getElementById('offline-status');
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) {
      off.textContent = 'Offline support needs UniBalance to be opened over HTTPS.'; return;
    }
    navigator.serviceWorker.register('service-worker.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => { off.textContent = 'Offline ready: UniBalance opens without a connection after this first load. Your data stays on this device.'; })
      .catch(() => { off.textContent = 'Offline support could not be started in this browser.'; });
  }

  function init() {
    UI.init();
    Store.load();
    if (Store.notice) UI.toast(Store.notice, 9000);
    document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));
    modules().forEach(m => m.init());
    Settings.init();
    Store.subscribe(renderAll);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderAll(); Notifications.check(); } }); // refresh time-based states
    renderAll();
    Notifications.check();
    go(location.hash.slice(1) || 'home');
    pwa();
  }
  document.addEventListener('DOMContentLoaded', init);
  return { go };
})();
