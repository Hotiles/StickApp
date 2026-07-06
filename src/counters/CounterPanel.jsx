import { useState } from 'react';
import Counter from './Counter.jsx';
import Modal from '../ui/Modal.jsx';
import { uuid } from '../storage/storage.js';

/*
 * Räknarpanelen: dockad nertill, alltid synlig i mönsterläge.
 * Långtrycksmenyn: Backa 1 / Nollställ / Byt namn / Ta bort.
 * Räknare kan läggas till och tas bort (minst 1 kvar).
 */
const MAX_COUNTERS = 6;

export default function CounterPanel({ counters, onChange }) {
  const [menuFor, setMenuFor] = useState(null); // counter-id
  const [renaming, setRenaming] = useState(null); // { id, label }

  const menuCounter = counters.find((c) => c.id === menuFor);

  function updateCounter(id, changes) {
    onChange(counters.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  function addCounter() {
    if (counters.length >= MAX_COUNTERS) return;
    onChange([...counters, { id: uuid(), label: `Räknare ${counters.length + 1}`, value: 0 }]);
    setMenuFor(null);
  }

  function removeCounter(id) {
    if (counters.length <= 1) return;
    onChange(counters.filter((c) => c.id !== id));
    setMenuFor(null);
  }

  return (
    <div className="counter-panel">
      {counters.map((counter) => (
        <Counter
          key={counter.id}
          counter={counter}
          onIncrement={() => updateCounter(counter.id, { value: counter.value + 1 })}
          onDecrement={() => updateCounter(counter.id, { value: Math.max(0, counter.value - 1) })}
          onOpenMenu={() => setMenuFor(counter.id)}
        />
      ))}

      {menuCounter && (
        <Modal title={menuCounter.label} onClose={() => setMenuFor(null)}>
          <div className="menu-list">
            <button
              className="menu-item"
              onClick={() => {
                updateCounter(menuCounter.id, { value: Math.max(0, menuCounter.value - 1) });
                setMenuFor(null);
              }}
            >
              Backa 1
            </button>
            <button
              className="menu-item"
              onClick={() => {
                updateCounter(menuCounter.id, { value: 0 });
                setMenuFor(null);
              }}
            >
              Nollställ
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setRenaming({ id: menuCounter.id, label: menuCounter.label });
                setMenuFor(null);
              }}
            >
              Byt namn
            </button>
            {counters.length < MAX_COUNTERS && (
              <button className="menu-item" onClick={addCounter}>
                Lägg till räknare
              </button>
            )}
            {counters.length > 1 && (
              <button className="menu-item menu-item-danger" onClick={() => removeCounter(menuCounter.id)}>
                Ta bort räknaren
              </button>
            )}
          </div>
        </Modal>
      )}

      {renaming && (
        <Modal
          title="Byt namn"
          onClose={() => setRenaming(null)}
          actions={
            <>
              <button className="btn" onClick={() => setRenaming(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (renaming.label.trim()) updateCounter(renaming.id, { label: renaming.label.trim() });
                  setRenaming(null);
                }}
              >
                Spara
              </button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming.label.trim()) updateCounter(renaming.id, { label: renaming.label.trim() });
              setRenaming(null);
            }}
          >
            <input
              className="input"
              autoFocus
              value={renaming.label}
              maxLength={30}
              onChange={(e) => setRenaming({ ...renaming, label: e.target.value })}
              placeholder="T.ex. Varv, Mönsterrapport …"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
