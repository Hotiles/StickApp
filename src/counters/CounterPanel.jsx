import { useState } from 'react';
import Counter from './Counter.jsx';
import Modal from '../ui/Modal.jsx';
import { uuid } from '../storage/storage.js';
import { tickCounter, followersOf, followCandidates, nextTickMilestone } from './tick.js';
import {
  counterSequence,
  sequenceStatus,
  isSimpleRhythm,
  describeSequence,
  sequenceEndRow,
} from './sequence.js';

/*
 * Räknarpanelen: dockad nertill, alltid synlig i mönsterläge.
 * Långtrycksmenyn: Backa 1 / Nollställ / Byt namn / Mål / Upprepning /
 * Följ räknare. Räknare kan läggas till och tas bort (minst 1 kvar).
 *
 * Hänglåset (B2) gör alla räknare skrivskyddade — mot ficktryck och
 * småbarnstummar, som markeringstejp fast digital. Låset ligger på
 * projektet och överlever att appen dödas.
 *
 * Läsremsan: chevronen under hänglåset fäller ihop panelen till en smal
 * remsa som fortfarande visar värdena — för stunderna man studerar
 * mönstret och vill ge det hela skärmen. Alltid manuell (aldrig
 * auto-göm), sparas per projekt som låset, och ett tryck var som helst
 * på remsan fäller ut panelen igen.
 *
 * Plus/minus går via tickCounter (tick.js) så att länkade räknare (B1)
 * tickar med och livstidsräkningen totalTicks (B3) hålls ärlig.
 */
const MAX_COUNTERS = 6;
const MAX_SEQUENCE_STEPS = 6;

/*
 * Upprepningsredigeraren (B4) jobbar med strängar tills man sparar.
 * Tomma/ogiltiga rader hoppas över, och ett steg utan antal betyder
 * "tills vidare" — stegen efter det kan aldrig nås och kapas därför.
 */
function parseSequenceSteps(rows) {
  const steps = [];
  for (const row of rows) {
    const every = parseInt(row.every, 10);
    if (!(every >= 1)) continue;
    const times = parseInt(row.times, 10);
    steps.push({ every, times: times >= 1 ? times : null });
    if (!(times >= 1)) break;
  }
  return steps;
}

