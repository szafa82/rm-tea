import { useState } from 'react';

const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toMoney(value) {
  const number = Number(value || 0);
  return `£${number.toFixed(2)}`;
}

export default function MemberCard({ member, onToggleMonth }) {
  const [open, setOpen] = useState(false);
  const summary = member.monthSummary || {};
  const hasOverdue = Number(summary.overdue || 0) > 0;
  const hasDue = Number(summary.due || 0) > 0;
  const cardStatus = member.resigned ? 'left' : hasOverdue ? 'overdue' : hasDue ? 'due' : 'active';

  return (
    <article className={`member member-${cardStatus}`}>
      <button className="memberHeader" type="button" onClick={() => setOpen(prev => !prev)}>
        <div className="avatar">{member.name?.[0] || '?'}</div>
        <div className="memberHeaderText">
          <h3>{member.name}</h3>
          <p>Paid {summary.paid || 0} • Due {summary.due || 0} • Overdue {summary.overdue || 0}</p>
        </div>
        <span className={`statusBadge ${cardStatus}`}>{member.tag}</span>
        <span className="chevron">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="memberBody">
          <p className="note">{member.note || 'No notes'}</p>

          <div className="memberStats">
            <div><span>Monthly</span><b>{toMoney(member.monthlyFee)}</b></div>
            <div><span>Weekly</span><b>{toMoney(member.weeklyFee)}</b></div>
            <div><span>Due</span><b className={member.due > 0 ? 'dueText' : 'okText'}>{toMoney(member.due)}</b></div>
          </div>

          <div className="miniInfo">
            <span>Last week <b>{member.lastPaidWeek}</b></span>
            <span>Weekly <b>{member.weeklyStatus}</b></span>
            <span>Credit <b>{toMoney(member.credit)}</b></span>
          </div>

          <div className="months compactMonths">
            {(member.months || []).map(month => (
              <button
                key={month.value}
                type="button"
                disabled={month.locked}
                title={month.locked ? 'Inactive before July 2026' : 'Click to change status'}
                className={`monthChip month-${month.status}`}
                onClick={() => onToggleMonth(member, month)}
              >
                <span>{month.label}</span>
                <small>{month.status}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
