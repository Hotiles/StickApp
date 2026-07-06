import { useState } from 'react';
import { useLongPress } from '../ui/useLongPress.js';

/*
 * En räknare: stor tryckyta, tryck = +1 med haptik/visuell feedback,
 * långtryck öppnar meny. Siffran tickar vid varje tryck och firar
 * jämna tiotal (och uppnått mål) med en puls. Liten "−" i hörnet
 * backar ett varv — felräkning är vardag när man stickar.
 *
 * Med mål satt (counter.target) visas "47 /120" och en tunn
 * progresslinje längs kortets nederkant.
 */
export default function Counter({ counter, onIncrement, onDecrement, onOpenMenu }) {
  const [flash, setFlash] = useState(false);
  const [milestone, setMilestone] = useState(false);

  const target = counter.target || null;
  const fraction = target ? Math.min(1, counter.value / target) : 0;
  const done = target && counter.value >= target;

  const pressProps = useLongPress({
    onTap() {
      onIncrement();
      const next = counter.value + 1;
      const hitTarget = target && next === target;
      if (hitTarget || (next > 0 && next % 10 === 0)) {
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
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      onOpenMenu(el);
    },
  });

  return (
    <div
      className={`counter ${flash ? 'counter-flash' : ''} ${milestone ? 'counter-milestone' : ''} ${
        done ? 'counter-done' : ''
      }`}
    >
      <button
        className="counter-tap"
        {...pressProps}
        aria-label={`${counter.label}: ${counter.value}${target ? ` av ${target}` : ''}. Tryck för att öka, håll för meny.`}
      >
        <span className="counter-label">{counter.label}</span>
        <span className="counter-value" key={counter.value}>
          {counter.value}
          {target ? <span className="counter-of"> /{target}</span> : null}
        </span>
      </button>
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