export default function CounterPanel({
  counters,
  locked,
  collapsed,
  onChange,
  onToggleLock,
  onToggleCollapsed,
}) {
  const [menuFor, setMenuFor] = useState(null); // counter-id
  const [renaming, setRenaming] = useState(null); // { id, label }
  const [settingTarget, setSettingTarget] = useState(null); // { id, target }
  const [settingRepeat, setSettingRepeat] = useState(null); // { id, steps: [{every, times}], advanced }
  const [pickingFollow, setPickingFollow] = useState(null); // counter-id
  const [lockNudge, setLockNudge] = useState(false);
  const [stripShake, setStripShake] = useState(null); // counter-id: tryck i låst remsa

  const menuCounter = counters.find((c) => c.id === menuFor);

  function updateCounter(id, changes) {
    onChange(counters.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  function tick(id, delta) {
    onChange(tickCounter(counters, id, delta));
  }

  // Tryck på ett värde i remsan: +1 med samma haptik som korten.
  // Går via tick()/tickCounter så följare (B1) och totalTicks (B3)
  // hålls ärliga även från kompaktläget.
  function stripTick(id) {
    if (locked) {
      // Ingen vibration — ett ficktryck ska inte kännas som ett varv
      setStripShake(id);
      setTimeout(() => setStripShake(null), 350);
      return;
    }
    const counter = counters.find((c) => c.id === id);
    if (!counter) return;
    const milestone = nextTickMilestone(counters, id);
    const next = counter.value + 1;
    if (navigator.vibrate) {
      if (milestone.hitTarget) navigator.vibrate([20, 40, 20, 40, 40]);
      else if (milestone.hitRepeat || (next > 0 && next % 10 === 0)) navigator.vibrate([15, 40, 25]);
      else navigator.vibrate(15);
    }
    tick(id, 1);
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

  if (collapsed) {
    // Kompaktläget: remsan är en miniatyrpanel, inte bara en läsvy —
    // tryck på ett värde tickar +1 så att "ett tryck = ett varv" gäller
    // även hopfälld. Varje värde är en synlig pill (tryckytan ska se
    // tryckbar ut), åtgärdsvarv lyser, och samma primärsiffra som kortet
    // visas (rytmräknare utan mål: positionen i repetitionen). Backa och
    // menyer kräver utfälld panel — rättningar är sällsynta, varv inte.
    return (
      <div className="counter-strip" role="group" aria-label="Räknare, kompaktläge">
        {locked && (
          <span className="counter-strip-lock" aria-hidden="true">
            <LockIcon open={false} />
          </span>
        )}
        {counters.map((counter) => {
          const steps = counterSequence(counter);
          const seq = steps ? sequenceStatus(steps, counter.value) : null;
          const showPos = seq && isSimpleRhythm(steps) && !counter.target;
          const shown = showPos ? seq.pos : counter.value;
          return (
            <button
              key={counter.id}
              className={`counter-strip-btn ${seq?.due ? 'counter-strip-due' : ''} ${
                stripShake === counter.id ? 'counter-locked-shake' : ''
              }`}
              onClick={() => stripTick(counter.id)}
              aria-label={`${counter.label}: ${counter.value}${
                locked ? '. Låst — fäll ut panelen och lås upp för att ändra.' : '. Tryck för att öka.'
              }`}
            >
              <span className="counter-strip-label">{counter.label}</span>
              <span className="counter-strip-value" key={shown}>
                {shown}
              </span>
            </button>
          );
        })}
        <button
          className="counter-strip-expand"
          onClick={onToggleCollapsed}
          aria-label="Fäll ut räknarpanelen"
        >
          <ChevronIcon />
        </button>
      </div>
    );
  }

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

      <div className="counter-rail">
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
        <button
          className="counter-collapsebtn"
          onClick={onToggleCollapsed}
          aria-label="Fäll ihop räknarna till en remsa"
        >
          <ChevronIcon />
        </button>
      </div>

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
                const steps = counterSequence(menuCounter);
                setSettingRepeat({
                  id: menuCounter.id,
                  steps: steps
                    ? steps.map((s) => ({
                        every: String(s.every),
                        times: s.times == null ? '' : String(s.times),
                      }))
                    : [{ every: '', times: '' }],
                  advanced: steps ? !isSimpleRhythm(steps) : false,
                });
                setMenuFor(null);
              }}
            >
              {(() => {
                const steps = counterSequence(menuCounter);
                if (!steps) return 'Upprepning …';
                return steps.length === 1
                  ? `Ändra upprepning (var ${steps[0].every}:e)`
                  : `Ändra upprepning (${steps.length} steg)`;
              })()}
              <span className="menu-item-meta">T.ex. ”ökning var 6:e varv” — eller en hel sekvens</span>
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
        <RepeatEditor
          state={settingRepeat}
          onChange={setSettingRepeat}
          onSave={() => {
            const steps = parseSequenceSteps(settingRepeat.steps);
            // repeatEvery nollas så att en kvarliggande gammal rytm aldrig
            // kan återuppstå bredvid den nya sekvensen
            updateCounter(settingRepeat.id, {
              sequence: steps.length ? steps : null,
              repeatEvery: null,
            });
            setSettingRepeat(null);
          }}
          onClose={() => setSettingRepeat(null)}
        />
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

/*
 * Upprepningsdialogen (B4). Enkel rytm ("var 6:e varv") är standardvyn —
 * garnhalsduksstickaren ska aldrig se raglanmaskineriet. "Lägg till steg"
 * fäller ut sekvensredigeraren: ordnade steg "var N:e varv, M ggr" där
 * sista stegets antal kan lämnas tomt (= tills vidare). Förhandsraden
 * läser tillbaka sekvensen som mönstret säger den, med sista åtgärdsvarvet
 * utskrivet — det är kvittot på att man matat in rätt.
 */
function RepeatEditor({ state, onChange, onSave, onClose }) {
  const parsed = parseSequenceSteps(state.steps);
  const endRow = parsed.length ? sequenceEndRow(parsed) : null;

  function setStep(index, field, value) {
    const steps = state.steps.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    onChange({ ...state, steps });
  }

  function submit(e) {
    e.preventDefault();
    onSave();
  }

  return (
    <Modal
      title="Upprepning"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={onSave}>
            Spara
          </button>
        </>
      }
    >
      {!state.advanced ? (
        <form onSubmit={submit}>
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
              value={state.steps[0].every}
              onChange={(e) => setStep(0, 'every', e.target.value)}
              placeholder="T.ex. 6"
            />
          </label>
          <button
            type="button"
            className="btn seq-add-step"
            onClick={() =>
              onChange({
                ...state,
                advanced: true,
                steps: [...state.steps, { every: '', times: '' }],
              })
            }
          >
            Lägg till steg …
          </button>
          <p className="seq-hint">
            För mönster som byter rytm: ”öka vart 4:e varv 3 ggr, sedan vart 6:e varv 4 ggr”.
          </p>
        </form>
      ) : (
        <form onSubmit={submit}>
          <div className="seq-steps">
            {state.steps.map((row, i) => (
              <div className="seq-step" key={i}>
                <span className="seq-step-word">var</span>
                <input
                  className="input seq-step-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="999"
                  value={row.every}
                  onChange={(e) => setStep(i, 'every', e.target.value)}
                  placeholder="6"
                  aria-label={`Steg ${i + 1}: var N:e varv`}
                />
                <span className="seq-step-word">:e varv,</span>
                <input
                  className="input seq-step-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="999"
                  value={row.times}
                  onChange={(e) => setStep(i, 'times', e.target.value)}
                  placeholder={i === state.steps.length - 1 ? '∞' : '3'}
                  aria-label={`Steg ${i + 1}: antal gånger`}
                />
                <span className="seq-step-word">ggr</span>
                {state.steps.length > 1 && (
                  <button
                    type="button"
                    className="seq-step-remove"
                    aria-label={`Ta bort steg ${i + 1}`}
                    onClick={() =>
                      onChange({ ...state, steps: state.steps.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {state.steps.length < MAX_SEQUENCE_STEPS && (
            <button
              type="button"
              className="btn seq-add-step"
              onClick={() =>
                onChange({ ...state, steps: [...state.steps, { every: '', times: '' }] })
              }
            >
              Lägg till steg
            </button>
          )}
          {parsed.length > 0 ? (
            <p className="seq-preview">
              {describeSequence(parsed)}
              {endRow ? ` — sista åtgärden på varv ${endRow}.` : null}
            </p>
          ) : (
            <p className="seq-hint">
              Lämna sista stegets antal tomt så fortsätter rytmen tills vidare. Töm allt för att ta
              bort upprepningen.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

/** Chevron: pekar mot kanten panelen fäller ihop sig mot (roteras i CSS). */
function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
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
