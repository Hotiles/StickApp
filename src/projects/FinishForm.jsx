import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { updateProject, deleteBlobHard, now } from '../storage/storage.js';
import { InfoFields, storePhotos, isoToDateInput, dateInputToIso } from './ProjectInfoFields.jsx';

/*
 * "Markera som färdigt" — samlar projektinfo-fälten (delade med
 * ProjectInfoSheet) och lägger till det färdigt-specifika: datum och
 * statusbytet. Sparas först när man trycker "Klart!".
 */
export default function FinishForm({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    yarn: project.yarn || '',
    yarnAmount: project.yarnAmount || '',
    needleSize: project.needleSize || '',
    madeSize: project.madeSize || '',
    difficulty: project.difficulty ?? null,
    notes: project.notes || '',
  });
  const [finishedDate, setFinishedDate] = useState(isoToDateInput(project.finishedAt || now()));
  const [photoIds, setPhotoIds] = useState(project.photoBlobIds || []);
  const [addedPhotoIds, setAddedPhotoIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function addPhotos(files) {
    setBusy(true);
    setError(null);
    try {
      const newIds = await storePhotos(files);
      setPhotoIds((ids) => [...ids, ...newIds]);
      setAddedPhotoIds((ids) => [...ids, ...newIds]);
    } catch {
      setError('Kunde inte lägga till fotot. Prova en annan bild.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(id) {
    setPhotoIds((ids) => ids.filter((x) => x !== id));
    // Nya foton (inte sparade än) kan hårdraderas direkt
    if (addedPhotoIds.includes(id)) {
      await deleteBlobHard(id);
      setAddedPhotoIds((ids) => ids.filter((x) => x !== id));
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updateProject(project.id, {
        ...form,
        photoBlobIds: photoIds,
        status: 'färdigt',
        finishedAt: dateInputToIso(finishedDate) ?? now(),
        datesEstimated: false,
      });
      // Foton som togs bort i formuläret raderas först när uppdateringen är
      // sparad — misslyckas den ska projektet inte peka på raderade blobbar.
      for (const oldId of project.photoBlobIds || []) {
        if (!photoIds.includes(oldId)) await deleteBlobHard(oldId);
      }
      onSaved(updated);
    } catch {
      setError('Något gick fel när projektet skulle sparas.');
      setBusy(false);
    }
  }

  async function cancel() {
    // Städa bort foton som lades till men aldrig sparades
    for (const id of addedPhotoIds) await deleteBlobHard(id);
    onClose();
  }

  return (
    <Modal
      title="Markera som färdigt"
      onClose={cancel}
      actions={
        <>
          <button className="btn" onClick={cancel} disabled={busy}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Klart!
          </button>
        </>
      }
    >
      <div className="form">
        <p className="form-intro">Grattis! Fyll i det du vill minnas om ”{project.name}”.</p>

        <label className="field">
          <span className="field-label">Färdigt den</span>
          <input
            className="input"
            type="date"
            value={finishedDate}
            max={isoToDateInput(now())}
            onChange={(e) => setFinishedDate(e.target.value)}
          />
        </label>

        <InfoFields
          form={form}
          onSet={set}
          photoIds={photoIds}
          onAddPhotos={addPhotos}
          onRemovePhoto={removePhoto}
          busy={busy}
        />

        {error && <p className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}
