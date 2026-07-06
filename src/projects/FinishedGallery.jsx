import { useEffect, useState } from 'react';
import { navigate } from '../app/router.jsx';
import { listProjects } from '../storage/storage.js';
import TopBar from '../ui/TopBar.jsx';
import { PhotoThumb } from './FinishForm.jsx';

export default function FinishedGallery() {
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    listProjects('färdigt').then(setProjects);
  }, []);

  return (
    <div className="view">
      <TopBar title="Färdiga projekt" backTo="/" />
      <main className="view-body">
        {projects === null ? null : projects.length === 0 ? (
          <div className="empty-state">
            <p>Inga färdiga projekt än.</p>
            <p className="empty-state-hint">
              När du stickat klart: öppna projektet och välj ”Markera som färdigt”.
            </p>
          </div>
        ) : (
          <ul className="gallery-grid">
            {projects.map((p) => (
              <li key={p.id}>
                <button className="gallery-card" onClick={() => navigate(`/fardiga/${p.id}`)}>
                  <div className="gallery-photo">
                    {p.photoBlobIds?.[0] ? (
                      <PhotoThumb blobId={p.photoBlobIds[0]} />
                    ) : (
                      <div className="gallery-photo-empty" aria-hidden="true">
                        🧶
                      </div>
                    )}
                  </div>
                  <span className="gallery-name">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
