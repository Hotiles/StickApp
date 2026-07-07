import { useEffect, useState } from 'react';
import { navigate } from '../app/router.jsx';
import { listPatterns, createProject } from '../storage/storage.js';
import Modal from '../ui/Modal.jsx';
import { YarnColorPicker, randomYarnColorId } from '../ui/yarnColors.jsx';

export default function NewProjectModal({ onClose, defaultPatternId = null }) {
  const [name, setName] = useState('');
  const [patternId, setPatternId] = useState(defaultPatternId ?? '');
  const [color, setColor] = useState(randomYarnColorId);
  const [patterns, setPatterns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listPatterns().then(setPatterns);
  }, []);

  async function create(e) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const project = await createProject({ name: trimmed, patternId: patternId || null, color });
      navigate(`/projekt/${project.id}`);
    } catch {
      setError('Kunde inte skapa projektet. Prova igen.');
      setSaving(false);
    }
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
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
