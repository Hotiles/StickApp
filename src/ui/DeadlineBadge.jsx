/*
 * Nedräkningsbadge för projektdeadline: "Julklapp · om 18 dagar".
 * Blir varningsfärgad när det är 3 dagar kvar eller försenat.
 */
export function deadlineDaysLeft(deadline) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const then = new Date(deadline);
  then.setHours(0, 0, 0, 0);
  return Math.round((then - today) / 86400000);
}

export default function DeadlineBadge({ deadline, label }) {
  if (!deadline) return null;
  const days = deadlineDaysLeft(deadline);
  let when;
  if (days < -1) when = `${-days} dagar sen`;
  else if (days === -1) when = 'igår!';
  else if (days === 0) when = 'idag!';
  else if (days === 1) when = 'imorgon';
  else when = `om ${days} dagar`;
  const urgent = days <= 3;
  return (
    <span className={`deadline-badge ${urgent ? 'deadline-badge-urgent' : ''}`}>
      {label ? `${label} · ${when}` : `Klart ${when}`}
    </span>
  );
}
