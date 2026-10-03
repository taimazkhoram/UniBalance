/* Single source of truth. Modules read Store.data and change it only through Store.upsert / Store.remove / Store.commit.
   Stage 4: full validation, schema versioning + migrations, JSON export and import. Balance is never stored. */
const Store = (() => {
  const KEY = 'unibalance:v1', SCHEMA = 1, MAXAMT = 1e13;
  // MIGRATIONS[n] upgrades data from schema n to n+1. Add an entry here whenever the stored shape changes.
  const MIGRATIONS = {};
  const defaults = () => ({
    meta: { schemaVersion: SCHEMA },
    settings: { remindersEnabled: false, currency: 'IRT', weekStart: 'mon', dateDisplay: 'both' },
    courses: [], tasks: [], events: [],
    finance: { initialBalance: 0, transactions: [] }, // whole-number integers
    reminderState: { fired: {}, dismissed: {} }
  });
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const subs = [];
  const api = { data: defaults(), notice: '', SCHEMA };

  const timeOk = s => typeof s === 'string' && /^\d\d:\d\d$/.test(s) && +s.slice(0, 2) < 24 && +s.slice(3) < 60;
  const dtOk = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && DateUtil.isValid(s.slice(0, 10)) && timeOk(s.slice(11));
  const str = (v, d = '') => typeof v === 'string' ? v.trim() : d;
  const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pick = (v, allowed, def, t) => { if (v == null) return def; if (allowed.includes(v)) return v; t.fixed++; return def; };
  const optTime = (v, t) => { if (v == null || v === '') return ''; if (timeOk(v)) return v; t.fixed++; return ''; };

  // Record sanitizers: return a clean record, or null when the record cannot be repaired.
  const REC = {
    course(c) {
      const name = str(c.name);
      if (!name || !intIn(c.weekday, 0, 6) || !timeOk(c.startTime) || !timeOk(c.endTime) || c.endTime <= c.startTime) return null;
      return { name, instructor: str(c.instructor), weekday: c.weekday, startTime: c.startTime, endTime: c.endTime };
    },
    task(k, t) {
      const title = str(k.title);
      if (!title || !DateUtil.isValid(k.dueDate)) return null;
      const cd = [];
      if (Array.isArray(k.completedDates)) k.completedDates.forEach(d => { if (!DateUtil.isValid(d)) t.fixed++; else if (!cd.includes(d)) cd.push(d); });
      else if (k.completedDates != null) t.fixed++;
      const ra = k.reminderAt;
      return {
        title, description: str(k.description), dueDate: k.dueDate, dueTime: optTime(k.dueTime, t),
        priority: pick(k.priority, ['low', 'medium', 'high'], 'medium', t), category: str(k.category) || 'General',
        recurrence: pick(k.recurrence, ['none', 'daily', 'weekly', 'monthly'], 'none', t),
        status: pick(k.status, ['open', 'done'], 'open', t), completedDates: cd,
        reminderAt: ra == null || ra === '' ? '' : dtOk(ra) ? ra : (t.fixed++, '')
      };
    },
    event(e, t) {
      const title = str(e.title);
      if (!title || !DateUtil.isValid(e.date)) return null;
      let st = optTime(e.startTime, t), en = optTime(e.endTime, t);
      if (en && (!st || en <= st)) { en = ''; t.fixed++; }
      return { title, date: e.date, startTime: st, endTime: en, notes: str(e.notes) };
    },
    tx(x, t) {
      if ((x.type !== 'income' && x.type !== 'expense') || !intIn(x.amount, 1, MAXAMT) || !DateUtil.isValid(x.date)) return null;
      return { type: x.type, amount: x.amount, description: str(x.description) || (t.fixed++, 'Transaction'), date: x.date };
    }
  };
  function list(arr, fn, t, label) {
    const out = [], seen = new Set();
    arr.forEach((it, i) => {
      const r = isObj(it) ? fn(it, t) : null;
      if (!r) { t.dropped++; t.msgs.push(label + ' ' + (i + 1)); return; }
      let id = typeof it.id === 'string' && it.id ? it.id : '';
      if (!id || seen.has(id)) { id = uid(); t.fixed++; }
      seen.add(id); out.push(Object.assign({ id }, r));
    });
    return out;
  }
  const cleanMap = o => { const r = {}; if (isObj(o)) Object.keys(o).forEach(k => { if (k !== '__proto__' && ['string', 'number', 'boolean'].includes(typeof o[k])) r[k] = o[k]; }); return r; };

  // Validate raw data of the current schema. strict = import mode (every section must be present and valid).
  function validate(raw, strict) {
    const t = { dropped: 0, fixed: 0, msgs: [] }, d = defaults();
    const sec = (v, arr, label) => {
      if (arr ? Array.isArray(v) : isObj(v)) return true;
      if (strict) { t.dropped++; t.msgs.push('missing ' + label); } else if (v != null) t.fixed++;
      return false;
    };
    if (sec(raw.settings, false, 'settings')) {
      const s = raw.settings;
      if (s.remindersEnabled != null && typeof s.remindersEnabled !== 'boolean') t.fixed++;
      d.settings = {
        remindersEnabled: s.remindersEnabled === true,
        currency: pick(s.currency, ['IRT', 'IRR', 'USD', 'EUR'], 'IRT', t),
        weekStart: pick(s.weekStart, ['sat', 'sun', 'mon'], 'mon', t),
        dateDisplay: pick(s.dateDisplay, ['both', 'greg', 'jalali'], 'both', t)
      };
    }
    if (sec(raw.courses, true, 'courses')) d.courses = list(raw.courses, REC.course, t, 'course');
    if (sec(raw.tasks, true, 'tasks')) d.tasks = list(raw.tasks, REC.task, t, 'task');
    if (sec(raw.events, true, 'events')) d.events = list(raw.events, REC.event, t, 'event');
    if (sec(raw.finance, false, 'finance')) {
      const ib = raw.finance.initialBalance;
      if (ib == null) d.finance.initialBalance = 0;
      else if (intIn(ib, -MAXAMT, MAXAMT)) d.finance.initialBalance = ib;
      else t.fixed++;
      if (sec(raw.finance.transactions, true, 'transactions')) d.finance.transactions = list(raw.finance.transactions, REC.tx, t, 'transaction');
    }
    if (!strict && isObj(raw.reminderState)) d.reminderState = { fired: cleanMap(raw.reminderState.fired), dismissed: cleanMap(raw.reminderState.dismissed) };
    return { data: d, tally: t };
  }

  // Upgrade raw data from schema `from` to `to` one step at a time.
  function migrate(raw, from, to = SCHEMA, table = MIGRATIONS) {
    let d = raw;
    for (let v = from; v < to; v++) {
      if (typeof table[v] !== 'function') throw new Error('No migration from schema ' + v);
      d = table[v](d);
      d.meta = Object.assign({}, d.meta, { schemaVersion: v + 1 });
    }
    return d;
  }
  const countsOf = d => ({ courses: d.courses.length, tasks: d.tasks.length, events: d.events.length, transactions: d.finance.transactions.length });

  api.load = () => {
    api.notice = '';
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    const keep = (msg, empty) => { // never destroy the original: store a copy and tell the user
      try { localStorage.setItem(KEY + ':recovery', raw); } catch (_) {}
      api.notice = msg; if (empty) api.data = defaults();
    };
    let p;
    try { p = JSON.parse(raw); } catch (e) { return keep('Saved data could not be read. A copy was kept and UniBalance started empty.', true); }
    if (!isObj(p)) return keep('Saved data was not in the expected format. A copy was kept and UniBalance started empty.', true);
    const v = p.meta && p.meta.schemaVersion !== undefined ? p.meta.schemaVersion : 1;
    if (!Number.isInteger(v) || v < 1) return keep('Saved data has an invalid version. A copy was kept and UniBalance started empty.', true);
    if (v > SCHEMA) return keep('Saved data is from a newer version of UniBalance. A copy was kept and UniBalance started empty.', true);
    let m;
    try { m = migrate(p, v); } catch (e) { return keep('Saved data could not be upgraded. A copy was kept and UniBalance started empty.', true); }
    const r = validate(m, false);
    api.data = r.data;
    if (r.tally.dropped || r.tally.fixed) keep(`${r.tally.dropped} saved item(s) were skipped and ${r.tally.fixed} value(s) repaired. A copy of the original data was kept.`, false);
  };

  // ---- backup ----
  api.exportJSON = () => JSON.stringify({
    app: 'UniBalance', kind: 'backup', schemaVersion: SCHEMA, exportedAt: new Date().toISOString(),
    data: { settings: api.data.settings, courses: api.data.courses, tasks: api.data.tasks, events: api.data.events, finance: api.data.finance }
  }, null, 2);
  api.exportName = () => 'UniBalance-backup-' + DateUtil.today() + '.json';

  // Validates a backup file's text. Never touches current data. Returns { ok, data, counts, exportedAt } or { ok:false, error }.
  api.parseBackup = text => {
    const bad = error => ({ ok: false, error });
    let f;
    try { f = JSON.parse(text); } catch (e) { return bad('This file is not valid JSON.'); }
    if (!isObj(f) || f.app !== 'UniBalance' || f.kind !== 'backup') return bad('This is not a UniBalance backup file.');
    if (!Number.isInteger(f.schemaVersion) || f.schemaVersion < 1) return bad('The backup has no valid version number.');
    if (f.schemaVersion > SCHEMA) return bad('This backup was made by a newer version of UniBalance and cannot be imported here.');
    if (!isObj(f.data)) return bad('The backup has no data section.');
    let m;
    try { m = migrate(Object.assign({ meta: { schemaVersion: f.schemaVersion } }, f.data), f.schemaVersion); } catch (e) { return bad('This backup version cannot be upgraded.'); }
    const r = validate(m, true), t = r.tally;
    if (t.dropped || t.fixed) return bad(`The backup contains invalid or missing data${t.msgs.length ? ' (' + t.msgs.slice(0, 3).join(', ') + ')' : ''}.`);
    return { ok: true, data: r.data, counts: countsOf(r.data), exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt.slice(0, 10) : '' };
  };
  // Replaces all data with already-validated data. Keeps a copy of the previous data; on any storage failure nothing changes.
  api.replace = d => {
    try {
      localStorage.setItem(KEY + ':before-import', JSON.stringify(api.data));
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) { return false; }
    api.data = d;
    subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    return true;
  };

  api.uid = uid;
  api.counts = () => countsOf(api.data);
  api.migrate = migrate;
  api.subscribe = fn => subs.push(fn);
  api.commit = () => {
    let ok = true;
    try { localStorage.setItem(KEY, JSON.stringify(api.data)); }
    catch (e) { ok = false; if (typeof UI !== 'undefined') UI.toast('Could not save. Storage may be full or blocked.'); }
    subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    return ok;
  };
  api.upsert = (arr, item) => { const i = arr.findIndex(x => x.id === item.id); i < 0 ? arr.push(item) : (arr[i] = item); return api.commit(); };
  api.remove = (arr, id) => { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); return api.commit(); };
  return api;
})();
