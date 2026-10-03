/* Date utilities. All dates are device-local strings: 'YYYY-MM-DD' and 'HH:MM'. Jalali uses the built-in Intl API. */
const DateUtil = (() => {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isValid = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(parse(s)) === s;
  const today = () => iso(new Date());
  const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const wd = s => (parse(s).getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SHORT = DAYS.map(d => d.slice(0, 3));
  const order = ws => ws === 'sat' ? [5, 6, 0, 1, 2, 3, 4] : ws === 'sun' ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
  const mode = () => (typeof Store !== 'undefined' && Store.data.settings.dateDisplay) || 'both';
  const jDay = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { day: 'numeric' });

  function parts(d, opts) { // returns { g: Gregorian text, j: Jalali text } with Latin numerals
    const date = typeof d === 'string' ? parse(d) : d;
    return {
      g: new Intl.DateTimeFormat('en-US', opts).format(date),
      j: new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', opts).format(date)
    };
  }
  function label(s) {
    const td = today();
    if (s === td) return 'Today';
    if (s === addDays(td, 1)) return 'Tomorrow';
    if (s === addDays(td, -1)) return 'Yesterday';
    const p = parts(s, { weekday: 'short', month: 'short', day: 'numeric' });
    return mode() === 'jalali' ? p.j : p.g;
  }
  const jalaliDay = s => jDay.format(parse(s));
  return { pad, iso, parse, isValid, today, nowTime, addDays, wd, DAYS, SHORT, order, mode, parts, label, jalaliDay };
})();
