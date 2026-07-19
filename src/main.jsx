import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Users, Wallet, ReceiptText, BarChart3, Package, Image, Settings as SettingsIcon,
  Plus, Search, Bell, Download, Coffee, ShieldCheck, RefreshCw, AlertTriangle, X, Save, ChevronDown, ChevronRight, Pencil, Trash2, FileDown
} from 'lucide-react';
import { loadTeaClub, saveMembersToTeaClub, saveTransactionsToTeaClub } from './services/firestore.js';
import './style.css';
import PosterStudio from './components/PosterStudio.jsx';

const APP_VERSION = 'V9 CLEAN MONTHLY';
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

function loadLocal(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore unavailable local storage.
  }
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
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
  const oldDebt = Number(member.oldDebt ?? 0);
  const credit = Number(member.credit ?? member.paidCredited ?? 0);
  const resigned = String(category).toLowerCase().includes('resign') || String(member.status || '').toLowerCase().includes('left');
  const base = {
    raw: member,
    id: member.id ?? `${name}-${index}`,
    name,
    tag: resigned ? 'Left / resigned' : String(category || 'ACTIVE'),
    paid,
    monthStatuses,
    note: notes || 'No notes',
    resigned,
    monthlyFee: Number(member.monthlyFee ?? 5),
    monthlyOutstanding,
    oldDebt,
    credit,
  };
  const counts = getMonthCounts(base);
  const monthDebt = (counts.overdue || 0) * base.monthlyFee + (counts.due || 0) * base.monthlyFee;
  base.due = monthDebt;
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
  const [hideLeftMembers, setHideLeftMembers] = useState(() => {
    try {
      return window.localStorage.getItem('rmTea.hideLeftMembers') === 'true';
    } catch {
      return false;
    }
  });
  const [status, setStatus] = useState('Loading Firestore...');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [posterSettings, setPosterSettings] = useState(() => loadLocal('rmTea.posterSettings', {
    clubName: 'TEA CLUB',
    contactName: 'Adam Szafarczyk',
    phone: '07462 879010',
    email: 'adam.szafarczyk@royalmail.com',
    monthlyFee: 5,
    drinks: ['Milk available', 'Hot chocolate', 'Tea', 'Decaf tea', 'Coffee', 'Decaf coffee']
  }));
  const [stockItems, setStockItems] = useState(() => loadLocal('rmTea.stockItems', [
    { id: 1, name: 'Tea bags', quantity: 100, minimum: 30, unit: 'bags' },
    { id: 2, name: 'Coffee', quantity: 2, minimum: 1, unit: 'jars' },
    { id: 3, name: 'Hot chocolate', quantity: 1, minimum: 1, unit: 'tubs' },
    { id: 4, name: 'Sugar', quantity: 2, minimum: 1, unit: 'bags' },
    { id: 5, name: 'Milk', quantity: 4, minimum: 2, unit: 'bottles' }
  ]));
  const [clubData, setClubData] = useState({
    members: [], transactions: [], months: [], dashboardRows: [], messages: [], rawMembers: [], raw: {}
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

  useEffect(() => {
    try {
      window.localStorage.setItem('rmTea.hideLeftMembers', String(hideLeftMembers));
    } catch {
      // Local storage can be unavailable in private/restricted browsing.
    }
  }, [hideLeftMembers]);

  useEffect(() => saveLocal('rmTea.posterSettings', posterSettings), [posterSettings]);
  useEffect(() => saveLocal('rmTea.stockItems', stockItems), [stockItems]);

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
          updatedIn: 'v7-monthly-only'
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
        credit: 0,
        oldDebt: 0,
        monthlyOutstanding: 0,
        monthsPaid: paidIndexes.map(monthKey),
        monthsPaidCount: paidIndexes.length,
        paidMonths: paidIndexes.map(monthKey),
        monthStatuses,
        notes: payload.notes || '',
        monthlyNotes: payload.notes || '',
        createdIn: 'v7-monthly-only'
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

  async function editMemberInFirestore(payload) {
    const originalId = payload?.originalId;
    const originalName = String(payload?.originalName || '').trim();
    const name = String(payload?.name || '').trim();

    if (!name) {
      notify('Name is required');
      return false;
    }

    const duplicate = clubData.rawMembers.some(raw => {
      const sameMember = String(raw.id ?? '') === String(originalId ?? '') ||
        (!originalId && String(raw.name || '').trim().toLowerCase() === originalName.toLowerCase());
      return !sameMember && String(raw.name || '').trim().toLowerCase() === name.toLowerCase();
    });

    if (duplicate) {
      notify(`${name} already exists`);
      return false;
    }

    try {
      setStatus(`Saving changes for ${name}...`);
      const category = payload.category || 'ACTIVE';
      const left = String(category).toLowerCase().includes('left') || String(category).toLowerCase().includes('resign');

      const updatedMembers = clubData.rawMembers.map(raw => {
        const sameMember = String(raw.id ?? '') === String(originalId ?? '') ||
          (!originalId && String(raw.name || '').trim().toLowerCase() === originalName.toLowerCase());
        if (!sameMember) return raw;

        return {
          ...raw,
          name,
          category,
          monthlyCategory: category,
          status: left ? 'left' : 'active',
          activeAuto: left ? 'N' : 'Y',
          monthlyFee: Number(payload.monthlyFee || 5),
          notes: payload.notes || '',
          monthlyNotes: payload.notes || '',
          updatedIn: 'v7-monthly-only'
        };
      });

      await saveUpdatedMembers(updatedMembers, `${name} updated`);
      setModal(null);
      return true;
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      notify('Could not update member. Check Firestore rules.');
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
        createdIn: 'v7-monthly-only'
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
            updatedIn: 'v7-monthly-only'
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


  async function editTransactionInFirestore(payload) {
    const amountInput = Number(payload?.amount || 0);
    if (!amountInput) return notify('Amount is required'), false;

    const type = payload.type || 'Payment';
    const amount = type === 'Expense' ? -Math.abs(amountInput) : Math.abs(amountInput);

    try {
      setStatus('Updating transaction...');
      const updatedTransactions = (clubData.raw?.transactions || []).map(raw => {
        if (String(raw.id || raw.ref) !== String(payload.id)) return raw;
        return {
          ...raw,
          date: payload.date,
          type,
          member: type === 'Expense' ? 'Tea Club' : payload.member,
          name: type === 'Expense' ? 'Tea Club' : payload.member,
          months: type === 'Expense' ? [] : payload.months,
          category: payload.category,
          description: payload.description,
          amount,
          income: amount > 0 ? amount : 0,
          expense: amount < 0 ? Math.abs(amount) : 0,
          updatedIn: 'v8-complete-monthly'
        };
      });

      await saveTransactionsToTeaClub(updatedTransactions);
      setModal(null);
      notify('Transaction updated');
      await refreshData();
      return true;
    } catch (err) {
      console.error(err);
      notify('Could not update transaction');
      return false;
    }
  }

  async function deleteTransactionFromFirestore(transaction) {
    const confirmed = window.confirm(`Delete transaction ${transaction.id}?`);
    if (!confirmed) return;

    try {
      setStatus('Deleting transaction...');
      const updatedTransactions = (clubData.raw?.transactions || []).filter(
        raw => String(raw.id || raw.ref) !== String(transaction.id)
      );
      await saveTransactionsToTeaClub(updatedTransactions);
      notify('Transaction deleted');
      await refreshData();
    } catch (err) {
      console.error(err);
      notify('Could not delete transaction');
    }
  }

  const members = clubData.members;
  const transactions = clubData.transactions;
const filteredMembers = members
  .filter(member => !hideLeftMembers || !member.resigned)
  .filter(member => [member.name, member.tag, member.note].join(' ').toLowerCase().includes(query.toLowerCase()));

  const stats = useMemo(() => {
    const income = transactions.filter(t => Number(t.amount) > 0).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const spent = Math.abs(transactions.filter(t => Number(t.amount) < 0).reduce((sum, tx) => sum + Number(tx.amount), 0));
    const due = members.reduce((sum, member) => sum + Number(member.due || 0), 0);
    const activeMembers = members.filter(member => !member.resigned).length;
    const membersToChase = members.filter(member =>
      !member.resigned && ((member.counts?.due || 0) > 0 || (member.counts?.overdue || 0) > 0)
    ).length;
    return { income, spent, balance: income - spent, due, activeMembers, membersToChase, allMembers: members.length, transactions: transactions.length };
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
      {!error && active === 'Dashboard' && <Dashboard stats={stats} months={clubData.months} messages={clubData.messages} />}
    {!error && active === 'Members' && (
  <Members
    members={filteredMembers}
    total={members.length}
    onAdd={() => setModal('addMember')}
    onMonthChange={updateMemberMonthStatus}
    onEdit={member => setModal({ type: 'editMember', member })}
    hideLeftMembers={hideLeftMembers}
    onToggleHideLeft={() => setHideLeftMembers(value => !value)}
  />
)}
      {!error && active === 'Transactions' && <Transactions
        transactions={transactions}
        onAddPayment={() => setModal({ type: 'addTransaction', kind: 'Payment' })}
        onAddExpense={() => setModal({ type: 'addTransaction', kind: 'Expense' })}
        onEdit={transaction => setModal({ type: 'editTransaction', transaction })}
        onDelete={deleteTransactionFromFirestore}
      />}
      {!error && active === 'Reports' && <Reports stats={stats} transactions={transactions} members={members} />}
      {!error && active === 'Stock' && <Stock items={stockItems} onChange={setStockItems} />}
      {!error && active === 'Poster Studio' && <PosterStudio members={members} settings={posterSettings} />}
      {!error && active === 'Settings' && <Settings data={clubData} settings={posterSettings} onChange={setPosterSettings} />}
    </main>

    {modal === 'addMember' && <AddMemberModal onClose={() => setModal(null)} onSave={addMemberToFirestore} />}
    {modal?.type === 'editMember' && <EditMemberModal member={modal.member} onClose={() => setModal(null)} onSave={editMemberInFirestore} />}
    {modal?.type === 'addTransaction' && <AddTransactionModal kind={modal.kind} members={members} onClose={() => setModal(null)} onSave={addTransactionToFirestore} />}
    {modal?.type === 'editTransaction' && <EditTransactionModal transaction={modal.transaction} members={members} onClose={() => setModal(null)} onSave={editTransactionInFirestore} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function Dashboard({ stats, months, messages }) {
  const liveRows = [
    { label: 'Tea Club Dashboard', value: '', note: 'Live monthly-only data from Firestore.' },
    { label: 'Current cash balance', value: toMoney(stats.balance), note: 'Income minus expenses.' },
    { label: 'Monthly outstanding now', value: toMoney(stats.due), note: 'Calculated only from due or overdue months from July 2026.' },
    { label: 'Members OK', value: stats.activeMembers - stats.membersToChase, note: 'Active members without a due or overdue month.' },
    { label: 'Members to chase', value: stats.membersToChase, note: 'Active members with a due or overdue month.' },
    { label: 'Active monthly members', value: stats.activeMembers, note: 'Left or resigned members excluded.' },
    { label: 'Financial check', value: stats.balance >= 0 ? 'OK' : 'CHECK', note: 'Based on recorded transactions.' }
  ];

  return <section className="grid">
    <Stat title="Active members" value={stats.activeMembers} />
    <Stat title="All members" value={stats.allMembers} />
    <Stat title="Balance" value={toMoney(stats.balance)} tone={stats.balance >= 0 ? 'green' : 'red'} />
    <Stat title="Outstanding" value={toMoney(stats.due)} tone="orange" />
    <Stat title="Income" value={toMoney(stats.income)} tone="green" />
    <Stat title="Expenses" value={toMoney(stats.spent)} tone="red" />

    <div className="panel wide">
      <h2>Live monthly dashboard</h2>
      <table>
        <thead><tr><th>Item</th><th>Value</th><th>Note</th></tr></thead>
        <tbody>{liveRows.map((row, index) => <tr key={index}>
          <td>{row.label}</td>
          <td><b>{row.value}</b></td>
          <td>{row.note}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="panel">
      <h2>System</h2>
      <p className="alert good">✓ Connected to teaClub/main</p>
      <p className="alert good">✓ Monthly-only member statuses</p>
      <p className="alert good">✓ Outstanding calculated live</p>
      <p><b>Months:</b> {months.join(', ') || '-'}</p>
      <p><b>Messages:</b> {messages.length}</p>
    </div>
  </section>;
}

function Members({
  members,
  total,
  onAdd,
  onMonthChange,
  onEdit,
  hideLeftMembers,
  onToggleHideLeft
}) {
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
        <button className="secondary" onClick={onToggleHideLeft}>
          {hideLeftMembers ? 'Show left members' : 'Hide left members'}
        </button>

        <button className="secondary" onClick={() => setAllOpen(v => !v)}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>

        <button className="primary" onClick={onAdd}>
          <Plus size={18}/>Add member
        </button>
      </div>
    </div>

    <div className="members">
      {members.map(member => (
        <MemberCard
          key={member.id}
          member={member}
          forceOpen={allOpen}
          onMonthChange={onMonthChange}
          onEdit={onEdit}
        />
      ))}
    </div>
  </section>;
}

function memberOverallStatus(member) {
  const text = `${member.tag} ${member.note}`.toLowerCase();
  if (member.resigned || text.includes('resign') || text.includes('left')) return 'left';
  if ((member.counts?.overdue || 0) > 0) return 'due';
  if ((member.counts?.due || 0) > 0) return 'warn';
  return 'active';
}

function nextManualStatus(current) {
  if (current === 'paid') return 'due';
  if (current === 'due') return 'overdue';
  if (current === 'overdue') return 'future';
  return 'paid';
}

function MemberCard({ member, forceOpen, onMonthChange, onEdit }) {
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
      <div className="memberEditRow">
        <button type="button" className="editMemberButton" onClick={() => onEdit(member)}>
          <Pencil size={16}/> Edit member
        </button>
      </div>
      <p className="note">{member.note || 'No notes'}</p>

      <div className="memberStats">
        <div><span>Monthly</span><b>{toMoney(member.monthlyFee)}</b></div>
        <div><span>Due</span><b className={member.due > 0 ? 'dueText' : 'okText'}>{toMoney(member.due)}</b></div>
      </div>

      <div className="miniInfo">
        <span>Paid until <b>{paidUntil}</b></span>
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

function Transactions({ transactions, onAddPayment, onAddExpense, onEdit, onDelete }) {
  const [filter, setFilter] = useState('');
  const visible = transactions.filter(tx =>
    [tx.id, tx.date, tx.type, tx.member, tx.description, tx.category]
      .join(' ')
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  return <section className="panel">
    <div className="panelTitle">
      <div>
        <h2>Transactions</h2>
        <p className="muted">{visible.length} displayed of {transactions.length}</p>
      </div>
      <div className="panelActions">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter transactions..." />
        <button className="primary" onClick={onAddPayment}>Add payment</button>
        <button className="secondary" onClick={onAddExpense}>Add expense</button>
      </div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Member</th><th>Months</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
      <tbody>{visible.map((tx, index) => <tr key={`${tx.id}-${index}`}>
        <td>{String(tx.date)}</td>
        <td>{tx.type}</td>
        <td>{tx.member}</td>
        <td>{tx.months?.length ? tx.months.join(', ') : '-'}</td>
        <td>{tx.description}</td>
        <td className={Number(tx.amount) >= 0 ? 'money' : 'cost'}>{Number(tx.amount) >= 0 ? '+' : ''}{toMoney(tx.amount)}</td>
        <td>
          <div className="rowActions">
            <button className="iconAction" onClick={() => onEdit(tx)} title="Edit"><Pencil size={15}/></button>
            <button className="iconAction danger" onClick={() => onDelete(tx)} title="Delete"><Trash2 size={15}/></button>
          </div>
        </td>
      </tr>)}</tbody>
    </table>
  </section>;
}

function Reports({ stats, transactions, members }) {
  const [month, setMonth] = useState(monthKey(new Date().getMonth()));
  const monthTransactions = transactions.filter(tx =>
    String(tx.date || '').startsWith(month) || (tx.months || []).includes(month)
  );
  const monthIncome = monthTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const monthSpent = Math.abs(monthTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0));
  const monthIndex = monthToIndex(month);
  const paidMembers = members.filter(member => getMonthStatus(member, monthIndex) === 'paid');
  const unpaidMembers = members.filter(member => !member.resigned && ['due', 'overdue'].includes(getMonthStatus(member, monthIndex)));

  function exportCsv() {
    const rows = [
      ['Report month', month],
      ['Income', monthIncome],
      ['Expenses', monthSpent],
      ['Balance', monthIncome - monthSpent],
      [],
      ['Paid members'],
      ...paidMembers.map(member => [member.name]),
      [],
      ['Outstanding members'],
      ...unpaidMembers.map(member => [member.name, member.monthlyFee])
    ];
    downloadTextFile(`tea-club-report-${month}.csv`, rows.map(row => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  return <section className="grid">
    <Stat title="Month income" value={toMoney(monthIncome)} tone="green" />
    <Stat title="Month expenses" value={toMoney(monthSpent)} tone="red" />
    <Stat title="Month balance" value={toMoney(monthIncome - monthSpent)} tone={monthIncome - monthSpent >= 0 ? 'green' : 'red'} />
    <Stat title="Paid members" value={paidMembers.length} />
    <Stat title="Outstanding members" value={unpaidMembers.length} tone="orange" />

    <div className="panel wide">
      <div className="panelTitle">
        <div><h2>Monthly report</h2><p className="muted">Monthly-only membership report</p></div>
        <div className="panelActions">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <button className="primary" onClick={exportCsv}><FileDown size={16}/>Export CSV</button>
        </div>
      </div>
      <div className="reportColumns">
        <div><h3>Paid ({paidMembers.length})</h3>{paidMembers.map(member => <p key={member.id}>✓ {member.name}</p>)}</div>
        <div><h3>Outstanding ({unpaidMembers.length})</h3>{unpaidMembers.map(member => <p key={member.id}>⚠ {member.name} — {toMoney(member.monthlyFee)}</p>)}</div>
      </div>
    </div>
  </section>;
}

function Stock({ items, onChange }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [minimum, setMinimum] = useState('1');
  const [unit, setUnit] = useState('items');

  function addItem(event) {
    event.preventDefault();
    if (!name.trim()) return;
    onChange([...items, { id: Date.now(), name: name.trim(), quantity: Number(quantity), minimum: Number(minimum), unit }]);
    setName('');
  }

  function updateItem(id, changes) {
    onChange(items.map(item => item.id === id ? { ...item, ...changes } : item));
  }

  function removeItem(id) {
    onChange(items.filter(item => item.id !== id));
  }

  return <section>
    <div className="heroPanel">
      <div><span className="eyebrow">Local stock register</span><h2>Stock</h2><p>Low-stock items are highlighted automatically.</p></div>
    </div>

    <form className="panel stockForm" onSubmit={addItem}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Product name" />
      <input type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quantity" />
      <input type="number" min="0" value={minimum} onChange={e => setMinimum(e.target.value)} placeholder="Minimum" />
      <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit" />
      <button className="primary" type="submit"><Plus size={16}/>Add product</button>
    </form>

    <div className="stock">
      {items.map(item => {
        const low = Number(item.quantity) <= Number(item.minimum);
        return <div className="stockItem" key={item.id}>
          <div className="panelTitle"><h3>{item.name}</h3><button className="iconAction danger" onClick={() => removeItem(item.id)}><Trash2 size={15}/></button></div>
          <p>{item.quantity} {item.unit}</p>
          <span className={low ? 'low' : 'ok'}>{low ? 'LOW' : 'OK'}</span>
          <div className="stockControls">
            <button onClick={() => updateItem(item.id, { quantity: Math.max(0, Number(item.quantity) - 1) })}>−</button>
            <button onClick={() => updateItem(item.id, { quantity: Number(item.quantity) + 1 })}>+</button>
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function AddMemberModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('ACTIVE');
  const [monthlyFee, setMonthlyFee] = useState('5');
  const [notes, setNotes] = useState('');
  const [monthsPaid, setMonthsPaid] = useState([monthKey(START_MONTH_INDEX)]);
  const [saving, setSaving] = useState(false);

  function toggleMonth(month) {
    setMonthsPaid(prev => prev.includes(month) ? prev.filter(item => item !== month) : [...prev, month].sort());
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({ name, category, monthlyFee, notes, monthsPaid });
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
      <label>Monthly fee<input type="number" min="0" step="0.01" value={monthlyFee} onChange={event => setMonthlyFee(event.target.value)} /></label>
      <label>Notes<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional note" /></label>

      <div className="monthPicker"><p>Months paid</p>{monthValues.map((value, index) => <button type="button" key={value} disabled={index < START_MONTH_INDEX} onClick={() => toggleMonth(value)} className={index < START_MONTH_INDEX ? 'inactive' : monthsPaid.includes(value) ? 'paid' : 'future'}>{monthLabels[index]}</button>)}</div>

      <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Saving...' : 'Save member'}</button></div>
    </form>
  </div>;
}

function EditMemberModal({ member, onClose, onSave }) {
  const [name, setName] = useState(member.name || '');
  const [category, setCategory] = useState(member.resigned ? 'RED - left/resigned' : (member.raw?.monthlyCategory || member.raw?.category || 'ACTIVE'));
  const [monthlyFee, setMonthlyFee] = useState(String(member.monthlyFee || 5));
  const [notes, setNotes] = useState(member.raw?.notes || member.raw?.monthlyNotes || member.note || '');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({
      originalId: member.raw?.id ?? member.id,
      originalName: member.name,
      name,
      category,
      monthlyFee,
      notes
    });
    if (!ok) setSaving(false);
  }

  return <div className="modal" onClick={onClose}>
    <form className="modalCard" onClick={event => event.stopPropagation()} onSubmit={submit}>
      <button type="button" className="close" onClick={onClose}><X size={18}/></button>
      <h2>Edit member</h2>
      <p className="muted">Change details or mark the member as left/resigned.</p>

      <label>Name<input autoFocus value={name} onChange={event => setName(event.target.value)} /></label>
      <label>Status<select value={category} onChange={event => setCategory(event.target.value)}>
        <option>ACTIVE</option>
        <option>ACTIVE - new member</option>
        <option>ORANGE - email not found</option>
        <option>RED - left/resigned</option>
      </select></label>
      <label>Monthly fee<input type="number" min="0" step="0.01" value={monthlyFee} onChange={event => setMonthlyFee(event.target.value)} /></label>
      <label>Notes<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional note" /></label>

      <div className="modalActions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button className="primary" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
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


function EditTransactionModal({ transaction, members, onClose, onSave }) {
  const [type, setType] = useState(transaction.type || 'Payment');
  const [member, setMember] = useState(transaction.member || '');
  const [amount, setAmount] = useState(String(Math.abs(Number(transaction.amount || 0))));
  const [category, setCategory] = useState(transaction.category || '');
  const [description, setDescription] = useState(transaction.description || '');
  const [months, setMonths] = useState(transaction.months || []);
  const [date, setDate] = useState(String(transaction.date || '').slice(0, 10));
  const [saving, setSaving] = useState(false);

  function toggleMonth(value) {
    setMonths(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value].sort());
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({ id: transaction.id, type, member, amount, category, description, months, date });
    if (!ok) setSaving(false);
  }

  return <div className="modal" onClick={onClose}>
    <form className="modalCard" onClick={event => event.stopPropagation()} onSubmit={submit}>
      <button type="button" className="close" onClick={onClose}><X size={18}/></button>
      <h2>Edit transaction</h2>
      <label>Type<select value={type} onChange={e => setType(e.target.value)}><option>Payment</option><option>Expense</option></select></label>
      {type !== 'Expense' && <label>Member<select value={member} onChange={e => setMember(e.target.value)}>{members.filter(m => !m.resigned).map(m => <option key={m.id}>{m.name}</option>)}</select></label>}
      <div className="formGrid"><label>Amount<input value={amount} onChange={e => setAmount(e.target.value)}/></label><label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)}/></label></div>
      {type !== 'Expense' && <div className="monthPicker"><p>Months</p>{monthLabels.map((label, index) => {
        const value = monthKey(index);
        return <button type="button" key={value} disabled={index < START_MONTH_INDEX} className={index < START_MONTH_INDEX ? 'inactive' : months.includes(value) ? 'paid' : 'future'} onClick={() => toggleMonth(value)}>{label}</button>;
      })}</div>}
      <label>Category<input value={category} onChange={e => setCategory(e.target.value)}/></label>
      <label>Description<input value={description} onChange={e => setDescription(e.target.value)}/></label>
      <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}><Save size={16}/>{saving ? 'Saving...' : 'Save changes'}</button></div>
    </form>
  </div>;
}

function Settings({ data, settings, onChange }) {
  const [draft, setDraft] = useState(settings);

  function save(event) {
    event.preventDefault();
    onChange({ ...draft, monthlyFee: Number(draft.monthlyFee || 5) });
  }

  return <section className="panel settingsPanel">
    <div className="panelTitle"><div><h2>Settings</h2><p className="muted">Poster and club defaults</p></div></div>
    <form onSubmit={save}>
      <div className="formGrid">
        <label>Club title<input value={draft.clubName} onChange={e => setDraft({ ...draft, clubName: e.target.value })}/></label>
        <label>Monthly fee<input type="number" step="0.01" value={draft.monthlyFee} onChange={e => setDraft({ ...draft, monthlyFee: e.target.value })}/></label>
        <label>Contact name<input value={draft.contactName} onChange={e => setDraft({ ...draft, contactName: e.target.value })}/></label>
        <label>Phone<input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/></label>
      </div>
      <label>Email<input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label>
      <label>Available drinks<input value={(draft.drinks || []).join(', ')} onChange={e => setDraft({ ...draft, drinks: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })}/></label>
      <div className="modalActions"><button className="primary" type="submit"><Save size={16}/>Save settings</button></div>
    </form>
    <p><b>Firestore document:</b> teaClub/main</p>
    <p><b>Members loaded:</b> {data.members.length}</p>
    <p><b>Transactions loaded:</b> {data.transactions.length}</p>
  </section>;
}
function Stat({ title, value, tone }){ return <div className={`stat ${tone || ''}`}><span>{title}</span><b>{value}</b></div>; }

createRoot(document.getElementById('root')).render(<App />);
