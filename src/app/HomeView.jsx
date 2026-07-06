import { useEffect, useState } from 'react';
import { navigate } from './router.jsx';
import { listProjects, getSettings, listPatterns, createProject } from '../storage/storage.js';
import Modal from '../ui/Modal.jsx';
import PatternThumb from '../patterns/PatternThumb.jsx';
import { YarnColorPicker, yarnColorValue, randomYarnColorId } from '../ui/yarnColors.jsx';
import YarnBall from '../ui/YarnBall.jsx';
import { SkeletonCards } from '../ui/Skeleton.jsx';

export default function HomeView() {
  const [projects, setProjects] = useState(null);
  const [settings, setSettings] = useState(null);
  const [patternById, setPatternById] = useState({});
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    listProjects('pågående').then(setProjects);
    getSettings().then(setSettings);
    listPatterns().then((all) => {
      const map = {};
      for (const p of all) map[p.id] = p;
      setPatternById(map);
    });
  }, []);

  const needsBackup =
    settings &&
    (!settings.lastBackupAt ||
      Date.now() - new Date(settings.lastBackupAt).getTime() > 30 * 24 * 60 * 60 * 1000);

  // Hjältekortet: senast öppnade pågående projektet — ett tryck och du är
  // tillbaka på rätt varv. Faller tillbaka på det senast uppdaterade.
  const hero =
    (projects &&
      settings &&
      (projects.find((p) => p.id === settings.lastOpenedProjectId) ?? projects[0])) ||
    null;
  const restProjects = hero ? projects.filter((p) => p.id !== hero.id) : projects;

  return (
    <div className="view">
      <header className="home-header">
        <h1 className="home-title">Stickan</h1>
        <button className="btn-icon" onClick={() => navigate('/installningar')} aria-label="Inställningar">
          <GearIcon />
        </button>
      </header>

      <main className="view-body">
        {needsBackup && (
          <button className="backup-reminder" onClick={() => navigate('/installningar')}>
            {settings.lastBackupAt
              ? 'Det var över en månad sedan senaste säkerhetskopian.'
              : 'Du har inte tagit någon säkerhetskopia än.'}{' '}
            <span className="backup-reminder-link">Säkerhetskopiera →</span>
          </button>
        )}

        {hero && (
          <button
            className="hero-card"
            style={{ '--project-color': yarnColorValue(hero.color) }}
            onClick={() => navigate(`/projekt/${hero.id}`)}
          >
            {hero.patternId && patternById[hero.patternId] && (
              <PatternThumb pattern={patternById[hero.patternId]} className="hero-thumb" />
            )}
            <span className="hero-text">
              <span className="hero-eyebrow">Fortsätt sticka</span>
              <span className="hero-name">{hero.name}</span>
              {hero.counters?.[0] && (
                <span className="hero-meta">
                  {hero.counters[0].label} {hero.counters[0].value}
                </span>
              )}
            </span>
            <span className="project-card-arrow">›</span>
          </button>
        )}

        {projects === null && (
          <section>
            <h2 className="section-title">Pågående projekt</h2>
            <SkeletonCards count={2} />
          </section>
        )}

        {projects !== null && (projects.length === 0 || restProjects.length > 0) && (
        <section>
          <h2 className="section-title">{hero ? 'Fler pågående projekt' : 'Pågående projekt'}</h2>
          {projects.length === 0 ? (
            <div className="empty-state">
              <YarnBall />
              <p>Inga pågående projekt.</p>
              <p className="empty-state-hint">Tryck på ”Nytt projekt” för att komma igång!</p>
            </div>
          ) : (
            <ul className="card-list">
              {restProjects.map((p) => (
                <li key={p.id}>
                  <button
                    className="project-card"
                    style={{ '--project-color': yarnColorValue(p.color) }}
                    onClick={() => navigate(`/projekt/${p.id}`)}
                  >
                    {p.patternId && patternById[p.patternId] && (
                      <PatternThumb pattern={patternById[p.patternId]} className="project-card-thumb" />
                    )}
                    <span className="project-card-name">{p.name}</span>
                    <span className="project-card-meta">
                      {p.counters?.[0] ? `${p.counters[0].label}: ${p.counters[0].value}` : ''}
                    </span>
                    <span className="project-card-arrow">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        <section className="home-shortcuts">
          <button className="shortcut shortcut-primary" onClick={() => setShowNewProject(true)}>
            <span className="shortcut-icon">+</span>
            Nytt projekt
          </button>
          <button className="shortcut" onClick={() => navigate('/monster')}>
            <span className="shortcut-icon">
              <PdfIcon />
            </span>
            Mönster
          </button>
          <button className="shortcut" onClick={() => navigate('/fardiga')}>
            <span className="shortcut-icon">
              <CheckIcon />
            </span>
            Färdiga projekt
          </button>
        </section>
      </main>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}

export function NewProjectModal({ onClose, defaultPatternId = null }) {
  const [name, setName] = useState('');
  const [patternId, setPatternId] = useState(defaultPatternId ?? '');
  const [color, setColor] = useState(randomYarnColorId);
  const [patterns, setPatterns] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPatterns().then(setPatterns);
  }, []);

  async function create(e) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const project = await createProject({ name: trimmed, patternId: patternId || null, color });
    navigate(`/projekt/${project.id}`);
  }

  return (
    <Modal
      title="Nytt projekt"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={create} disabled={!name.trim() || saving}>
            Skapa
          </button>
        </>
      }
    >
      <form onSubmit={create} className="form">
        <label className="field">
          <span className="field-label">Namn</span>
          <input
            className="input"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Sockor till mamma"
          />
        </label>
        <label className="field">
          <span className="field-label">Mönster (valfritt)</span>
          <select className="input" value={patternId} onChange={(e) => setPatternId(e.target.value)}>
            <option value="">Inget mönster</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">Garnfärg</span>
          <YarnColorPicker value={color} onChange={setColor} />
        </div>
      </form>
    </Modal>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
