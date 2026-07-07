import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { updateProject, deleteBlobHard } from '../storage/storage.js';
import {
  InfoFields,
  storePhotos,
  isoToDateInput,
  dateInputToIso,
} from './ProjectInfoFields.jsx';

/*
 * Projektinfo för pågående (och färdiga) projekt — UX-plan A1.
 * Ska kännas som att kladda i marginalen, inte som ett formulär:
 * anteckningarna först och allt sparas automatiskt medan man skriver.
 * Ingen spara-knapp — "Klart" stänger bara arket.
 */
export default function ProjectInfoSheet({ project, onClose }) {
  const [form, setForm] = useState({
    yarn: project.yarn || '',
    yarnAmount: project.yarnAmount || '',
    needleSize: project.needleSize || '',
    madeSize: project.madeSize || '',
    difficulty: project.difficulty ?? null,
    notes: project.notes || '',
  });
  const [startedDate, setStartedDate] = useState(isoToDateInput(project.startedAt));
  const [finishedDate, setFinishedDate] = useState(isoToDateInput(project.finishedAt));
  const [photoIds, setPhotoIds] = useState(project.photoBlobIds || []);
  const [removingPhoto, setRemovingPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | dirty | saved
  const [error, setError] = useState(null);

  const isFinished = project.status === 'färdigt';

  // Senast sparade versionen — lämnas tillbaka till föräldern vid stängning
  const latestRef = useRef(project);
  const pendingRef = useRef({});
  const timerRef = useRef(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0) return latestRef.current;
    pendingRef.current = {};
    try {
      latestRef.current = await updateProject(project.id, pending);
      setSaveState('saved');
    } catch (err) {
      console.error('Kunde inte spara projektinfon', err);
      setError('Kunde inte spara — kontrollera lagringsutrymmet.');
    }
    return latestRef.current;
  }, [project.id]);

  const saveDebounced = useCallback(
    (changes) => {
      pendingRef.current = { ...pendingRef.current, ...changes };
      setSaveState('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 500);
    },
    [flush]
  );

  // Spara direkt om appen göms/stängs — anteckningen får inte gå förlorad
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') flush();
    }
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    saveDebounced({ [key]: value });
  }

  function setStarted(value) {
    setStartedDate(value);
    saveDebounced({ startedAt: dateInputToIso(value) });
  }

  function setFinished(value) {
    setFinishedDate(value);
    // Manuellt satt datum är inte längre en gissning
    saveDebounced({ finishedAt: dateInputToIso(value), datesEstimated: false });
  }

  async function addPhotos(files) {
    setBusy(true);
    setError(null);
    try {
      const newIds = await storePhotos(files);
      const next = [...photoIds, ...newIds];
      setPhotoIds(next);
      saveDebounced({ photoBlobIds: next });
      await flush();
    } catch {
      setError('Kunde inte lägga till fotot. Prova en annan bild.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(id) {
    const next = photoIds.filter((x) => x !== id);
    setPhotoIds(next);
    setRemovingPhoto(null);
    saveDebounced({ photoBlobIds: next });
    // Blobben raderas först när projektet sparats utan referensen
    await flush();
    if (!(latestRef.current.photoBlobIds || []).includes(id)) await deleteBlobHard(id);
  }

  async function close() {
    onClose(await flush());
  }

  return (
    <Modal
      title="Projektinfo"
      onClose={close}
      actions={
        <button className="btn btn-primary" onClick={close}>
          Klart
        </button>
      }
    >
      <div className="form">
        <p className="autosave-hint" role="status">
          {saveState === 'saved' ? 'Sparat ✓' : 'Sparas automatiskt medan du skriver'}
        </p>

        <InfoFields
          form={form}
          onSet={set}
          photoIds={photoIds}
          onAddPhotos={addPhotos}
          onRemovePhoto={(id) => setRemovingPhoto(id)}
          busy={busy}
          notesFirst
        />

        <div className={isFinished ? 'field-row' : undefined}>
          <label className="field">
            <span className="field-label">Påbörjat den</span>
            <input className="input" type="date" value={startedDate} onChange={(e) => setStarted(e.target.value)} />
          </label>
          {isFinished && (
            <label className="field">
              <span className="field-label">Färdigt den</span>
              <input className="input" type="date" value={finishedDate} onChange={(e) => setFinished(e.target.value)} />
            </label>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>

      {removingPhoto && (
        <Modal
          title="Ta bort fotot?"
          onClose={() => setRemovingPhoto(null)}
          actions={
            <>
              <button className="btn" onClick={() => setRemovingPhoto(null)}>
                Avbryt
              </button>
              <button className="btn btn-danger" onClick={() => removePhoto(removingPhoto)}>
                Ta bort
              </button>
            </>
          }
        >
          <p>Fotot tas bort permanent — här sparas allt direkt.</p>
        </Modal>
      )}
    </Modal>
  );
}
