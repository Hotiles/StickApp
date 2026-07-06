import { useState } from 'react';
import { useLongPress } from '../ui/useLongPress.js';

/*
 * En räknare: stor tryckyta, tryck = +1 med haptik/visuell feedback,
 * långtryck öppnar meny. Siffran tickar vid varje tryck och firar
 * jämna tiotal med en puls. Liten "−" i hörnet backar ett varv —
 * felräkning är vardag när man stickar.
 */
export default function Counter({ counter, onIncrement, onDecrement, onOpenMenu }) {
  const [flash, setFlash] = useState(false);
  const [milestone, setMilestone] = useState(false);

  const pressProps = useLongPress({
    onTap() {
      onIncrement();
      const next = counter.value + 1;
      if (next > 0 && next % 10 === 0) {
        if (navigator.vibrate) navigator.vibrate([15, 40, 25]);
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
    <div className={`counter ${flash ? 'counter-flash' : ''} ${milestone ? 'counter-milestone' : ''}`}>
      <button
        className="counter-tap"
        {...pressProps}
        aria-label={`${counter.label}: ${counter.value}. Tryck för att öka, håll för meny.`}
      >
        <span className="counter-label">{counter.label}</span>
        <span className="counter-value" key={counter.value}>
          {counter.value}
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
    </div>
  );
}
