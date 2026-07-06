import { useState } from 'react';
import { useLongPress } from '../ui/useLongPress.js';

/*
 * En räknare: stor tryckyta, tryck = +1 med haptik/visuell feedback,
 * långtryck öppnar meny (Backa 1 / Nollställ / Byt namn …).
 */
export default function Counter({ counter, onIncrement, onOpenMenu }) {
  const [flash, setFlash] = useState(false);

  const pressProps = useLongPress({
    onTap() {
      onIncrement();
      if (navigator.vibrate) navigator.vibrate(15);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    },
    onLongPress(el) {
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      onOpenMenu(el);
    },
  });

  return (
    <button
      className={`counter ${flash ? 'counter-flash' : ''}`}
      {...pressProps}
      aria-label={`${counter.label}: ${counter.value}. Tryck för att öka, håll för meny.`}
    >
      <span className="counter-label">{counter.label}</span>
      <span className="counter-value">{counter.value}</span>
    </button>
  );
}
