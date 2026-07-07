import { useEffect, useState } from 'react';
import { subscribeToUpdates, applyUpdate } from '../app/appUpdate.js';

/** Diskret banner som dyker upp när en ny version av appen ligger och väntar. */
export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => subscribeToUpdates(setAvailable), []);

  if (!available) return null;

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text">Det finns en ny version av Stickan.</span>
      <button
        className="btn btn-small btn-primary"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          applyUpdate();
        }}
      >
        {updating ? 'Uppdaterar …' : 'Uppdatera'}
      </button>
    </div>
  );
}
