/* Tasks module: CRUD, recurrence, completion, filtering. Recurring tasks are stored once; occurrences are computed. */
const Tasks = (() => {
  const PR = [{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }];
  const CAT = ['General', 'University', 'Personal', 'Work', 'Home', 'Health'];
  const REC = [{ v: 'none', l: 'Does not repeat' }, { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }];
  const S = { view: 'upcoming', pri: 'all', cat: 'all' };
  const list = () => Store.data.tasks;
  const cap = s => (s || 'medium').charAt(0).toUpperCase() + (s || 'medium').slice(1);
  const find = id => list().find(t => t.id === id);

  function occursOn(t, d) {
    if (!t.dueDate || d < t.dueDate) return false;
    const rec = t.recurrence || 'none';
    if (rec === 'none') return d === t.dueDate;
    if (rec === 'daily') return true;
    if (rec === 'weekly') return DateUtil.wd(d) === DateUtil.wd(t.dueDate);
    const dd = DateUtil.parse(d), anchor = DateUtil.parse(t.dueDate).getDate();
    const dim = new Date(dd.getFullYear(), dd.getMonth() + 1, 0).getDate();
    return dd.getDate() === Math.min(anchor, dim); // a 31st task falls on the last day of shorter months
  }
  const isDone = (t, d) => (t.recurrence || 'none') === 'none' ? t.status === 'done' : (t.completedDates || []).includes(d);
  function isOverdue(t, d) {
    if (isDone(t, d)) return false;
    const td = DateUtil.today();
    return d < td || (d === td && !!t.dueTime && t.dueTime < DateUtil.nowTime());
  }
  const mk = (t, d) => ({ t, d, done: isDone(t, d), late: isOverdue(t, d) });
  const cmp = (a, b) => (a.d + (a.t.dueTime || '99')).localeCompare(b.d + (b.t.dueTime || '99'));

  function items() {
    const td = DateUtil.today(), from = DateUtil.addDays(td, -14), out = [];
    for (const t of list()) {
      if (!t.dueDate) continue;
      if (!t.recurrence || t.recurrence === 'none') { out.push(mk(t, t.dueDate)); continue; }
      for (let d = t.dueDate > from ? t.dueDate : from; d <= td; d = DateUtil.addDays(d, 1)) {
        if (occursOn(t, d) && (isDone(t, d) || d < td)) out.push(mk(t, d)); // recent completed + overdue occurrences
      }
      for (let i = 0, d = td; i <= 366; i++, d = DateUtil.addDays(d, 1)) {
        if (occursOn(t, d) && !isDone(t, d)) { out.push(mk(t, d)); break; } // next open occurrence
      }
    }
    return out;
  }
  const onDate = d => list().filter(t => occursOn(t, d)).map(t => mk(t, d));

  function toggle(id, d) {
    const t = find(id); if (!t) return;
    if ((t.recurrence || 'none') === 'none') t.status = t.status === 'done' ? 'open' : 'done';
    else {
      const c = t.completedDates || (t.completedDates = []);
      const i = c.indexOf(d); i < 0 ? c.push(d) : c.splice(i, 1);
    }
    Store.commit();
  }

  function rowHtml(it, showDate = true) {
    const t = it.t;
    const when = (showDate ? DateUtil.label(it.d) + (t.dueTime ? ', ' : '') : '') + (t.dueTime || '');
    const sub = [t.category, when, t.recurrence && t.recurrence !== 'none' ? 'Repeats ' + t.recurrence : ''].filter(Boolean).map(UI.esc).join(' · ');
    return `<div class="row tap${it.late ? ' overdue' : ''}${it.done ? ' done' : ''}" data-task="${t.id}"><button class="check${it.done ? ' on' : ''}" data-chk data-d="${it.d}" aria-label="${it.done ? 'Mark as not done' : 'Mark as done'}"></button><div><b>${UI.esc(t.title)}</b><small>${sub}${it.late ? ' · <span class="exp">Overdue</span>' : ''}</small></div><em class="tag${t.priority === 'high' ? ' hi' : ''}">${cap(t.priority)}</em></div>`;
  }
  function bindList(el) {
    el.addEventListener('click', e => {
      const r = e.target.closest('[data-task]'); if (!r) return;
      const c = e.target.closest('[data-chk]');
      c ? toggle(r.dataset.task, c.dataset.d) : edit(r.dataset.task);
    });
  }

  function save(ex, v) {
    if (!v.title) return 'Enter a title.';
    if (!DateUtil.isValid(v.dueDate)) return 'Choose a due date.';
    if (v.reminderAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.reminderAt)) return 'The reminder date and time is not valid.';
    const t = ex || { id: Store.uid(), status: 'open', completedDates: [] };
    Object.assign(t, { title: v.title, description: v.description, dueDate: v.dueDate, dueTime: v.dueTime, priority: v.priority, category: v.category, recurrence: v.recurrence, reminderAt: v.reminderAt });
    Store.upsert(list(), t);
  }
  function edit(id, date) {
    const t = id ? find(id) : null;
    if (id && !t) return;
    const cats = t && !CAT.includes(t.category) && t.category ? [...CAT, t.category] : CAT;
    UI.form({
      title: t ? 'Edit task' : 'New task',
      values: t || { dueDate: date || DateUtil.today(), priority: 'medium', category: 'General', recurrence: 'none' },
      fields: [
        { name: 'title', label: 'Title', ph: 'What needs to be done?' },
        { name: 'description', label: 'Description (optional)', type: 'textarea' },
        { name: 'dueDate', label: 'Due date', type: 'date', half: true },
        { name: 'dueTime', label: 'Due time (optional)', type: 'time', half: true },
        { name: 'priority', label: 'Priority', type: 'seg', options: PR },
        { name: 'category', label: 'Category', type: 'select', options: cats.map(c => ({ v: c, l: c })) },
        { name: 'recurrence', label: 'Repeat', type: 'select', options: REC },
        { name: 'reminderAt', label: 'Reminder (optional)', type: 'datetime-local' }
      ],
      onSave: v => save(t, v),
      onDelete: t ? () => Store.remove(list(), t.id) : null,
      deleteMsg: t && t.recurrence !== 'none' ? 'Delete this task and all of its repeats?' : 'Delete this task? This cannot be undone.'
    });
  }

  function render() {
    document.querySelectorAll('#tasks-view button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
    document.querySelectorAll('#tasks-pri button').forEach(b => b.classList.toggle('on', b.dataset.v === S.pri));
    let a = items().filter(i => (S.view === 'upcoming' ? !i.done && !i.late : S.view === 'overdue' ? i.late : i.done)
      && (S.pri === 'all' || i.t.priority === S.pri) && (S.cat === 'all' || i.t.category === S.cat));
    a.sort(cmp); if (S.view === 'done') a.reverse();
    const msg = { upcoming: ['Nothing upcoming', 'Tap + to add a task.'], overdue: ['Nothing overdue', 'You are all caught up.'], done: ['No completed tasks', 'Tasks you complete will show up here.'] }[S.view];
    const filtered = S.pri !== 'all' || S.cat !== 'all';
    document.getElementById('tasks-list').innerHTML = a.length ? a.map(i => rowHtml(i)).join('') : UI.empty(filtered ? 'No matching tasks' : msg[0], filtered ? 'Try a different priority or category.' : msg[1]);
  }

  function init() {
    const cs = document.getElementById('tasks-cat');
    cs.innerHTML = '<option value="all">All categories</option>' + CAT.map(c => `<option>${c}</option>`).join('');
    cs.addEventListener('change', () => { S.cat = cs.value; render(); });
    UI.bind(document.getElementById('tasks-view'), 'button', v => { S.view = v; render(); });
    UI.bind(document.getElementById('tasks-pri'), 'button', v => { S.pri = v; render(); });
    bindList(document.getElementById('tasks-list'));
    document.getElementById('add-task').addEventListener('click', () => edit());
  }
  return { init, render, edit, toggle, occursOn, isDone, isOverdue, items, onDate, rowHtml, bindList, cmp };
})();
