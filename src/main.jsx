import React, { useEffect, useMemo, useState } from 'react';
import { loadTeaClub } from "./services/firestore";
import { createRoot } from 'react-dom/client';
import { Users, Wallet, ReceiptText, BarChart3, Package, Image, Settings as SettingsIcon, Plus, Search, Bell, Download, Coffee, ShieldCheck, X, Save, Trash2, Pencil } from 'lucide-react';
import './style.css';

const APP_VERSION = 'V5 CLEAN BUILD';
const STORAGE_MEMBERS = 'rmTeaClub_v5_members';
const STORAGE_TRANSACTIONS = 'rmTeaClub_v5_transactions';
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const seedMembers = [
  { id: 1, name: 'Abbas', tag: 'Paid ahead', paid: [0,1,2,3,4,5,6,7,8,9,10,11], note: 'Paid until end of year', resigned: false },
  { id: 2, name: 'Adam', tag: 'Admin', paid: [6], note: 'Treasurer', resigned: false },
  { id: 3, name: 'Fred', tag: 'Active', paid: [6], note: 'Active member', resigned: false },
  { id: 4, name: 'Pietro', tag: 'Active', paid: [6,7,8], note: 'Paid ahead', resigned: false },
  { id: 5, name: 'Kehinde', tag: 'Due', paid: [], note: 'Needs July payment', resigned: false }
];

