/* Finance module. Balance is always computed: initialBalance + income - expenses. Amounts are whole-number integers
   in the selected currency (Toman by default). The currency setting is a display label only; amounts are not converted. */
const Finance = (() => {
  const CUR = { IRT: { pre: '', suf: ' Toman', name: 'Toman' }, IRR: { pre: '', suf: ' Rial', name: 'Rial' }, USD: { pre: '$', suf: '', name: 'USD' }, EUR: { pre: '€', suf: '', name: 'EUR' } };
  const cur = () => CUR[Store.data.settings.currency] || CUR.IRT;
  const nf = new Intl.NumberFormat('en-US');
  const F = () => Store.data.finance;
  const money = n => (n < 0 ? '−' : '') + cur().pre + nf.format(Math.abs(n)) + cur().suf;

  function totals() {
    let inc = 0, exp = 0;
    F().transactions.forEach(t => { t.type === 'income' ? inc += t.amount : exp += t.amount; });
    return { inc, exp, balance: F().initialBalance + inc - exp };
  }
  function parseAmount(s, allowNegative) {
    const x = String(s).replace(/[,\s]/g, '');
    if (!(allowNegative ? /^-?\d{1,13}$/ : /^\d{1,13}$/).test(x)) return null;
    return Number(x) || 0;
  }

  function editInitial() {
    UI.form({
      title: 'Starting balance', submit: 'Save balance',
      values: { amount: F().initialBalance },
      fields: [{ name: 'amount', label: 'Balance before your first transaction (' + cur().name + ')', mode: 'numeric' }],
      onSave: v => {
        const n = parseAmount(v.amount, true);
        if (n === null) return 'Enter a whole number using digits 0-9.';
        F().initialBalance = n; Store.commit();
      }
    });
  }
  function edit(id) {
    const t = id ? F().transactions.find(x => x.id === id) : null;
    if (id && !t) return;
    UI.form({
      title: t ? 'Edit transaction' : 'New transaction',
      values: t || { type: 'expense', date: DateUtil.today() },
      fields: [
        { name: 'type', label: 'Type', type: 'seg', options: [{ v: 'income', l: 'Income' }, { v: 'expense', l: 'Expense' }] },
        { name: 'amount', label: 'Amount (' + cur().name + ')', mode: 'numeric', ph: '0' },
        { name: 'description', label: 'Description', ph: 'e.g. Groceries' },
        { name: 'date', label: 'Date', type: 'date' }
      ],
      onSave: v => {
        const n = parseAmount(v.amount, false);
        if (n === null || n <= 0) return 'Enter a whole number above zero using digits 0-9.';
        if (!v.description) return 'Enter a description.';
        if (!DateUtil.isValid(v.date)) return 'Choose a date.';
        const tx = t || { id: Store.uid() };
        Object.assign(tx, { type: v.type, amount: n, description: v.description, date: v.date });
        Store.upsert(F().transactions, tx);
      },
      onDelete: t ? () => Store.remove(F().transactions, t.id) : null,
      deleteMsg: 'Delete this transaction? Your balance will be recalculated.'
    });
  }

  function render() {
    const { inc, exp, balance } = totals(), c = cur();
    const num = nf.format(Math.abs(balance));
    document.getElementById('fin-hero').innerHTML =
      `<small class="muted">Current balance</small><div class="balance">${balance < 0 ? '−' : ''}${c.pre}${num}<span>${c.suf}</span></div>` +
      `<div class="split"><div><small class="muted">Income</small><b class="inc">+ ${c.pre}${nf.format(inc)}</b></div><div><small class="muted">Expenses</small><b class="exp">− ${c.pre}${nf.format(exp)}</b></div></div>` +
      `<div class="start"><small class="muted">Starting balance ${money(F().initialBalance)}</small><button class="link" data-initial>Edit</button></div>`;
    const tx = F().transactions.map((t, i) => ({ t, i })).sort((a, b) => b.t.date.localeCompare(a.t.date) || b.i - a.i);
    document.getElementById('fin-list').innerHTML = tx.length ? tx.map(({ t }) =>
      `<div class="row tap" data-tx="${t.id}"><span class="dot ${t.type === 'income' ? 'inc-dot' : 'exp-dot'}"></span><div><b>${UI.esc(t.description)}</b><small>${UI.esc(DateUtil.label(t.date))}</small></div><b class="${t.type === 'income' ? 'inc' : 'exp'}">${t.type === 'income' ? '+' : '−'} ${c.pre}${nf.format(t.amount)}</b></div>`).join('')
      : UI.empty('No transactions yet', 'Tap + to record income or an expense.');
  }

  function init() {
    document.getElementById('add-tx').addEventListener('click', () => edit());
    document.getElementById('fin-hero').addEventListener('click', e => { if (e.target.closest('[data-initial]')) editInitial(); });
    document.getElementById('fin-list').addEventListener('click', e => { const r = e.target.closest('[data-tx]'); if (r) edit(r.dataset.tx); });
  }
  return { init, render, totals, money, edit };
})();
