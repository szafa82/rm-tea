import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Users, Wallet, ReceiptText, BarChart3, Package, Image, Settings as SettingsIcon,
  Plus, Search, Bell, Download, Coffee, ShieldCheck, RefreshCw, AlertTriangle
} from 'lucide-react';
import { loadTeaClub } from './services/firestore.js';
import './style.css';

const APP_VERSION = 'V6.1 FIRESTORE UI';
const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthNames = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

function toMoney(value) {
  const number = Number(value || 0);
  return `£${number.toFixed(2)}`;
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
  const source = member.paidMonths || member.monthsPaid || member.months || [];
  if (!Array.isArray(source)) return [];

  return [...new Set(source.map(monthToIndex).filter(index => index !== null))].sort((a, b) => a - b);
}

function normalizeMember(member, index) {
  const name = String(member.name || member.member || member.fullName || `Member ${index + 1}`).trim();
  const category = member.monthlyCategory || member.category || member.status || 'ACTIVE';
  const notes = member.notes || member.monthlyNotes || member.note || '';
  const paid = normalizePaidMonths(member);
  const monthlyOutstanding = Number(member.monthlyOutstanding ?? member.monthlyDue ?? 0);
  const oldDebt = Number(member.oldDebt ?? member.weeklyDue ?? 0);
  const credit = Number(member.credit ?? member.paidCredited ?? 0);
  const due = Math.max(0, monthlyOutstanding + oldDebt - credit);
  const resigned = String(category).toLowerCase().includes('resign') || String(member.status || '').toLowerCase().includes('left');

  return {
    raw: member,
    id: member.id ?? `${name}-${index}`,
    name,
    tag: resigned ? 'Left / resigned' : String(category || 'ACTIVE'),
    paid,
    note: notes || member.weeklyStatus || 'No notes',
    resigned,
    monthlyFee: Number(member.monthlyFee ?? 5),
    weeklyFee: Number(member.weeklyFee ?? 1),
    monthlyOutstanding,
    oldDebt,
    credit,
    due,
    lastPaidWeek: member.lastPaidWeek || member.endWeek || '-',
    weeklyStatus: member.weeklyStatus || '-'
  };
}

function normalizeTransaction(tx, index) {
  const income = Number(tx.income ?? tx.payment ?? tx.paid ?? 0);
  const expense = Number(tx.expense ?? tx.spent ?? 0);
  const amount = Number(tx.amount ?? (income - expense));
  const description = tx.description || tx.descript || tx.notes || tx.note || tx.category || 'Transaction';

  return {
    id: tx.id || tx.ref || `TX-${String(index + 1).padStart(4, '0')}`,
    date: tx.date || tx.createdAt || tx.week || '-',
    type: amount >= 0 ? 'Income' : 'Expense',
    member: tx.member || tx.name || 'Tea Club',
    category: tx.category || description,
    description,
    amount
  };
}

