/* Home module: live clock, device-based Gregorian/Jalali dates, today's classes, open tasks. */
const Home = (() => {
  let lastMin = -1, lastDay = '';
  const FULL = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

  function dates() {
    const m = DateUtil.mode(), p = DateUtil.parts(new Date(), FULL);
    const g = document.getElementById('date-greg'), j = document.getElementById('date-jalali');
    g.textContent = p.g; j.textContent = p.j;
    g.hidden = m === 'jalali'; j.hidden = m === 'greg';
    j.classList.toggle('muted', m === 'both');
  }
  function lists() {
    const td = DateUtil.today(), nt = DateUtil.nowTime();
    const cl = University.forDate(td);
    document.getElementById('home-classes').innerHTML = cl.length ? cl.map(c => University.rowHtml(c, { nowTime: true })).join('') : UI.empty('No classes today', 'Your schedule is clear.');
    const ts = Tasks.items().filter(i => !i.done).sort(Tasks.cmp).slice(0, 5);
    document.getElementById('home-tasks').innerHTML = ts.length ? ts.map(i => Tasks.rowHtml(i)).join('') : UI.empty('No open tasks', 'Add one from the Tasks tab.');
  }
  function tick() {
    const now = new Date();
    document.getElementById('clock').textContent = DateUtil.pad(now.getHours()) + ':' + DateUtil.pad(now.getMinutes());
    const h = now.getHours();
    document.getElementById('greeting').textContent = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const day = DateUtil.iso(now);
    if (day !== lastDay) { lastDay = day; dates(); }
    if (now.getMinutes() !== lastMin) { lastMin = now.getMinutes(); lists(); } // overdue and "Now" states depend on the time
  }
  function render() { dates(); lists(); }
  function init() {
    University.bindList(document.getElementById('home-classes'));
    Tasks.bindList(document.getElementById('home-tasks'));
    tick(); setInterval(tick, 1000);
  }
  return { init, render };
})();
