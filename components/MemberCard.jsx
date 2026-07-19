import { useState } from 'react';

function toMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

const monthLabels=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function MemberCard({ member, onMonthChange, onEdit }) {
  const [open,setOpen]=useState(false);
  const counts=member.counts||{};
  const paidUntil=member.paid?.length?monthLabels[Math.max(...member.paid)]:'-';

  return (
    <article className={`member ${member.resigned?'member-left':'member-active'}`}>
      <button className="memberHeader" type="button" onClick={()=>setOpen(v=>!v)}>
        <div className="avatar">{member.name?.[0]||'?'}</div>
        <div className="memberHeaderText">
          <h3>{member.name}</h3>
          <p>Paid {counts.paid||0} • Due {counts.due||0} • Overdue {counts.overdue||0}</p>
        </div>
        <span className="chevron">{open?'▼':'▶'}</span>
      </button>

      {open && (
        <div className="memberBody">
          <p className="note">{member.note || 'No notes'}</p>

          <div className="memberStats">
            <div><span>Monthly</span><b>{toMoney(member.monthlyFee)}</b></div>
            <div><span>Outstanding</span><b className={member.due>0?'dueText':'okText'}>{toMoney(member.due)}</b></div>
            <div><span>Paid until</span><b>{paidUntil}</b></div>
          </div>

          <div className="months compactMonths">
            {monthLabels.map((m,i)=>{
              const status=member.monthStatuses?.[`2026-${String(i+1).padStart(2,'0')}`] || 'future';
              return (
                <button
                  key={m}
                  type="button"
                  disabled={i<6}
                  className={`monthCell ${status}`}
                  onClick={()=>onMonthChange?.(member.id,i,status==='paid'?'due':'paid')}>
                  <span>{m}</span>
                </button>
              );
            })}
          </div>

          {onEdit && (
            <button className="editMemberButton" onClick={()=>onEdit(member)}>
              Edit member
            </button>
          )}
        </div>
      )}
    </article>
  );
}
