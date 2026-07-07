import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { updateProject, putBlob, getBlob, deleteBlobHard } from '../storage/storage.js';
import { compressImage } from '../storage/images.js';

/*
 * Formulär för projektinfo — används både vid "Markera som färdigt" och för
 * att redigera detaljer på ett redan färdigt projekt.
 */
export default function FinishForm({ project, onClose, onSaved, editOnly = false }) {
  const [form, setForm] = useState({
    yarn: project.yarn || '',
    yarnAmount: project.yarnAmount || '',
    needleSize: project.needleSize || '',
    madeSize: project.madeSize || '',
    difficulty: project.difficulty ?? null,
    notes: project.notes || '',
  });
  const [photoIds, setPhotoIds] = useState(project.photoBlobIds || []);
  const [addedPhotoIds, setAddedPhotoIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function addPhotos(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const newIds = [];
      for (const file of files) {
        const compressed = await compressImage(file);
        newIds.push(await putBlob(compressed));
      }
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
        ...(editOnly ? {} : { status: 'färdigt' }),
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
      title={editOnly ? 'Redigera projektinfo' : 'Markera som färdigt'}
      onClose={cancel}
      actions={
        <>
          <button className="btn" onClick={cancel} disabled={busy}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {editOnly ? 'Spara' : 'Klart!'}
          </button>
        </>
      }
    >
      <div className="form">
        {!editOnly && <p className="form-intro">Grattis! Fyll i det du vill minnas om ”{project.name}”.</p>}

        <div className="field">
          <span className="field-label">Foton</span>
          <div className="photo-row">
            {photoIds.map((id) => (
              <PhotoThumb key={id} blobId={id} onRemove={() => removePhoto(id)} />
            ))}
            <button className="photo-add" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Lägg till foto">
              +
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
        </div>

        <label className="field">
          <span className="field-label">Garn</span>
          <input
            className="input"
            value={form.yarn}
            onChange={(e) => set('yarn', e.target.value)}
            placeholder="Märke, kvalitet, färg …"
          />
        </label>

        <label className="field">
          <span className="field-label">Garnåtgång</span>
          <input
            className="input"
            value={form.yarnAmount}
            onChange={(e) => set('yarnAmount', e.target.value)}
            placeholder="T.ex. 3 nystan / 150 g"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Stickor</span>
            <input
              className="input"
              value={form.needleSize}
              onChange={(e) => set('needleSize', e.target.value)}
              placeholder="T.ex. 3,5 mm"
            />
          </label>
          <label className="field">
            <span className="field-label">Storlek</span>
            <input
              className="input"
              value={form.madeSize}
              onChange={(e) => set('madeSize', e.target.value)}
              placeholder="T.ex. 38–40"
            />
          </label>
        </div>

        <div className="field">
          <span className="field-label">Svårighetsgrad</span>
          <div className="difficulty-row" role="radiogroup" aria-label="Svårighetsgrad 1 till 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`difficulty-dot ${form.difficulty >= n ? 'difficulty-dot-on' : ''}`}
                role="radio"
                aria-checked={form.difficulty === n}
                aria-label={`${n} av 5`}
                onClick={() => set('difficulty', form.difficulty === n ? null : n)}
              >
                ●
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field-label">Anteckningar</span>
          <textarea
            className="input textarea"
            rows={4}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Ändringar du gjorde, tips till dig själv …"
          />
        </label>

        {error && <p className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}

export function PhotoThumb({ blobId, onRemove, onClick, large = false }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    getBlob(blobId).then((blob) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blobId]);

  return (
    <div className={large ? 'photo-large' : 'photo-thumb'}>
      {url ? (
        <img src={url} alt="Projektfoto" onClick={onClick} loading="lazy" />
      ) : (
        <div className="photo-placeholder" />
      )}
      {onRemove && (
        <button className="photo-remove" onClick={onRemove} aria-label="Ta bort foto">
          ×
        </button>
      )}
    </div>
  );
}
