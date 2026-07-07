import { useEffect, useState } from 'react';
import { navigate } from '../app/router.jsx';
import { getProject, updateProject, deleteProject, getBlob } from '../storage/storage.js';
import TopBar from '../ui/TopBar.jsx';
import Modal from '../ui/Modal.jsx';
import FinishForm, { PhotoThumb } from './FinishForm.jsx';
import { generateShareCard, shareOrDownload } from './shareCard.js';
import { yarnColorValue } from '../ui/yarnColors.jsx';

export default function ProjectDetails({ projectId }) {
  const [project, setProject] = useState(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);

  async function handleShareCard() {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const photoBlob = project.photoBlobIds?.[0] ? await getBlob(project.photoBlobIds[0]) : null;
      const card = await generateShareCard(project, photoBlob, yarnColorValue(project.color));
      const safeName = project.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'projekt';
      await shareOrDownload(card, `${safeName}.jpg`);
      setMenuOpen(false);
    } catch {
      setShareError('Kunde inte skapa delningskortet.');
    } finally {
      setSharing(false);
    }
  }

  useEffect(() => {
    getProject(projectId).then((p) => (p ? setProject(p) : setMissing(true)));
  }, [projectId]);

  if (missing) {
    return (
      <div className="view">
        <TopBar title="Färdigt projekt" backTo="/fardiga" />
        <div className="empty-state">
          <p>Projektet hittades inte.</p>
        </div>
      </div>
    );
  }

  if (!project) return <div className="view loading-view">Laddar …</div>;

  const rows = [
    ['Garn', project.yarn],
    ['Garnåtgång', project.yarnAmount],
    ['Stickor', project.needleSize],
    ['Storlek', project.madeSize],
  ].filter(([, v]) => v);

  return (
    <div className="view">
      <TopBar
        title={project.name}
        backTo="/fardiga"
        right={
          <button className="btn-icon" onClick={() => setMenuOpen(true)} aria-label="Meny">
            ⋯
          </button>
        }
      />
      <main className="view-body">
        {project.photoBlobIds?.length > 0 && (
          <div className="photo-row photo-row-details">
            {project.photoBlobIds.map((id) => (
              <PhotoThumb key={id} blobId={id} onClick={() => setViewPhoto(id)} />
            ))}
          </div>
        )}

        {project.difficulty && (
          <p className="details-difficulty" aria-label={`Svårighetsgrad ${project.difficulty} av 5`}>
            {'●'.repeat(project.difficulty)}
            <span className="details-difficulty-off">{'●'.repeat(5 - project.difficulty)}</span>
          </p>
        )}

        {rows.length > 0 && (
          <dl className="details-list">
            {rows.map(([label, value]) => (
              <div key={label} className="details-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {project.notes && (
          <section>
            <h2 className="section-title">Anteckningar</h2>
            <p className="details-notes">{project.notes}</p>
          </section>
        )}

        {rows.length === 0 && !project.notes && !project.photoBlobIds?.length && (
          <div className="empty-state">
            <p>Ingen projektinfo ifylld än.</p>
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              Fyll i detaljer
            </button>
          </div>
        )}
      </main>

      {menuOpen && (
        <Modal title={project.name} onClose={() => setMenuOpen(false)}>
          <div className="menu-list">
            <button className="menu-item menu-item-primary" onClick={handleShareCard} disabled={sharing}>
              {sharing ? 'Skapar kortet …' : 'Dela projektkort ✨'}
              <span className="menu-item-meta">Bild med foto, garn och stickor</span>
            </button>
            {shareError && <p className="form-error">{shareError}</p>}
            <button
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
            >
              Redigera info
            </button>
            <button
              className="menu-item"
              onClick={async () => {
                await updateProject(projectId, { status: 'pågående' });
                navigate(`/projekt/${projectId}`);
              }}
            >
              Återuppta projektet
            </button>
            <button
              className="menu-item menu-item-danger"
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
            >
              Ta bort projektet
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Ta bort projektet?"
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Avbryt
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await deleteProject(projectId);
                  navigate('/fardiga');
                }}
              >
                Ta bort
              </button>
            </>
          }
        >
          <p>”{project.name}” och dess foton tas bort permanent.</p>
        </Modal>
      )}

      {editing && (
        <FinishForm
          project={project}
          editOnly
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setProject(updated);
            setEditing(false);
          }}
        />
      )}

      {viewPhoto && (
        <Modal onClose={() => setViewPhoto(null)}>
          <PhotoThumb blobId={viewPhoto} large />
        </Modal>
      )}
    </div>
  );
}