const seedTransactions = [
  { id: 'TC-0001', date: '2026-07-01', type: 'Payment', member: 'Abbas', category: 'Membership', amount: 36 },
  { id: 'TC-0002', date: '2026-07-02', type: 'Payment', member: 'Adam', category: 'Membership', amount: 6 },
  { id: 'TC-0003', date: '2026-07-04', type: 'Expense', member: 'Tea Club', category: 'Milk', amount: -9.8 },
  { id: 'TC-0004', date: '2026-07-05', type: 'Expense', member: 'Tea Club', category: 'Tea bags', amount: -14.5 }
];

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [active, setActive] = useState('Members');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [members, setMembers] = useState(() => readStorage(STORAGE_MEMBERS, seedMembers));
  const [transactions, setTransactions] = useState(() => readStorage(STORAGE_TRANSACTIONS, seedTransactions));

  useEffect(() => localStorage.setItem(STORAGE_MEMBERS, JSON.stringify(members)), [members]);
  useEffect(() => localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(transactions)), [transactions]);
  useEffect(() => {

    async function loadFirestore() {

        try {

            const firestore = await loadTeaClub();

            console.log("Firestore:", firestore);

if (firestore?.data?.members) {
    // setMembers(firestore.data.members);
}

if (firestore?.data?.transactions) {
    // setTransactions(firestore.data.transactions);
}

        } catch (err) {

            console.error(err);

        }

    }

    loadFirestore();

}, []);

  const notify = (text) => {
    setToast(text);
    window.clearTimeout(window.__rmToast);
    window.__rmToast = window.setTimeout(() => setToast(''), 2500);
  };

  const addMember = (payload) => {
    const name = String(payload?.name || '').trim();
    if (!name) {
      notify('Name is required');
      return false;
    }
    if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      notify(`${name} already exists`);
      return false;
    }
    const newMember = {
      id: Date.now(),
      name,
      tag: payload.tag || 'Active',
      paid: Array.isArray(payload.paid) ? payload.paid : [],
      note: payload.note || 'New member',
      resigned: false
    };
    setMembers(prev => [newMember, ...prev]);
    setActive('Members');
    setModal(null);
    notify(`${name} added`);
    return true;
  };

  const addTestMember = () => {
    const n = members.filter(m => m.name.startsWith('TEST MEMBER')).length + 1;
    addMember({ name: `TEST MEMBER ${n}`, tag: 'Test', note: 'Added by test button', paid: [6] });
  };

  const deleteMember = (id) => {
    const member = members.find(m => m.id === id);
    setMembers(prev => prev.filter(m => m.id !== id));
    notify(`${member?.name || 'Member'} deleted`);
  };

  const togglePaidMonth = (id, monthIndex) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== id) return m;
      const paid = m.paid.includes(monthIndex) ? m.paid.filter(x => x !== monthIndex) : [...m.paid, monthIndex].sort((a,b)=>a-b);
      return { ...m, paid };
    }));
  };

  const addTransaction = (payload) => {
    const amount = Number(payload.amount || 0);
    if (!amount) return notify('Amount is required');
    const tx = {
      id: `TC-${String(transactions.length + 1).padStart(4,'0')}`,
      date: payload.date || new Date().toISOString().slice(0,10),
      type: amount >= 0 ? 'Payment' : 'Expense',
      member: payload.member || 'Tea Club',
      category: payload.category || 'General',
      amount
    };
    setTransactions(prev => [tx, ...prev]);
    setModal(null);
    notify('Transaction added');
  };

  const filteredMembers = members.filter(m => [m.name, m.tag, m.note].join(' ').toLowerCase().includes(query.toLowerCase()));
  const stats = useMemo(() => {
    const paid = transactions.filter(t => Number(t.amount) > 0).reduce((a,t) => a + Number(t.amount), 0);
    const spent = Math.abs(transactions.filter(t => Number(t.amount) < 0).reduce((a,t) => a + Number(t.amount), 0));
    return { paid, spent, balance: paid - spent, members: members.length, due: members.filter(m => !m.paid.includes(6)).length };
  }, [members, transactions]);

  const nav = [
    ['Dashboard', BarChart3], ['Members', Users], ['Transactions', ReceiptText], ['Reports', Wallet], ['Stock', Package], ['Poster Studio', Image], ['Settings', SettingsIcon]
  ];

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo">RM</div><div><b>Tea Club</b><span>Manager</span></div></div>
      <div className="versionBox">{APP_VERSION}</div>
      {nav.map(([name, Icon]) => <button key={name} onClick={() => setActive(name)} className={active === name ? 'active' : ''}><Icon size={18}/>{name}</button>)}
      <div className="safe"><ShieldCheck size={17}/> Fresh project<br/>Spreadsheet reload removed</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><span className="pill">{APP_VERSION}</span><h1>{active}</h1></div>
        <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." /></div>
        <button className="icon"><Bell size={18}/><span></span></button>
        <button className="primary" onClick={() => setModal('addMember')}><Plus size={18}/>Add member</button>
        <button className="dark" onClick={addTestMember}>+ TEST MEMBER</button>
      </header>

      {active === 'Dashboard' && <Dashboard stats={stats} />}
      {active === 'Members' && <Members members={filteredMembers} onAdd={() => setModal('addMember')} onDelete={deleteMember} onToggleMonth={togglePaidMonth} onOpen={(member)=>setModal({type:'member', member})} />}
      {active === 'Transactions' && <Transactions transactions={transactions} onAdd={() => setModal('addTransaction')} />}
      {active === 'Reports' && <Reports stats={stats} transactions={transactions} />}
      {active === 'Stock' && <Stock />}
      {active === 'Poster Studio' && <Poster members={members} />}
      {active === 'Settings' && <Settings onReset={() => { localStorage.removeItem(STORAGE_MEMBERS); localStorage.removeItem(STORAGE_TRANSACTIONS); setMembers(seedMembers); setTransactions(seedTransactions); notify('Local demo data reset'); }} />}
    </main>

    {modal === 'addMember' && <AddMemberModal onClose={() => setModal(null)} onSave={addMember} />}
    {modal === 'addTransaction' && <AddTransactionModal members={members} onClose={() => setModal(null)} onSave={addTransaction} />}
    {modal?.type === 'member' && <MemberModal member={modal.member} onClose={() => setModal(null)} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function Dashboard({ stats }) {
  return <section className="grid">
    <Stat title="Balance" value={`£${stats.balance.toFixed(2)}`} tone="green" />
    <Stat title="Income" value={`£${stats.paid.toFixed(2)}`} />
    <Stat title="Spent" value={`£${stats.spent.toFixed(2)}`} tone="red" />
    <Stat title="Members" value={stats.members} tone="orange" />
    <div className="panel wide"><h2>Cash flow</h2><div className="bars"><i style={{height:'70%'}}/><i style={{height:'46%'}}/><i style={{height:'85%'}}/><i style={{height:'55%'}}/><i style={{height:'78%'}}/></div></div>
    <div className="panel"><h2>Alerts</h2><p className="alert good">✓ Add member works in v5</p><p className="alert">⚠ Firestore sync next</p></div>
  </section>;
}

function Members({ members, onAdd, onDelete, onToggleMonth, onOpen }) {
  return <section>
    <div className="topPanel"><div><h2>Members</h2><p>{members.length} displayed</p></div><button className="primary" onClick={onAdd}><Plus size={18}/>ADD NEW MEMBER</button></div>
    <div className="members">{members.map(m => <div className="member" key={m.id}>
      <div className="avatar">{m.name[0]}</div>
      <div className="memberHead"><h3>{m.name}</h3><span>{m.tag}</span></div>
      <p>{m.note}</p>
      <div className="months">{months.map((mo,i) => <button key={mo} onClick={() => onToggleMonth(m.id, i)} className={m.paid.includes(i) ? 'paid' : i < 6 ? 'late' : 'future'}>{mo}</button>)}</div>
      <div className="rowBtns"><button onClick={() => onOpen(m)}><Pencil size={15}/>Open</button><button className="danger" onClick={() => onDelete(m.id)}><Trash2 size={15}/>Delete</button></div>
    </div>)}</div>
  </section>;
}

function Transactions({ transactions, onAdd }) {
  return <section className="panel"><div className="panelTitle"><h2>Transactions</h2><button className="primary" onClick={onAdd}>Add transaction</button></div><table><thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Member</th><th>Category</th><th>Amount</th></tr></thead><tbody>{transactions.map(t => <tr key={t.id}><td>{t.id}</td><td>{t.date}</td><td>{t.type}</td><td>{t.member}</td><td>{t.category}</td><td className={Number(t.amount) >= 0 ? 'money' : 'cost'}>{Number(t.amount) >= 0 ? '+' : ''}£{Number(t.amount).toFixed(2)}</td></tr>)}</tbody></table></section>;
}

function Reports({ stats }) {
  return <section className="grid"><div className="panel wide"><h2>Reports</h2><div className="filters"><input type="date"/><input type="date"/><select><option>Sort by date</option><option>Sort by amount</option><option>Sort by member</option></select><button className="primary"><Download size={16}/>Export</button></div><p>Total paid: <b>£{stats.paid.toFixed(2)}</b></p><p>Total spent: <b>£{stats.spent.toFixed(2)}</b></p><p>Balance: <b>£{stats.balance.toFixed(2)}</b></p></div></section>;
}
function Stock(){ return <section className="stock"><StockItem name="Tea bags" qty="4 boxes" level="OK"/><StockItem name="Milk" qty="1 bottle" level="LOW"/><StockItem name="Sugar" qty="2 bags" level="OK"/><StockItem name="Biscuits" qty="0" level="LOW"/></section>; }
function Poster({ members }){ return <section className="poster"><div className="posterCard"><Coffee size={42}/><h1>RM Tea Club</h1><p>Member list</p><div>{members.map(m => <span key={m.id}>{m.name}</span>)}</div></div></section>; }
function Settings({ onReset }){ return <section className="panel"><h2>Settings</h2><p><b>Monthly fee:</b> £6</p><p><b>Save mode:</b> browser localStorage</p><p><b>Old spreadsheet reload:</b> removed</p><button className="dark" onClick={onReset}>Reset local demo data</button></section>; }
function Stat({ title, value, tone }){ return <div className={`stat ${tone || ''}`}><span>{title}</span><b>{value}</b></div>; }
function StockItem({ name, qty, level }){ return <div className="stockItem"><h3>{name}</h3><p>{qty}</p><span className={level === 'LOW' ? 'low' : 'ok'}>{level}</span></div>; }

function AddMemberModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('Active');
  const [note, setNote] = useState('');
  const [paid, setPaid] = useState([6]);
  const toggle = (i) => setPaid(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a,b)=>a-b));
  return <Modal title="Add new member" onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); onSave({ name, tag, note, paid }); }}>
      <label>Name<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Siju" /></label>
      <label>Status<select value={tag} onChange={e => setTag(e.target.value)}><option>Active</option><option>Paid ahead</option><option>Due</option><option>Admin</option><option>Test</option></select></label>
      <label>Note<input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" /></label>
      <div className="monthPicker"><p>Paid months</p>{months.map((mo,i) => <button type="button" key={mo} onClick={() => toggle(i)} className={paid.includes(i) ? 'paid' : 'future'}>{mo}</button>)}</div>
      <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit"><Save size={16}/>Save member</button></div>
    </form>
  </Modal>;
}

