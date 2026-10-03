/* Calendar module: month view built from University courses, Tasks (incl. recurrences) and personal events. Only events are stored here. */
const CalendarView = (() => {
  const S = { view: DateUtil.today().slice(0, 8) + '01', sel: DateUtil.today() };
  const events = () => Store.data.events;
  const eventsOn = d => events().filter(e => e.date === d);

  function saveEvent(ex, v) {
    if (!v.title) return 'Enter a title.';
    if (!DateUtil.isValid(v.date)) return 'Choose a date.';
    if (v.endTime && !v.startTime) return 'Add a start time, or clear the end time.';
    if (v.startTime && v.endTime && v.endTime <= v.startTime) return 'The end time must be after the start time.';
    const e = ex || { id: Store.uid() };
    Object.assign(e, { title: v.title, date: v.date, startTime: v.startTime, endTime: v.endTime, notes: v.notes });
    Store.upsert(events(), e);
    S.sel = v.date; S.view = v.date.slice(0, 8) + '01';
  }
  function editEvent(id, date) {
    const e = id ? events().find(x => x.id === id) : null;
    if (id && !e) return;
    UI.form({
      title: e ? 'Edit event' : 'New event',
      values: e || { date: date || S.sel },
      fields: [
        { name: 'title', label: 'Title', ph: 'e.g. Dentist appointment' },
        { name: 'date', label: 'Date', type: 'date' },
        { name: 'startTime', label: 'Starts (optional)', type: 'time', half: true },
        { name: 'endTime', label: 'Ends (optional)', type: 'time', half: true },
        { name: 'notes', label: 'Notes (optional)', type: 'textarea' }
      ],
      onSave: v => saveEvent(e, v),
      onDelete: e ? () => Store.remove(events(), e.id) : null,
      deleteMsg: 'Delete this event? This cannot be undone.'
    });
  }

  function render() {
    const m = DateUtil.mode(), vd = DateUtil.parse(S.view), td = DateUtil.today();
    const mp = DateUtil.parts(vd, { month: 'long', year: 'numeric' });
    document.getElementById('cal-month').textContent = m === 'jalali' ? mp.j : mp.g;
    document.getElementById('cal-jalali').textContent = m === 'both' ? mp.j : '';
    const ord = DateUtil.order(Store.data.settings.weekStart);
    const grid = document.getElementById('cal-grid');
    let h = ord.map(i => `<div class="dow">${DateUtil.SHORT[i]}</div>`).join('');
    const start = DateUtil.addDays(S.view, -ord.indexOf(DateUtil.wd(S.view)));
    for (let i = 0; i < 42; i++) {
      const d = DateUtil.addDays(start, i), tk = Tasks.onDate(d);
      const dots = (University.forDate(d).length ? '<i></i>' : '') + (tk.length ? '<i class="t"></i>' : '') + (eventsOn(d).length ? '<i class="e"></i>' : '');
      const p = DateUtil.parts(d, { weekday: 'long', month: 'long', day: 'numeric' });
      h += `<button data-d="${d}" class="${d.slice(0, 7) !== S.view.slice(0, 7) ? 'out ' : ''}${d === td ? 'today ' : ''}${d === S.sel ? 'sel' : ''}" aria-label="${p.g}"><span>${Number(d.slice(8))}</span>${m === 'greg' ? '' : `<i class="j">${DateUtil.jalaliDay(d)}</i>`}<span class="mk">${dots}</span></button>`;
    }
    grid.innerHTML = h;

    const sp = DateUtil.parts(S.sel, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('cal-selected').innerHTML = (m === 'jalali' ? UI.esc(sp.j) : UI.esc(sp.g)) + (m === 'both' ? ` <small class="muted">${UI.esc(sp.j)}</small>` : '');
    const rows = [];
    University.forDate(S.sel).forEach(c => rows.push({ k: c.startTime, h: University.rowHtml(c) }));
    Tasks.onDate(S.sel).forEach(i => rows.push({ k: i.t.dueTime || '99', h: Tasks.rowHtml(i, false) }));
    eventsOn(S.sel).forEach(e => rows.push({ k: e.startTime || '00:00', h: `<div class="row tap" data-event="${e.id}"><div class="time">${e.startTime ? `<b>${e.startTime}</b><small>${e.endTime || ''}</small>` : '<b>All</b><small>day</small>'}</div><div><b>${UI.esc(e.title)}</b>${e.notes ? `<small>${UI.esc(e.notes)}</small>` : ''}</div><em class="tag">Event</em></div>` }));
    rows.sort((a, b) => a.k.localeCompare(b.k));
    document.getElementById('cal-day').innerHTML = rows.length ? rows.map(r => r.h).join('') : UI.empty('Nothing scheduled', 'Classes, tasks and events for this day will appear here.');
  }

  function shift(n) { const d = DateUtil.parse(S.view); S.view = DateUtil.iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); render(); }
  function init() {
    document.getElementById('cal-prev').addEventListener('click', () => shift(-1));
    document.getElementById('cal-next').addEventListener('click', () => shift(1));
    document.getElementById('add-event').addEventListener('click', () => editEvent());
    document.getElementById('cal-grid').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) { S.sel = b.dataset.d; render(); } });
    const day = document.getElementById('cal-day');
    Tasks.bindList(day); University.bindList(day);
    day.addEventListener('click', e => { const r = e.target.closest('[data-event]'); if (r) editEvent(r.dataset.event); });
  }
  return { init, render };
})();