function App() {
  const [active, setActive] = useState('Members');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Loading Firestore...');
  const [error, setError] = useState('');
  const [clubData, setClubData] = useState({
    members: [],
    transactions: [],
    months: [],
    dashboardRows: [],
    messages: [],
    weekly: [],
    transition: []
  });

  async function refreshData() {
    try {
      setError('');
      setStatus('Loading Firestore...');
      const firestore = await loadTeaClub();
      console.log('Firestore:', firestore);

      const data = firestore?.data || {};
      const members = Array.isArray(data.members) ? data.members.map(normalizeMember) : [];
      const transactions = Array.isArray(data.transactions) ? data.transactions.map(normalizeTransaction) : [];

      setClubData({
        members,
        transactions,
        months: Array.isArray(data.months) ? data.months : [],
        dashboardRows: Array.isArray(data.dashboardRows) ? data.dashboardRows : [],
        messages: Array.isArray(data.messages) ? data.messages : [],
        weekly: Array.isArray(data.weekly) ? data.weekly : [],
        transition: Array.isArray(data.transition) ? data.transition : [],
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

  useEffect(() => {
    refreshData();
  }, []);

  const members = clubData.members;
  const transactions = clubData.transactions;
  const filteredMembers = members.filter(member => [member.name, member.tag, member.note, member.weeklyStatus].join(' ').toLowerCase().includes(query.toLowerCase()));

  const stats = useMemo(() => {
    const income = transactions.filter(t => Number(t.amount) > 0).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const spent = Math.abs(transactions.filter(t => Number(t.amount) < 0).reduce((sum, tx) => sum + Number(tx.amount), 0));
    const due = members.reduce((sum, member) => sum + Number(member.due || 0), 0);
    const activeMembers = members.filter(member => !member.resigned).length;

    return {
      income,
      spent,
      balance: income - spent,
      due,
      activeMembers,
      allMembers: members.length,
      transactions: transactions.length
    };
  }, [members, transactions]);

  const nav = [
    ['Dashboard', BarChart3],
    ['Members', Users],
    ['Transactions', ReceiptText],
    ['Reports', Wallet],
    ['Stock', Package],
    ['Poster Studio', Image],
    ['Settings', SettingsIcon]
  ];

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo">RM</div><div><b>Tea Club</b><span>Firestore Manager</span></div></div>
      <div className="versionBox">{APP_VERSION}</div>
      {nav.map(([name, Icon]) => <button key={name} onClick={() => setActive(name)} className={active === name ? 'active' : ''}><Icon size={18}/>{name}</button>)}
      <div className="safe"><ShieldCheck size={17}/> Firestore read-only<br/>No database writes</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><span className="pill">{APP_VERSION}</span><h1>{active}</h1><p className={error ? 'status errorText' : 'status'}>{error || status}</p></div>
        <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members, payments, notes..." /></div>
        <button className="icon"><Bell size={18}/><span></span></button>
        <button className="primary" onClick={refreshData}><RefreshCw size={18}/>Refresh</button>
      </header>

      {error && <section className="panel errorPanel"><AlertTriangle/><div><h2>Firestore error</h2><p>{error}</p></div></section>}
      {!error && active === 'Dashboard' && <Dashboard stats={stats} dashboardRows={clubData.dashboardRows} months={clubData.months} messages={clubData.messages} />}
      {!error && active === 'Members' && <Members members={filteredMembers} total={members.length} />}
      {!error && active === 'Transactions' && <Transactions transactions={transactions} />}
      {!error && active === 'Reports' && <Reports stats={stats} dashboardRows={clubData.dashboardRows} />}
      {!error && active === 'Stock' && <Stock />}
      {!error && active === 'Poster Studio' && <Poster members={members} />}
      {!error && active === 'Settings' && <Settings data={clubData} />}
    </main>
  </div>;
}

function Dashboard({ stats, dashboardRows, months, messages }) {
  return <section className="grid">
    <Stat title="Active members" value={stats.activeMembers} />
    <Stat title="All members" value={stats.allMembers} />
    <Stat title="Income" value={toMoney(stats.income)} tone="green" />
    <Stat title="Expenses" value={toMoney(stats.spent)} tone="red" />
    <Stat title="Outstanding" value={toMoney(stats.due)} tone="orange" />
    <Stat title="Transactions" value={stats.transactions} />
    <div className="panel wide"><h2>Firestore dashboard snapshot</h2><table><thead><tr><th>Item</th><th>Value</th><th>Note</th></tr></thead><tbody>{dashboardRows.slice(0, 8).map((row, index) => <tr key={index}><td>{row.label || row.item || '-'}</td><td><b>{String(row.value ?? '')}</b></td><td>{row.note || ''}</td></tr>)}</tbody></table></div>
    <div className="panel"><h2>System</h2><p className="alert good">✓ Connected to teaClub/main</p><p className="alert good">✓ Reading existing Firestore data</p><p className="alert">Next: v6.2 write-safe add member</p><p><b>Months:</b> {months.join(', ') || '-'}</p><p><b>Messages:</b> {messages.length}</p></div>
  </section>;
}

function Members({ members, total }) {
  const activeCount = members.filter(member => !member.resigned).length;
  const dueCount = members.filter(member => Number(member.due || 0) > 0).length;

  return <section>
    <div className="heroPanel membersHero">
      <div>
        <span className="eyebrow">Firestore live data</span>
        <h2>Members</h2>
        <p>{members.length} displayed of {total} loaded · {activeCount} active · {dueCount} with balance due</p>
      </div>
      <button className="primary" disabled><Plus size={18}/>Add member in v6.2</button>
    </div>

    <div className="members">{members.map(member => <MemberCard key={member.id} member={member} />)}</div>
  </section>;
}

function statusClass(member) {
  const text = `${member.tag} ${member.weeklyStatus} ${member.note}`.toLowerCase();
  if (member.resigned || text.includes('resign') || text.includes('left')) return 'left';
  if (Number(member.due || 0) > 0 || text.includes('to pay') || text.includes('due')) return 'due';
  if (text.includes('new')) return 'new';
  if (text.includes('orange')) return 'warn';
  return 'active';
}

function MemberCard({ member }) {
  const status = statusClass(member);
  const paidUntil = member.paid.length ? monthLabels[Math.max(...member.paid)] : '-';

  return <article className={`member member-${status}`}>
    <div className="memberTop">
      <div className="avatar">{member.name?.[0] || '?'}</div>
      <span className={`statusBadge ${status}`}>{member.tag}</span>
    </div>
    <h3>{member.name}</h3>
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

    <div className="months compactMonths">{monthLabels.map((month, index) => <span key={month} className={member.paid.includes(index) ? 'paid' : index < 6 ? 'late' : 'future'}>{month}</span>)}</div>
  </article>;
}

function Transactions({ transactions }) {
  return <section className="panel"><div className="panelTitle"><h2>Transactions from Firestore</h2><span>{transactions.length} loaded</span></div><table><thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Member</th><th>Description</th><th>Amount</th></tr></thead><tbody>{transactions.map((tx, index) => <tr key={`${tx.id}-${index}`}><td>{tx.id}</td><td>{String(tx.date)}</td><td>{tx.type}</td><td>{tx.member}</td><td>{tx.description}</td><td className={Number(tx.amount) >= 0 ? 'money' : 'cost'}>{Number(tx.amount) >= 0 ? '+' : ''}{toMoney(tx.amount)}</td></tr>)}</tbody></table></section>;
}

function Reports({ stats, dashboardRows }) {
  return <section className="grid"><div className="panel wide"><h2>Reports read-only</h2><div className="filters"><input type="date"/><input type="date"/><select><option>Sort by date</option><option>Sort by amount</option><option>Sort by member</option></select><button className="primary"><Download size={16}/>Export later</button></div><p>Total income: <b>{toMoney(stats.income)}</b></p><p>Total spent: <b>{toMoney(stats.spent)}</b></p><p>Outstanding: <b>{toMoney(stats.due)}</b></p><p>Dashboard rows loaded: <b>{dashboardRows.length}</b></p></div></section>;
}

function Stock(){ return <section className="stock"><StockItem name="Tea bags" qty="from v6.1" level="OK"/><StockItem name="Milk" qty="from transactions" level="LOW"/><StockItem name="Sugar" qty="from transactions" level="OK"/><StockItem name="Biscuits" qty="from transactions" level="OK"/></section>; }
function Poster({ members }){ return <section className="poster"><div className="posterCard"><Coffee size={42}/><h1>RM Tea Club</h1><p>{members.filter(m => !m.resigned).length} active members</p><div>{members.filter(m => !m.resigned).slice(0, 50).map(member => <span key={member.id}>{member.name}</span>)}</div></div></section>; }
function Settings({ data }){ return <section className="panel"><h2>Settings</h2><p><b>Mode:</b> Firestore read-only</p><p><b>Document:</b> teaClub/main</p><p><b>Members loaded:</b> {data.members.length}</p><p><b>Transactions loaded:</b> {data.transactions.length}</p><p><b>Weekly rows:</b> {data.weekly.length}</p><p><b>Transition rows:</b> {data.transition.length}</p></section>; }
function Stat({ title, value, tone }){ return <div className={`stat ${tone || ''}`}><span>{title}</span><b>{value}</b></div>; }
function StockItem({ name, qty, level }){ return <div className="stockItem"><h3>{name}</h3><p>{qty}</p><span className={level === 'LOW' ? 'low' : 'ok'}>{level}</span></div>; }

createRoot(document.getElementById('root')).render(<App />);
