import { useState } from 'react';
import { useLongPress } from '../ui/useLongPress.js';
import { counterSequence, sequenceStatus, isSimpleRhythm, isActionRow } from './sequence.js';

/*
 * En räknare: stor tryckyta, tryck = +1 med haptik/visuell feedback,
 * långtryck öppnar meny. Siffran tickar vid varje tryck och firar
 * jämna tiotal (och uppnått mål) med en puls. Liten "−" i hörnet
 * backar ett varv — felräkning är vardag när man stickar.
 *
 * Med mål satt (counter.target) visas "47 /120" och en tunn
 * progresslinje längs kortets nederkant. Har räknaren både mål och
 * upprepning är totalen den stora siffran — det är den man jämför
 * mot mönstret — och repetitionsläget underraden (B5).
 *
 * Följer räknaren en huvudräknare (counter.followsId) markeras det med
 * en liten kedja vid namnet (B1); nextMilestone kommer från panelen och
 * väger in följarna, så "Dags!" känns i tummen även när repetitionen
 * sitter på ett annat kort än det man trycker på.
 *
 * Låst läge (B2): tryck och minus är döda — kortet skakar till och
 * panelens hänglås pulserar i stället för att räkna.
 */
export default function Counter({
  counter,
  locked,
  followsLabel,
  nextMilestone,
  onIncrement,
  onDecrement,
  onLockedTap,
  onOpenMenu,
}) {
  const [flash, setFlash] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const [lockedShake, setLockedShake] = useState(false);

  const target = counter.target || null;
  const fraction = target ? Math.min(1, counter.value / target) : 0;
  const done = target && counter.value >= target;

  // Upprepning (B4): en enkel rytm visas som förr ("Varv 5 av 6"), en
  // formningssekvens visar nästa åtgärd i absoluta varv och hur många
  // åtgärder som är gjorda — de tal man jämför mot mönstertexten.
  const steps = counterSequence(counter);
  const seq = steps ? sequenceStatus(steps, counter.value) : null;
  const simpleRhythm = steps ? isSimpleRhythm(steps) : false;
  const repeatDue = seq ? seq.due : false;

  let seqSub = null;
  if (seq && simpleRhythm) {
    seqSub = repeatDue
      ? 'Dags! ✨'
      : target
        ? `Varv ${seq.pos} av ${seq.every}${seq.actionsDone ? ` · ${seq.actionsDone} rep` : ''}`
        : `Totalt ${counter.value}${seq.actionsDone ? ` · ${seq.actionsDone} rep` : ''}`;
  } else if (seq) {
    seqSub = repeatDue
      ? `Dags! ✨${seq.totalActions ? ` · steg ${seq.actionsDone} av ${seq.totalActions}` : ''}`
      : seq.finished
        ? `Formningen klar · ${seq.totalActions} av ${seq.totalActions}`
        : `Nästa på varv ${seq.nextActionRow}${
            seq.totalActions ? ` · steg ${seq.actionsDone + 1} av ${seq.totalActions}` : ''
          }`;
  }

  const pressProps = useLongPress({
    onTap() {
      if (locked) {
        // Ingen vibration — en ficktryckning ska inte kännas som ett varv
        onLockedTap?.();
        setLockedShake(true);
        setTimeout(() => setLockedShake(false), 350);
        return;
      }
      onIncrement();
      const next = counter.value + 1;
      const hitTarget = nextMilestone?.hitTarget || (target && next === target);
      const hitRepeat = nextMilestone?.hitRepeat || (steps && isActionRow(steps, next));
      if (hitTarget || hitRepeat || (next > 0 && next % 10 === 0)) {
        if (navigator.vibrate) navigator.vibrate(hitTarget ? [20, 40, 20, 40, 40] : [15, 40, 25]);
        setMilestone(true);
        setTimeout(() => setMilestone(false), 700);
      } else if (navigator.vibrate) {
        navigator.vibrate(15);
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    },
    onLongPress(el) {
      if (locked) return; // hänglåset är enda vägen ut ur låst läge
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      onOpenMenu(el);
    },
  });

  return (
    <div
      className={`counter ${flash ? 'counter-flash' : ''} ${milestone ? 'counter-milestone' : ''} ${
        done ? 'counter-done' : ''
      } ${repeatDue ? 'counter-repeat-due' : ''} ${locked ? 'counter-locked' : ''} ${
        lockedShake ? 'counter-locked-shake' : ''
      }`}
    >
      <button
        className="counter-tap"
        {...pressProps}
        aria-label={`${counter.label}: ${counter.value}${target ? ` av ${target}` : ''}${
          seq
            ? simpleRhythm
              ? `, varv ${seq.pos} av ${seq.every} i repetitionen`
              : seq.finished
                ? ', formningen klar'
                : `, nästa åtgärd på varv ${seq.nextActionRow}`
            : ''
        }${followsLabel ? `. Följer ${followsLabel}` : ''}${
          locked ? '. Låst — lås upp med hänglåset.' : '. Tryck för att öka, håll för meny.'
        }`}
      >
        <span className="counter-label">
          {counter.followsId ? <ChainIcon /> : null}
          {counter.label}
        </span>
        <span className="counter-value" key={counter.value}>
          {simpleRhythm && !target ? seq.pos : counter.value}
          {simpleRhythm && !target ? (
            <span className="counter-of"> /{seq.every}</span>
          ) : target ? (
            <span className="counter-of"> /{target}</span>
          ) : null}
        </span>
        {seqSub ? <span className="counter-sub">{seqSub}</span> : null}
      </button>
      {!locked && (
        <button
          className="counter-minus"
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(10);
            onDecrement();
          }}
          aria-label={`Backa ${counter.label} ett steg`}
        >
          −
        </button>
      )}
      {target ? (
        <span
          className="counter-progress"
          style={{ transform: `scaleX(${fraction})` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

/** Liten kedja vid namnet: den här räknaren följer huvudräknaren. */
function ChainIcon() {
  return (
    <svg
      className="counter-follows-icon"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10.5 13.5a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1.6 1.6" />
      <path d="M13.5 10.5a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1.6-1.6" />
    </svg>
  );
}
