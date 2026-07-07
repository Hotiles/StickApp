import { useState } from 'react';
import Counter from './Counter.jsx';
import Modal from '../ui/Modal.jsx';
import { uuid } from '../storage/storage.js';
import { tickCounter, followersOf, followCandidates, nextTickMilestone } from './tick.js';

/*
 * Räknarpanelen: dockad nertill, alltid synlig i mönsterläge.
 * Långtrycksmenyn: Backa 1 / Nollställ / Byt namn / Mål / Upprepning /
 * Följ räknare. Räknare kan läggas till och tas bort (minst 1 kvar).
 *
 * Hänglåset (B2) gör alla räknare skrivskyddade — mot ficktryck och
 * småbarnstummar, som markeringstejp fast digital. Låset ligger på
 * projektet och överlever att appen dödas.
 *
 * Plus/minus går via tickCounter (tick.js) så att länkade räknare (B1)
 * tickar med och livstidsräkningen totalTicks (B3) hålls ärlig.
 */
const MAX_COUNTERS = 6;

export default function CounterPanel({ counters, locked, onChange, onToggleLock }) {
  const [menuFor, setMenuFor] = useState(null); // counter-id
  const [renaming, setRenaming] = useState(null); // { id, label }
  const [settingTarget, setSettingTarget] = useState(null); // { id, target }
  const [settingRepeat, setSettingRepeat] = useState(null); // { id, repeatEvery }
  const [pickingFollow, setPickingFollow] = useState(null); // counter-id
  const [lockNudge, setLockNudge] = useState(false);

  const menuCounter = counters.find((c) => c.id === menuFor);

  function updateCounter(id, changes) {
    onChange(counters.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  function tick(id, delta) {
    onChange(tickCounter(counters, id, delta));
  }

  // Tryck på en låst räknare: dra blicken till hänglåset i stället
  function nudgeLock() {
    setLockNudge(true);
    setTimeout(() => setLockNudge(false), 450);
  }

  function addCounter() {
    if (counters.length >= MAX_COUNTERS) return;
    onChange([
      ...counters,
      { id: uuid(), label: `Räknare ${counters.length + 1}`, value: 0, totalTicks: 0 },
    ]);
    setMenuFor(null);
  }

  function removeCounter(id) {
    if (counters.length <= 1) return;
    // Följare till den borttagna blir vanliga räknare igen
    onChange(
      counters
        .filter((c) => c.id !== id)
        .map((c) => (c.followsId === id ? { ...c, followsId: null } : c))
    );
    setMenuFor(null);
  }

  const menuFollows = menuCounter?.followsId
    ? counters.find((c) => c.id === menuCounter.followsId)
    : null;
  const menuFollowCandidates = menuCounter ? followCandidates(counters, menuCounter.id) : [];

  return (
    <div className="counter-panel">
      {counters.map((counter) => (
        <Counter
          key={counter.id}
          counter={counter}
          locked={locked}
          followsLabel={
            counter.followsId ? counters.find((c) => c.id === counter.followsId)?.label : null
          }
          nextMilestone={nextTickMilestone(counters, counter.id)}
          onIncrement={() => tick(counter.id, 1)}
          onDecrement={() => tick(counter.id, -1)}
          onLockedTap={nudgeLock}
          onOpenMenu={() => setMenuFor(counter.id)}
        />
      ))}

      <button
        className={`counter-lockbtn ${locked ? 'is-locked' : ''} ${
          lockNudge ? 'counter-lockbtn-nudge' : ''
        }`}
        onClick={() => {
          if (navigator.vibrate) navigator.vibrate(locked ? [10, 30, 10] : 10);
          onToggleLock();
        }}
        aria-pressed={locked}
        aria-label={locked ? 'Lås upp räknarna' : 'Lås räknarna'}
      >
        <LockIcon open={!locked} />
      </button>

      {menuCounter && (
        <Modal title={menuCounter.label} onClose={() => setMenuFor(null)}>
          <div className="menu-list">
            <button
              className="menu-item"
              onClick={() => {
                tick(menuCounter.id, -1);
                setMenuFor(null);
              }}
            >
              Backa 1
            </button>
            <button
              className="menu-item"
              onClick={() => {
                // Nollställning rör varken totalTicks (B3) eller följare (B1)
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
            <button
              className="menu-item"
              onClick={() => {
                setSettingTarget({ id: menuCounter.id, target: menuCounter.target || '' });
                setMenuFor(null);
              }}
            >
              {menuCounter.target ? `Ändra mål (${menuCounter.target})` : 'Sätt mål …'}
              <span className="menu-item-meta">T.ex. ”sticka till varv 120”</span>
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setSettingRepeat({ id: menuCounter.id, repeatEvery: menuCounter.repeatEvery || '' });
                setMenuFor(null);
              }}
            >
              {menuCounter.repeatEvery
                ? `Ändra upprepning (var ${menuCounter.repeatEvery}:e)`
                : 'Upprepning …'}
              <span className="menu-item-meta">T.ex. ”ökning var 6:e varv”</span>
            </button>
            {menuFollows ? (
              <button
                className="menu-item"
                onClick={() => {
                  updateCounter(menuCounter.id, { followsId: null });
                  setMenuFor(null);
                }}
              >
                Sluta följa ”{menuFollows.label}”
                <span className="menu-item-meta">Räknaren tickar bara på egna tryck igen</span>
              </button>
            ) : menuFollowCandidates.length > 0 ? (
              <button
                className="menu-item"
                onClick={() => {
                  setPickingFollow(menuCounter.id);
                  setMenuFor(null);
                }}
              >
                Följ en annan räknare …
                <span className="menu-item-meta">
                  Tickar med automatiskt — t.ex. Raglan följer Varv
                </span>
              </button>
            ) : null}
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

      {pickingFollow && (
        <Modal title="Följ räknare" onClose={() => setPickingFollow(null)}>
          <div className="menu-list">
            {followCandidates(counters, pickingFollow).map((candidate) => (
              <button
                key={candidate.id}
                className="menu-item"
                onClick={() => {
                  updateCounter(pickingFollow, { followsId: candidate.id });
                  setPickingFollow(null);
                }}
              >
                {candidate.label}
                <span className="menu-item-meta">
                  Plus och minus på ”{candidate.label}” tickar den här också. Egna tryck sprids
                  inte.
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {settingTarget && (
        <Modal
          title="Mål för räknaren"
          onClose={() => setSettingTarget(null)}
          actions={
            <>
              <button className="btn" onClick={() => setSettingTarget(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const n = parseInt(settingTarget.target, 10);
                  updateCounter(settingTarget.id, { target: n > 0 ? n : null });
                  setSettingTarget(null);
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
              const n = parseInt(settingTarget.target, 10);
              updateCounter(settingTarget.id, { target: n > 0 ? n : null });
              setSettingTarget(null);
            }}
          >
            <label className="field">
              <span className="field-label">Räkna till (lämna tomt för att ta bort målet)</span>
              <input
                className="input"
                autoFocus
                type="number"
                inputMode="numeric"
                min="1"
                max="99999"
                value={settingTarget.target}
                onChange={(e) => setSettingTarget({ ...settingTarget, target: e.target.value })}
                placeholder="T.ex. 120"
              />
            </label>
          </form>
        </Modal>
      )}

      {settingRepeat && (
        <Modal
          title="Upprepning"
          onClose={() => setSettingRepeat(null)}
          actions={
            <>
              <button className="btn" onClick={() => setSettingRepeat(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const n = parseInt(settingRepeat.repeatEvery, 10);
                  updateCounter(settingRepeat.id, { repeatEvery: n > 1 ? n : null });
                  setSettingRepeat(null);
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
              const n = parseInt(settingRepeat.repeatEvery, 10);
              updateCounter(settingRepeat.id, { repeatEvery: n > 1 ? n : null });
              setSettingRepeat(null);
            }}
          >
            <label className="field">
              <span className="field-label">
                Var N:e varv händer något? Räknaren visar var i repetitionen du är och lyser upp på
                åtgärdsvarvet. (Lämna tomt för att ta bort.)
              </span>
              <input
                className="input"
                autoFocus
                type="number"
                inputMode="numeric"
                min="2"
                max="999"
                value={settingRepeat.repeatEvery}
                onChange={(e) => setSettingRepeat({ ...settingRepeat, repeatEvery: e.target.value })}
                placeholder="T.ex. 6"
              />
            </label>
          </form>
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

/** Hänglåset: öppet när räknarna går att ändra, stängt i låst läge. */
function LockIcon({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      {open ? <path d="M8 11V7a4 4 0 0 1 7.6-1.7" /> : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
    </svg>
  );
}
