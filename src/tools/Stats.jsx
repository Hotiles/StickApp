import { useEffect, useState } from 'react';
import { listProjects, listYarns } from '../storage/storage.js';
import TopBar from '../ui/TopBar.jsx';
import YarnBall from '../ui/YarnBall.jsx';
import { SkeletonCards } from '../ui/Skeleton.jsx';

/*
 * Ditt stickår: ren glädje-statistik ur data som redan finns.
 * Stat-tiles, inga diagram — siffrorna är poängen.
 */
export default function Stats() {
  const [projects, setProjects] = useState(null);
  const [yarns, setYarns] = useState(null);

  useEffect(() => {
    listProjects().then(setProjects);
    listYarns().then(setYarns);
  }, []);

  if (projects === null || yarns === null) {
    return (
      <div className="view">
        <TopBar title="Ditt stickår" backTo="/" />
        <main className="view-body">
          <SkeletonCards count={3} />
        </main>
      </div>
    );
  }

  const year = new Date().getFullYear();
  const finished = projects.filter((p) => p.status === 'färdigt');
  const finishedThisYear = finished.filter((p) => (p.updatedAt || '').startsWith(String(year)));
  const ongoing = projects.filter((p) => p.status === 'pågående');
  const totalRows = projects.reduce(
    (sum, p) => sum + (p.counters || []).reduce((s, c) => s + (c.value || 0), 0),
    0
  );
  const photoCount = projects.reduce((sum, p) => sum + (p.photoBlobIds?.length || 0), 0);
  const rated = finished.filter((p) => p.difficulty);
  const avgDifficulty = rated.length
    ? rated.reduce((s, p) => s + p.difficulty, 0) / rated.length
    : null;

  const byYear = new Map();
  for (const p of finished) {
    const y = (p.updatedAt || '').slice(0, 4);
    if (y) byYear.set(y, (byYear.get(y) || 0) + 1);
  }
  const years = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const empty = projects.length === 0;

  return (
    <div className="view">
      <TopBar title="Ditt stickår" backTo="/" />
      <main className="view-body">
        {empty ? (
          <div className="empty-state">
            <YarnBall />
            <p>Ingen statistik än.</p>
            <p className="empty-state-hint">Börja sticka så räknar vi åt dig!</p>
          </div>
        ) : (
          <>
            <div className="stat-hero">
              <span className="stat-hero-value">{finishedThisYear.length}</span>
              <span className="stat-hero-label">
                {finishedThisYear.length === 1 ? 'färdigt projekt' : 'färdiga projekt'} {year}
              </span>
            </div>

            <div className="stat-grid">
              <StatTile value={finished.length} label="färdiga totalt" />
              <StatTile value={ongoing.length} label="på stickorna nu" />
              <StatTile value={totalRows.toLocaleString('sv-SE')} label="räknade varv" />
              <StatTile value={photoCount} label="projektfoton" />
              <StatTile value={yarns.length} label="garn i korgen" />
              {avgDifficulty !== null && (
                <StatTile
                  value={avgDifficulty.toFixed(1).replace('.', ',')}
                  label="svårighet i snitt (1–5)"
                />
              )}
            </div>

            {years.length > 0 && (
              <section>
                <h2 className="section-title">Färdigt per år</h2>
                <dl className="details-list">
                  {years.map(([y, count]) => (
                    <div key={y} className="details-row">
                      <dt>{y}</dt>
                      <dd>
                        {count} {count === 1 ? 'projekt' : 'projekt'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatTile({ value, label }) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
