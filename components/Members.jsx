import MemberCard from "./MemberCard";

export default function Members({
  members,
  total,
  onAdd,
  onMonthChange,
  onEdit,
  hideLeftMembers,
  onToggleHideLeft
}) {
  const active=members.filter(m=>!m.resigned).length;
  const overdue=members.filter(m=>(m.counts?.overdue||0)>0).length;

  return (
    <section>
      <div className="heroPanel membersHero">
        <div>
          <span className="eyebrow">Firestore live data</span>
          <h2>Members</h2>
          <p>{members.length} displayed of {total} loaded · {active} active · {overdue} overdue</p>
        </div>

        <div className="panelActions">
          <button className="secondary" onClick={onToggleHideLeft}>
            {hideLeftMembers ? "Show left members":"Hide left members"}
          </button>
          <button className="primary" onClick={onAdd}>Add member</button>
        </div>
      </div>

      <div className="members">
        {members.map(member=>(
          <MemberCard
            key={member.id}
            member={member}
            onMonthChange={onMonthChange}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  );
}
