/* University module: courses (weekday: Monday = 0 ... Sunday = 6). */
const University = (() => {
  let view = 'week';
  const courses = () => Store.data.courses;
  const find = id => courses().find(c => c.id === id);
  const order = () => DateUtil.order(Store.data.settings.weekStart);
  const byTime = (a, b) => a.startTime.localeCompare(b.startTime);

  function rowHtml(c, o = {}) {
    const nt = DateUtil.nowTime();
    const live = o.nowTime && c.startTime <= nt && nt < c.endTime;
    const sub = [o.showDay ? DateUtil.SHORT[c.weekday] : '', c.instructor].filter(Boolean).map(UI.esc).join(' · ');
    return `<div class="row tap" data-course="${c.id}"><div class="time"><b>${c.startTime}</b><small>${c.endTime}</small></div><div><b>${UI.esc(c.name)}</b>${sub ? `<small>${sub}</small>` : ''}</div>${live ? '<em class="tag hi">Now</em>' : ''}</div>`;
  }
  const forDate = d => courses().filter(c => c.weekday === DateUtil.wd(d)).sort(byTime);
  function bindList(el) { el.addEventListener('click', e => { const r = e.target.closest('[data-course]'); if (r) edit(r.dataset.course); }); }

  function save(ex, v) {
    if (!v.name) return 'Enter a course name.';
    if (!/^\d\d:\d\d$/.test(v.startTime) || !/^\d\d:\d\d$/.test(v.endTime)) return 'Set both a start and an end time.';
    if (v.endTime <= v.startTime) return 'The end time must be after the start time.';
    const c = ex || { id: Store.uid() };
    Object.assign(c, { name: v.name, instructor: v.instructor, weekday: Number(v.weekday), startTime: v.startTime, endTime: v.endTime });
    Store.upsert(courses(), c);
  }
  function edit(id) {
    const c = id ? find(id) : null;
    if (id && !c) return;
    UI.form({
      title: c ? 'Edit course' : 'New course',
      values: c || { weekday: DateUtil.wd(DateUtil.today()), startTime: '09:00', endTime: '10:30' },
      fields: [
        { name: 'name', label: 'Course name', ph: 'e.g. Linear Algebra' },
        { name: 'instructor', label: 'Instructor (optional)' },
        { name: 'weekday', label: 'Day', type: 'select', options: order().map(i => ({ v: i, l: DateUtil.DAYS[i] })) },
        { name: 'startTime', label: 'Starts', type: 'time', half: true },
        { name: 'endTime', label: 'Ends', type: 'time', half: true }
      ],
      onSave: v => save(c, v),
      onDelete: c ? () => Store.remove(courses(), c.id) : null,
      deleteMsg: c ? `Delete "${c.name}"? It will also disappear from the calendar.` : ''
    });
  }

  function render() {
    document.querySelectorAll('#uni-view button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    const el = document.getElementById('uni-body');
    if (!courses().length) { el.innerHTML = `<div class="glass l1 list">${UI.empty('No courses yet', 'Tap + to add your first course.')}</div>`; return; }
    const ord = order(), todayWd = DateUtil.wd(DateUtil.today());
    if (view === 'all') {
      const all = courses().slice().sort((a, b) => ord.indexOf(a.weekday) - ord.indexOf(b.weekday) || byTime(a, b));
      el.innerHTML = `<div class="glass l1 list">${all.map(c => rowHtml(c, { showDay: true })).join('')}</div>`;
      return;
    }
    el.innerHTML = ord.map(d => {
      const cs = courses().filter(c => c.weekday === d).sort(byTime);
      if (!cs.length) return '';
      return `<h2 class="sec">${DateUtil.DAYS[d]}${d === todayWd ? ' <em class="tag hi">Today</em>' : ''}</h2><div class="glass l1 list">${cs.map(c => rowHtml(c)).join('')}</div>`;
    }).join('');
  }

  function init() {
    UI.bind(document.getElementById('uni-view'), 'button', v => { view = v; render(); });
    bindList(document.getElementById('uni-body'));
    document.getElementById('add-course').addEventListener('click', () => edit());
  }
  return { init, render, edit, forDate, rowHtml, bindList };
})();
