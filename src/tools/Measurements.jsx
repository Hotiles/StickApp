import { useEffect, useState } from 'react';
import { listPersons, createPerson, updatePerson, deletePerson, uuid } from '../storage/storage.js';
import TopBar from '../ui/TopBar.jsx';
import Modal from '../ui/Modal.jsx';
import YarnBall from '../ui/YarnBall.jsx';
import { SkeletonCards } from '../ui/Skeleton.jsx';

/*
 * Måttbanken: personer man stickar till, med deras mått —
 * "mammas fotlängd 24 cm" ska aldrig behöva letas fram i sms-historiken.
 */
export default function Measurements() {
  const [persons, setPersons] = useState(null);
  const [editing, setEditing] = useState(null); // { id|null, name, rows }
  const [confirmDelete, setConfirmDelete] = useState(null);

  const reload = () => listPersons().then(setPersons);
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="view">
      <TopBar
        title="Måttbanken"
        backTo="/"
        right={
          <button
            className="btn btn-primary btn-small"
            onClick={() => setEditing({ id: null, name: '', rows: [emptyRow()] })}
          >
            + Person
          </button>
        }
      />
      <main className="view-body">
        {persons === null ? (
          <SkeletonCards count={2} />
        ) : persons.length === 0 ? (
          <div className="empty-state">
            <YarnBall />
            <p>Inga personer sparade än.</p>
            <p className="empty-state-hint">
              Spara mått på dem du stickar till — fotlängd, huvudomkrets, ärmlängd …
            </p>
          </div>
        ) : (
          <ul className="card-list">
            {persons.map((person) => (
              <li key={person.id}>
                <button
                  className="person-card"
                  onClick={() =>
                    setEditing({
                      id: person.id,
                      name: person.name,
                      rows: person.rows?.length ? person.rows.map((r) => ({ ...r })) : [emptyRow()],
                    })
                  }
                >
                  <span className="person-name">{person.name}</span>
                  {person.rows?.length > 0 ? (
                    <dl className="person-rows">
                      {person.rows.map((r) => (
                        <div key={r.id} className="person-row">
                          <dt>{r.label}</dt>
                          <dd>{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <span className="pattern-meta">Inga mått ifyllda än</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editing && (
        <Modal
          title={editing.id ? editing.name || 'Redigera' : 'Ny person'}
          onClose={() => setEditing(null)}
          actions={
            <>
              {editing.id && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setConfirmDelete(editing);
                    setEditing(null);
                  }}
                >
                  Ta bort
                </button>
              )}
              <button className="btn" onClick={() => setEditing(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                disabled={!editing.name.trim()}
                onClick={async () => {
                  const rows = editing.rows.filter((r) => r.label.trim() || r.value.trim());
                  if (editing.id) {
                    await updatePerson(editing.id, { name: editing.name.trim(), rows });
                  } else {
                    const person = await createPerson(editing.name);
                    await updatePerson(person.id, { rows });
                  }
                  setEditing(null);
                  reload();
                }}
              >
                Spara
              </button>
            </>
          }
        >
          <div className="form">
            <label className="field">
              <span className="field-label">Namn</span>
              <input
                className="input"
                autoFocus={!editing.id}
                value={editing.name}
                maxLength={40}
                placeholder="T.ex. Mamma"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>

            <div className="field">
              <span className="field-label">Mått</span>
              {editing.rows.map((row, i) => (
                <div key={row.id} className="measure-row">
                  <input
                    className="input"
                    value={row.label}
                    maxLength={30}
                    placeholder="T.ex. Fotlängd"
                    onChange={(e) => setEditing(updateRow(editing, i, { label: e.target.value }))}
                  />
                  <input
                    className="input"
                    value={row.value}
                    maxLength={20}
                    placeholder="24 cm"
                    onChange={(e) => setEditing(updateRow(editing, i, { value: e.target.value }))}
                  />
                  <button
                    className="btn-icon"
                    aria-label="Ta bort måttet"
                    onClick={() =>
                      setEditing({ ...editing, rows: editing.rows.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn btn-small"
                onClick={() => setEditing({ ...editing, rows: [...editing.rows, emptyRow()] })}
              >
                + Lägg till mått
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Ta bort personen?"
          onClose={() => setConfirmDelete(null)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await deletePerson(confirmDelete.id);
                  setConfirmDelete(null);
                  reload();
                }}
              >
                Ta bort
              </button>
            </>
          }
        >
          <p>”{confirmDelete.name}” och alla sparade mått tas bort.</p>
        </Modal>
      )}
    </div>
  );
}

function emptyRow() {
  return { id: uuid(), label: '', value: '' };
}

function updateRow(editing, index, changes) {
  return {
    ...editing,
    rows: editing.rows.map((r, i) => (i === index ? { ...r, ...changes } : r)),
  };
}
