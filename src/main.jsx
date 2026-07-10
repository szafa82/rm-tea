import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Users, Wallet, ReceiptText, BarChart3, Package, Image, Settings as SettingsIcon,
  Plus, Search, Bell, Download, Coffee, ShieldCheck, RefreshCw, AlertTriangle, X, Save, ChevronDown, ChevronRight
} from 'lucide-react';
import { loadTeaClub, saveMembersToTeaClub, saveTransactionsToTeaClub } from './services/firestore.js';
import './style.css';

const APP_VERSION = 'V6.4 MEMBERS + TRANSACTIONS';
const YEAR = 2026;
const START_MONTH_INDEX = 6; // July 2026
const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthNames = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

function toMoney(value) {
  const number = Number(value || 0);
  return `£${number.toFixed(2)}`;
}

function monthKey(index) {
  return `${YEAR}-${String(index + 1).padStart(2, '0')}`;
}

function monthToIndex(value) {
  if (typeof value === 'number') return value >= 0 && value <= 11 ? value : null;
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  const iso = text.match(/(20\d{2})-(\d{2})/);
  if (iso) {
    const index = Number(iso[2]) - 1;
    return index >= 0 && index <= 11 ? index : null;
  }
  const first = text.split(/\s|\//)[0];
  return monthNames[first] ?? null;
}

function normalizePaidMonths(member) {
  const source = member.paidMonths || member.monthsPaid || [];
  if (!Array.isArray(source)) return [];
  return [...new Set(source.map(monthToIndex).filter(index => index !== null))].sort((a, b) => a - b);
}

function normalizeMonthStatuses(member) {
  const statuses = { ...(member.monthStatuses || member.statusByMonth || {}) };
  normalizePaidMonths(member).forEach(index => {
    if (index >= START_MONTH_INDEX) statuses[monthKey(index)] = 'paid';
  });
  return statuses;
}

function automaticMonthStatus(index, paid) {
  if (index < START_MONTH_INDEX) return 'inactive';
  if (paid.includes(index)) return 'paid';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (YEAR < currentYear || (YEAR === currentYear && index < currentMonth)) return 'overdue';
  if (YEAR === currentYear && index === currentMonth) return 'due';
  return 'future';
}

function getMonthStatus(member, index) {
  if (index < START_MONTH_INDEX) return 'inactive';
  const saved = member.monthStatuses?.[monthKey(index)];
  if (['paid', 'due', 'overdue', 'future'].includes(saved)) return saved;
  return automaticMonthStatus(index, member.paid || []);
}

function getMonthCounts(member) {
  return monthLabels.reduce((acc, _month, index) => {
    const status = getMonthStatus(member, index);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function normalizeMember(member, index) {
  const name = String(member.name || member.member || member.fullName || `Member ${index + 1}`).trim();
  const category = member.monthlyCategory || member.category || member.status || 'ACTIVE';
  const notes = member.notes || member.monthlyNotes || member.note || '';
  const paid = normalizePaidMonths(member);
  const monthStatuses = normalizeMonthStatuses(member);
  const monthlyOutstanding = Number(member.monthlyOutstanding ?? member.monthlyDue ?? 0);
  const oldDebt = Number(member.oldDebt ?? member.weeklyDue ?? 0);
  const credit = Number(member.credit ?? member.paidCredited ?? 0);
  const resigned = String(category).toLowerCase().includes('resign') || String(member.status || '').toLowerCase().includes('left');
  const base = {
    raw: member,
    id: member.id ?? `${name}-${index}`,
    name,
    tag: resigned ? 'Left / resigned' : String(category || 'ACTIVE'),
    paid,
    monthStatuses,
    note: notes || member.weeklyStatus || 'No notes',
    resigned,
    monthlyFee: Number(member.monthlyFee ?? 5),
    weeklyFee: Number(member.weeklyFee ?? 1),
    monthlyOutstanding,
    oldDebt,
    credit,
    lastPaidWeek: member.lastPaidWeek || member.endWeek || '-',
    weeklyStatus: member.weeklyStatus || '-'
  };
  const counts = getMonthCounts(base);
  const monthDebt = (counts.overdue || 0) * base.monthlyFee + (counts.due || 0) * base.monthlyFee;
  base.due = Math.max(0, monthlyOutstanding + oldDebt + monthDebt - credit);
  base.counts = counts;
  return base;
}

function normalizeTransaction(tx, index) {
  const income = Number(tx.income ?? tx.payment ?? tx.paid ?? 0);
  const expense = Number(tx.expense ?? tx.spent ?? 0);
  const amount = Number(tx.amount ?? (income - expense));
  const description = tx.description || tx.descript || tx.notes || tx.note || tx.category || 'Transaction';
  const months = Array.isArray(tx.months) ? tx.months : (tx.month ? [tx.month] : []);

  return {
    id: tx.id || tx.ref || `TX-${String(index + 1).padStart(4, '0')}`,
    date: tx.date || tx.createdAt || tx.week || '-',
    type: tx.type || (amount >= 0 ? 'Payment' : 'Expense'),
    member: tx.member || tx.name || (amount >= 0 ? 'Unknown member' : 'Tea Club'),
    category: tx.category || description,
    description,
    amount,
    months
  };
}

function App() {
  const [active, setActive] = useState('Members');
  const [query, setQuery] = useState('');
  const [hideLeftMembers, setHideLeftMembers] = useState(false);
  const [status, setStatus] = useState('Loading Firestore...');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [clubData, setClubData] = useState({
    members: [], transactions: [], months: [], dashboardRows: [], messages: [], weekly: [], transition: [], rawMembers: [], raw: {}
  });

  async function refreshData() {
    try {
      setError('');
      setStatus('Loading Firestore...');
      const firestore = await loadTeaClub();
      const data = firestore?.data || {};
      const rawMembers = Array.isArray(data.members)
        ? [...data.members].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }))
        : [];
      const members = rawMembers.map(normalizeMember);
      const rawTransactions = Array.isArray(data.transactions) ? [...data.transactions] : [];
      const transactions = rawTransactions.map(normalizeTransaction);

      setClubData({
        members,
        transactions,
        months: Array.isArray(data.months) ? data.months : [],
        dashboardRows: Array.isArray(data.dashboardRows) ? data.dashboardRows : [],
        messages: Array.isArray(data.messages) ? data.messages : [],
        weekly: Array.isArray(data.weekly) ? data.weekly : [],
        transition: Array.isArray(data.transition) ? data.transition : [],
        rawMembers,
        raw: data,
        updatedAt: firestore?.updatedAt || null
      });
      setStatus(`Firestore connected: ${members.length} members loaded`);
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      setStatus('Firestore error');
    }
  }

  useEffect(() => { refreshData(); }, []);

  function notify(message) {
    setToast(message);
    window.clearTimeout(window.__rmTeaToast);
    window.__rmTeaToast = window.setTimeout(() => setToast(''), 3000);
  }

  async function saveUpdatedMembers(rawMembers, message) {
    const sorted = [...rawMembers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
    await saveMembersToTeaClub(sorted);
    notify(message);
    await refreshData();
  }

  async function updateMemberMonthStatus(memberId, monthIndex, nextStatus) {
    if (monthIndex < START_MONTH_INDEX) {
      notify('Jan-Jun 2026 are inactive');
      return;
    }

    try {
      setStatus('Saving month status...');
      const key = monthKey(monthIndex);
      const updatedMembers = clubData.rawMembers.map(raw => {
        const same = String(raw.id ?? raw.name) === String(memberId) || String(raw.name) === String(memberId);
        if (!same) return raw;

        const paidMonths = normalizePaidMonths(raw).filter(index => index !== monthIndex);
        if (nextStatus === 'paid') paidMonths.push(monthIndex);

        const monthStatuses = { ...(raw.monthStatuses || {}) };
        monthStatuses[key] = nextStatus;

        return {
          ...raw,
          monthStatuses,
          paidMonths: [...new Set(paidMonths)].sort((a, b) => a - b).map(monthKey),
          monthsPaid: [...new Set(paidMonths)].sort((a, b) => a - b).map(monthKey),
          monthsPaidCount: nextStatus === 'paid' ? paidMonths.length : (raw.monthsPaidCount || 0),
          updatedIn: 'v6.4'
        };
      });

      await saveUpdatedMembers(updatedMembers, `${monthLabels[monthIndex]} set to ${nextStatus}`);
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      notify('Could not save month status. Check Firestore rules.');
    }
  }

  async function addMemberToFirestore(payload) {
    const name = String(payload?.name || '').trim();
    if (!name) return notify('Name is required'), false;
    const exists = clubData.rawMembers.some(member => String(member.name || '').trim().toLowerCase() === name.toLowerCase());
    if (exists) return notify(`${name} already exists`), false;

    try {
      setStatus(`Saving ${name} to Firestore...`);
      const paidIndexes = Array.isArray(payload.monthsPaid) ? payload.monthsPaid.map(monthToIndex).filter(index => index !== null) : [];
      const monthStatuses = {};
      paidIndexes.forEach(index => { if (index >= START_MONTH_INDEX) monthStatuses[monthKey(index)] = 'paid'; });

      const newMember = {
        id: Date.now(),
        name,
        category: payload.category || 'ACTIVE',
        monthlyCategory: payload.category || 'ACTIVE',
        status: 'active',
        activeAuto: 'Y',
        monthlyFee: Number(payload.monthlyFee || 5),
        weeklyFee: Number(payload.weeklyFee || 1),
        credit: 0,
        oldDebt: 0,
        monthlyOutstanding: 0,
        monthsPaid: paidIndexes.map(monthKey),
        monthsPaidCount: paidIndexes.length,
        paidMonths: paidIndexes.map(monthKey),
        monthStatuses,
        notes: payload.notes || '',
        monthlyNotes: payload.notes || '',
        weeklyStatus: 'OK',
        lastPaidWeek: '-',
        createdIn: 'v6.4'
      };

      await saveUpdatedMembers([...clubData.rawMembers, newMember], `${name} added to Firestore`);
      setModal(null);
      return true;
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      notify('Could not save member. Check Firestore rules.');
      return false;
    }
  }

  async function addTransactionToFirestore(payload) {
    const amountInput = Number(payload?.amount || 0);
    if (!amountInput) return notify('Amount is required'), false;

    const kind = payload.kind || 'Payment';
    const signedAmount = kind === 'Expense' ? -Math.abs(amountInput) : Math.abs(amountInput);
    const memberName = payload.member || (kind === 'Expense' ? 'Tea Club' : '');
    if (kind !== 'Expense' && (!memberName || memberName === 'Tea Club')) return notify('Choose member for payment'), false;

    const selectedMonths = Array.isArray(payload.months) ? payload.months : [];
    if (kind !== 'Expense' && selectedMonths.length === 0) return notify('Choose at least one month'), false;

    const today = new Date().toISOString().slice(0, 10);

    try {
      setStatus('Saving transaction to Firestore...');
      const newTransaction = {
        id: `TX-${Date.now()}`,
        date: payload.date || today,
        type: kind,
        member: memberName,
        name: memberName,
        months: selectedMonths,
        category: payload.category || (kind === 'Expense' ? 'General expense' : 'Membership'),
        description: payload.description || (selectedMonths.length ? `Membership: ${selectedMonths.join(', ')}` : payload.category || kind),
        amount: signedAmount,
        income: signedAmount > 0 ? signedAmount : 0,
        expense: signedAmount < 0 ? Math.abs(signedAmount) : 0,
        createdIn: 'v6.4'
      };

      const updatedTransactions = [newTransaction, ...(clubData.raw?.transactions || [])];

      if (kind === 'Expense') {
        await saveTransactionsToTeaClub(updatedTransactions);
      } else {
        const selectedIndexes = selectedMonths.map(monthToIndex).filter(index => index !== null);
        const updatedMembers = clubData.rawMembers.map(raw => {
          if (String(raw.name || '').trim().toLowerCase() !== memberName.trim().toLowerCase()) return raw;

          const existingPaid = normalizePaidMonths(raw);
          const mergedPaid = [...new Set([...existingPaid, ...selectedIndexes])].sort((a, b) => a - b);
          const monthStatuses = { ...(raw.monthStatuses || {}) };
          selectedIndexes.forEach(index => { if (index >= START_MONTH_INDEX) monthStatuses[monthKey(index)] = 'paid'; });

          return {
            ...raw,
            monthStatuses,
            paidMonths: mergedPaid.map(monthKey),
            monthsPaid: mergedPaid.map(monthKey),
            monthsPaidCount: mergedPaid.length,
            updatedIn: 'v6.4-payment'
          };
        });

        await saveMembersToTeaClub(updatedMembers);
        await saveTransactionsToTeaClub(updatedTransactions);
      }

      setModal(null);
      notify(`${kind} saved to Firestore`);
      await refreshData();
      return true;
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      notify('Could not save transaction. Check Firestore rules.');
      return false;
    }
  }

  const members = clubData.members;
  const transactions = clubData.transactions;
const filteredMembers = members
  .filter(member => !hideLeftMembers || !member.resigned)
  .filter(member => [member.name, member.tag, member.note, member.weeklyStatus].join(' ').toLowerCase().includes(query.toLowerCase()));
    [member.name, member.tag, member.note, member.weeklyStatus].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const stats = useMemo(() => {
    const income = transactions.filter(t => Number(t.amount) > 0).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const spent = Math.abs(transactions.filter(t => Number(t.amount) < 0).reduce((sum, tx) => sum + Number(tx.amount), 0));
    const due = members.reduce((sum, member) => sum + Number(member.due || 0), 0);
    const activeMembers = members.filter(member => !member.resigned).length;
    return { income, spent, balance: income - spent, due, activeMembers, allMembers: members.length, transactions: transactions.length };
  }, [members, transactions]);

  const nav = [
    ['Dashboard', BarChart3], ['Members', Users], ['Transactions', ReceiptText], ['Reports', Wallet],
    ['Stock', Package], ['Poster Studio', Image], ['Settings', SettingsIcon]
  ];

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo">RM</div><div><b>Tea Club</b><span>Firestore Manager</span></div></div>
      <div className="versionBox">{APP_VERSION}</div>
      {nav.map(([name, Icon]) => <button key={name} onClick={() => setActive(name)} className={active === name ? 'active' : ''}><Icon size={18}/>{name}</button>)}
      <div className="safe"><ShieldCheck size={17}/> Firestore read/write<br/>Members + transactions</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><span className="pill">{APP_VERSION}</span><h1>{active}</h1><p className={error ? 'status errorText' : 'status'}>{error || status}</p></div>
        <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members, payments, notes..." /></div>
        <button className="icon"><Bell size={18}/><span></span></button>
        <button className="primary" onClick={() => setModal('addMember')}><Plus size={18}/>Add member</button>
        <button className="secondary" onClick={() => setModal({ type: 'addTransaction', kind: 'Payment' })}>Add payment</button>
        <button className="secondary" onClick={() => setModal({ type: 'addTransaction', kind: 'Expense' })}>Add expense</button>
        <button className="secondary" onClick={refreshData}><RefreshCw size={18}/>Refresh</button>
      </header>

      {error && <section className="panel errorPanel"><AlertTriangle/><div><h2>Firestore error</h2><p>{error}</p></div></section>}
      {!error && active === 'Dashboard' && <Dashboard stats={stats} dashboardRows={clubData.dashboardRows} months={clubData.months} messages={clubData.messages} />}
      {!error && active === 'Members' && <Members members={filteredMembers} total={members.length} onAdd={() => setModal('addMember')} onMonthChange={updateMemberMonthStatus} />}
      {!error && active === 'Transactions' && <Transactions transactions={transactions} onAddPayment={() => setModal({ type: 'addTransaction', kind: 'Payment' })} onAddExpense={() => setModal({ type: 'addTransaction', kind: 'Expense' })} />}
      {!error && active === 'Reports' && <Reports stats={stats} dashboardRows={clubData.dashboardRows} />}
      {!error && active === 'Stock' && <Stock />}
      {!error && active === 'Poster Studio' && <Poster members={members} />}
      {!error && active === 'Settings' && <Settings data={clubData} />}
    </main>

    {modal === 'addMember' && <AddMemberModal onClose={() => setModal(null)} onSave={addMemberToFirestore} />}
    {modal?.type === 'addTransaction' && <AddTransactionModal kind={modal.kind} members={members} onClose={() => setModal(null)} onSave={addTransactionToFirestore} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function Dashboard({ stats, dashboardRows, months, messages }) {
  return <section className="grid">
    <Stat title="Active members" value={stats.activeMembers} />
    <Stat title="All members" value={stats.allMembers} />
    <Stat title="Balance" value={toMoney(stats.balance)} tone={stats.balance >= 0 ? 'green' : 'red'} />
    <Stat title="Outstanding" value={toMoney(stats.due)} tone="orange" />
    <Stat title="Income" value={toMoney(stats.income)} tone="green" />
    <Stat title="Expenses" value={toMoney(stats.spent)} tone="red" />
    <div className="panel wide"><h2>Firestore dashboard snapshot</h2><table><thead><tr><th>Item</th><th>Value</th><th>Note</th></tr></thead><tbody>{dashboardRows.slice(0, 8).map((row, index) => <tr key={index}><td>{row.label || row.item || '-'}</td><td><b>{String(row.value ?? '')}</b></td><td>{row.note || ''}</td></tr>)}</tbody></table></div>
    <div className="panel"><h2>System</h2><p className="alert good">✓ Connected to teaClub/main</p><p className="alert good">✓ v6.4 month statuses</p><p className="alert">Payments can now mark months as paid.</p><p><b>Months:</b> {months.join(', ') || '-'}</p><p><b>Messages:</b> {messages.length}</p></div>
  </section>;
}

function Members({ members, total, onAdd, onMonthChange }) {
  const [allOpen, setAllOpen] = useState(false);
  const activeCount = members.filter(member => !member.resigned).length;
  const overdueCount = members.filter(member => (member.counts?.overdue || 0) > 0).length;

  return <section>
    <div className="heroPanel membersHero">
      <div>
        <span className="eyebrow">Firestore live data</span>
        <h2>Members</h2>
        <p>{members.length} displayed of {total} loaded · {activeCount} active · {overdueCount} with overdue months</p>
      </div>
      <div className="panelActions">
        <button className="secondary" onClick={() => setAllOpen(v => !v)}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
        <button className="primary" onClick={onAdd}><Plus size={18}/>Add member</button>
      </div>
    </div>

    <div className="members">{members.map(member => <MemberCard key={member.id} member={member} forceOpen={allOpen} onMonthChange={onMonthChange} />)}</div>
  </section>;
}

function memberOverallStatus(member) {
  const text = `${member.tag} ${member.weeklyStatus} ${member.note}`.toLowerCase();
  if (member.resigned || text.includes('resign') || text.includes('left')) return 'left';
  if ((member.counts?.overdue || 0) > 0) return 'due';
  if ((member.counts?.due || 0) > 0) return 'warn';
  if (text.includes('new')) return 'new';
  return 'active';
}

function nextManualStatus(current) {
  if (current === 'paid') return 'due';
  if (current === 'due') return 'overdue';
  if (current === 'overdue') return 'future';
  return 'paid';
}

function MemberCard({ member, forceOpen, onMonthChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen || localOpen;
  const status = memberOverallStatus(member);
  const paidUntil = member.paid.length ? monthLabels[Math.max(...member.paid)] : '-';
  const counts = member.counts || {};

  return <article className={`member member-${status} ${open ? 'expanded' : 'collapsed'}`}>
    <button type="button" className="memberSummary" onClick={() => setLocalOpen(v => !v)}>
      <div className="memberIdentity">
        <div className="avatar">{member.name?.[0] || '?'}</div>
        <div>
          <h3>{member.name}</h3>
          <p>✔ {counts.paid || 0} paid · ⚠ {counts.due || 0} due · ✖ {counts.overdue || 0} overdue</p>
        </div>
      </div>
      <div className="memberRight">
        <span className={`statusBadge ${status}`}>{member.resigned ? 'Left' : status === 'due' ? 'Overdue' : status === 'warn' ? 'Due now' : 'OK'}</span>
        {open ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
      </div>
    </button>

    {open && <div className="memberDetails">
      <p className="note">{member.note || 'No notes'}</p>

      <div className="memberStats">
        <div><span>Monthly</span><b>{toMoney(member.monthlyFee)}</b></div>
        <div><span>Weekly</span><b>{toMoney(member.weeklyFee)}</b></div>
        <div><span>Due</span><b className={member.due > 0 ? 'dueText' : 'okText'}>{toMoney(member.due)}</b></div>
      </div>

      <div className="miniInfo">
        <span>Paid until <b>{paidUntil}</b></span>
        <span>Last week <b>{member.lastPaidWeek}</b></span>
        <span>Weekly <b>{member.weeklyStatus}</b></span>
      </div>

      <div className="months compactMonths">{monthLabels.map((month, index) => {
        const monthStatus = getMonthStatus(member, index);
        const disabled = monthStatus === 'inactive';
        return <button
          type="button"
          key={month}
          disabled={disabled}
          title={disabled ? 'Inactive before July 2026' : `Click to change. Current: ${monthStatus}`}
          onClick={() => onMonthChange(member.id, index, nextManualStatus(monthStatus))}
          className={`monthCell ${monthStatus}`}
        >
          <span>{month}</span><small>{monthStatus}</small>
        </button>;
      })}</div>
    </div>}
  </article>;
}

function Transactions({ transactions, onAddPayment, onAddExpense }) {
  return <section className="panel">
    <div className="panelTitle">
      <h2>Transactions from Firestore</h2>
      <div className="panelActions">
        <button className="primary" onClick={onAddPayment}>Add payment</button>
        <button className="secondary" onClick={onAddExpense}>Add expense</button>
        <span>{transactions.length} loaded</span>
      </div>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Member</th><th>Months</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>{transactions.map((tx, index) => <tr key={`${tx.id}-${index}`}>
        <td>{tx.id}</td><td>{String(tx.date)}</td><td>{tx.type}</td><td>{tx.member}</td>
        <td>{tx.months?.length ? tx.months.join(', ') : '-'}</td>
        <td>{tx.description}</td><td className={Number(tx.amount) >= 0 ? 'money' : 'cost'}>{Number(tx.amount) >= 0 ? '+' : ''}{toMoney(tx.amount)}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}

function Reports({ stats, dashboardRows }) {
  return <section className="grid"><div className="panel wide"><h2>Reports read-only</h2><div className="filters"><input type="date"/><input type="date"/><select><option>Sort by date</option><option>Sort by amount</option><option>Sort by member</option></select><button className="primary"><Download size={16}/>Export later</button></div><p>Total income: <b>{toMoney(stats.income)}</b></p><p>Total spent: <b>{toMoney(stats.spent)}</b></p><p>Outstanding: <b>{toMoney(stats.due)}</b></p><p>Dashboard rows loaded: <b>{dashboardRows.length}</b></p></div></section>;
}

function Stock(){ return <section className="stock"><StockItem name="Tea bags" qty="from v6.1" level="OK"/><StockItem name="Milk" qty="from transactions" level="LOW"/><StockItem name="Sugar" qty="from transactions" level="OK"/><StockItem name="Biscuits" qty="from transactions" level="OK"/></section>; }
function Poster({ members }){ return <section className="poster"><div className="posterCard"><Coffee size={42}/><h1>RM Tea Club</h1><p>{members.filter(m => !m.resigned).length} active members</p><div>{members.filter(m => !m.resigned).slice(0, 50).map(member => <span key={member.id}>{member.name}</span>)}</div></div></section>; }

function AddMemberModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('ACTIVE');
  const [monthlyFee, setMonthlyFee] = useState('5');
  const [weeklyFee, setWeeklyFee] = useState('1');
  const [notes, setNotes] = useState('');
  const [monthsPaid, setMonthsPaid] = useState([monthKey(START_MONTH_INDEX)]);
  const [saving, setSaving] = useState(false);

  function toggleMonth(month) {
    setMonthsPaid(prev => prev.includes(month) ? prev.filter(item => item !== month) : [...prev, month].sort());
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({ name, category, monthlyFee, weeklyFee, notes, monthsPaid });
    if (!ok) setSaving(false);
  }

  const monthValues = monthLabels.map((label, index) => monthKey(index));

  return <div className="modal" onClick={onClose}>
    <form className="modalCard" onClick={event => event.stopPropagation()} onSubmit={submit}>
      <button type="button" className="close" onClick={onClose}><X size={18}/></button>
      <h2>Add member to Firestore</h2>
      <p className="muted">Jan-Jun are inactive. Select paid months from July onwards.</p>

      <label>Name<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Siju" /></label>
      <label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option>ACTIVE</option><option>ACTIVE - new member</option><option>ORANGE - email not found</option><option>RED - left/resigned</option></select></label>
      <div className="formGrid">
        <label>Monthly fee<input value={monthlyFee} onChange={event => setMonthlyFee(event.target.value)} /></label>
        <label>Weekly fee<input value={weeklyFee} onChange={event => setWeeklyFee(event.target.value)} /></label>
      </div>
      <label>Notes<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional note" /></label>

      <div className="monthPicker"><p>Months paid</p>{monthValues.map((value, index) => <button type="button" key={value} disabled={index < START_MONTH_INDEX} onClick={() => toggleMonth(value)} className={index < START_MONTH_INDEX ? 'inactive' : monthsPaid.includes(value) ? 'paid' : 'future'}>{monthLabels[index]}</button>)}</div>

      <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Saving...' : 'Save member'}</button></div>
    </form>
  </div>;
}

function AddTransactionModal({ kind, members, onClose, onSave }) {
  const [type, setType] = useState(kind || 'Payment');
  const firstActive = members.find(m => !m.resigned)?.name || '';
  const [member, setMember] = useState(kind === 'Expense' ? 'Tea Club' : firstActive);
  const [amount, setAmount] = useState('5');
  const [category, setCategory] = useState(kind === 'Expense' ? 'Supplies' : 'Membership');
  const [description, setDescription] = useState('');
  const [months, setMonths] = useState(type === 'Expense' ? [] : [monthKey(START_MONTH_INDEX)]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  function changeType(value) {
    setType(value);
    if (value === 'Expense') {
      setMember('Tea Club');
      setMonths([]);
      setCategory('Supplies');
    } else {
      setMember(firstActive);
      setMonths([monthKey(START_MONTH_INDEX)]);
      setCategory('Membership');
    }
  }

  function toggleMonth(month) {
    setMonths(prev => prev.includes(month) ? prev.filter(item => item !== month) : [...prev, month].sort());
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({ kind: type, member, amount, category, description, date, months });
    if (!ok) setSaving(false);
  }

  const monthValues = monthLabels.map((label, index) => monthKey(index));

  return <div className="modal" onClick={onClose}>
    <form className="modalCard" onClick={event => event.stopPropagation()} onSubmit={submit}>
      <button type="button" className="close" onClick={onClose}><X size={18}/></button>
      <h2>{type === 'Expense' ? 'Add expense' : 'Add payment'}</h2>
      <p className="muted">Payments are linked to members and selected months.</p>

      <label>Type<select value={type} onChange={event => changeType(event.target.value)}><option>Payment</option><option>Expense</option></select></label>
      <label>{type === 'Expense' ? 'Paid by / item owner' : 'Member'}<select value={member} onChange={event => setMember(event.target.value)}>{type === 'Expense' && <option>Tea Club</option>}{members.filter(m => !m.resigned).map(m => <option key={m.id}>{m.name}</option>)}</select></label>
      <div className="formGrid"><label>Amount<input value={amount} onChange={event => setAmount(event.target.value)} placeholder="5" /></label><label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>

      {type !== 'Expense' && <div className="monthPicker"><p>Paid months</p>{monthValues.map((value, index) => <button type="button" key={value} disabled={index < START_MONTH_INDEX} onClick={() => toggleMonth(value)} className={index < START_MONTH_INDEX ? 'inactive' : months.includes(value) ? 'paid' : 'future'}>{monthLabels[index]}</button>)}</div>}

      <label>Category<input value={category} onChange={event => setCategory(event.target.value)} placeholder="Membership / Milk / Tea bags" /></label>
      <label>Description<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional note" /></label>

      <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Saving...' : 'Save transaction'}</button></div>
    </form>
  </div>;
}

function Settings({ data }){ return <section className="panel"><h2>Settings</h2><p><b>Mode:</b> Firestore read/write</p><p><b>Document:</b> teaClub/main</p><p><b>Members loaded:</b> {data.members.length}</p><p><b>v6.4:</b> accordion members, month statuses, linked transactions</p><p><b>Transactions loaded:</b> {data.transactions.length}</p><p><b>Weekly rows:</b> {data.weekly.length}</p><p><b>Transition rows:</b> {data.transition.length}</p></section>; }
function Stat({ title, value, tone }){ return <div className={`stat ${tone || ''}`}><span>{title}</span><b>{value}</b></div>; }
function StockItem({ name, qty, level }){ return <div className="stockItem"><h3>{name}</h3><p>{qty}</p><span className={level === 'LOW' ? 'low' : 'ok'}>{level}</span></div>; }

createRoot(document.getElementById('root')).render(<App />);
