import MemberCard from "./MemberCard";

export default function Members({
  members,
  total,
  onAdd,
  onToggleMonth
}) {
  const activeCount = members.filter(m => !m.resigned).length;
  const dueCount = members.filter(
    m => (m.monthSummary?.due || 0) + (m.monthSummary?.overdue || 0) > 0
  ).length;

  return (
    <section>
      <div className="heroPanel membersHero">
        <div>
          <span className="eyebrow">Firestore live data</span>
          <h2>Members</h2>

          <p>
            {members.length} displayed of {total} loaded ·{" "}
            {activeCount} active ·{" "}
            {dueCount} with outstanding payments
          </p>
        </div>

        <button className="primary" onClick={onAdd}>
          Add member
        </button>
      </div>

      <div className="members">
        {members.map(member => (
          <MemberCard
            key={member.id}
            member={member}
            onToggleMonth={onToggleMonth}
          />
        ))}
      </div>
    </section>
  );
}