function AddTransactionModal({ members, onClose, onSave }) {
  const [member, setMember] = useState(members[0]?.name || 'Tea Club');
  const [amount, setAmount] = useState('6');
  const [category, setCategory] = useState('Membership');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  return <Modal title="Add transaction" onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); onSave({ member, amount, category, date }); }}>
      <label>Member<select value={member} onChange={e => setMember(e.target.value)}>{members.map(m => <option key={m.id}>{m.name}</option>)}<option>Tea Club</option></select></label>
      <label>Amount<input value={amount} onChange={e => setAmount(e.target.value)} placeholder="6 or -9.80" /></label>
      <label>Category<input value={category} onChange={e => setCategory(e.target.value)} /></label>
      <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save</button></div>
    </form>
  </Modal>;
}

function MemberModal({ member, onClose }) {
  return <Modal title={member.name} onClose={onClose}><p>{member.note}</p><p><b>Status:</b> {member.tag}</p><p><b>Paid months:</b> {member.paid.map(i => months[i]).join(', ') || '-'}</p><div className="modalActions"><button className="primary" onClick={onClose}>Close</button></div></Modal>;
}

function Modal({ title, onClose, children }) {
  return <div className="modal" onClick={onClose}><div className="modalCard" onClick={e => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18}/></button><h2>{title}</h2>{children}</div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
