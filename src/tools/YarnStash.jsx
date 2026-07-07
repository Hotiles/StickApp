import { useEffect, useRef, useState } from 'react';
import {
  listYarns,
  createYarn,
  updateYarn,
  deleteYarn,
  putBlob,
  deleteBlobHard,
} from '../storage/storage.js';
import { compressImage } from '../storage/images.js';
import TopBar from '../ui/TopBar.jsx';
import Modal from '../ui/Modal.jsx';
import YarnBall from '../ui/YarnBall.jsx';
import { SkeletonTiles } from '../ui/Skeleton.jsx';
import { PhotoThumb } from '../projects/FinishForm.jsx';

/*
 * Garnkorgen: garnet man har hemma — foto, kvalitet, färg, mängd och
 * en anteckning ("räcker till sockor"). Halva glädjen är att bläddra.
 */
export default function YarnStash() {
  const [yarns, setYarns] = useState(null);
  const [editing, setEditing] = useState(null); // { id|null, ...fält }
  const [confirmDelete, setConfirmDelete] = useState(null);

  const reload = () => listYarns().then(setYarns);
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="view">
      <TopBar
        title="Garnkorgen"
        backTo="/"
        right={
          <button className="btn btn-primary btn-small" onClick={() => setEditing(emptyYarn())}>
            + Garn
          </button>
        }
      />
      <main className="view-body">
        {yarns === null ? (
          <SkeletonTiles count={4} />
        ) : yarns.length === 0 ? (
          <div className="empty-state">
            <YarnBall />
            <p>Garnkorgen är tom.</p>
            <p className="empty-state-hint">
              Lägg in garnet du har hemma — med foto, mängd och färg — så vet du alltid vad nästa
              projekt kan bli.
            </p>
          </div>
        ) : (
          <ul className="gallery-grid">
            {yarns.map((yarn) => (
              <li key={yarn.id}>
                <button className="gallery-card" onClick={() => setEditing({ ...yarn })}>
                  <div className="gallery-photo">
                    {yarn.photoBlobId ? (
                      <PhotoThumb blobId={yarn.photoBlobId} />
                    ) : (
                      <div className="gallery-photo-empty" aria-hidden="true">
                        🧶
                      </div>
                    )}
                  </div>
                  <span className="gallery-name">{yarn.name || 'Namnlöst garn'}</span>
                  {(yarn.colorName || yarn.amount) && (
                    <span className="yarn-card-meta">
                      {[yarn.colorName, yarn.amount].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editing && (
        <YarnFormModal
          yarn={editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            setConfirmDelete(editing);
            setEditing(null);
          }}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Ta bort garnet?"
          onClose={() => setConfirmDelete(null)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await deleteYarn(confirmDelete.id);
                  setConfirmDelete(null);
                  reload();
                }}
              >
                Ta bort
              </button>
            </>
          }
        >
          <p>”{confirmDelete.name || 'Garnet'}” och dess foto tas bort.</p>
        </Modal>
      )}
    </div>
  );
}

function emptyYarn() {
  return { id: null, name: '', colorName: '', amount: '', note: '', photoBlobId: null };
}

function YarnFormModal({ yarn, onClose, onDelete, onSaved }) {
  const [form, setForm] = useState(yarn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const addedPhotoRef = useRef(null); // nytt foto som inte sparats än
  const fileRef = useRef(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const blobId = await putBlob(compressed);
      // Städa bort ett tidigare osparat foto
      if (addedPhotoRef.current) await deleteBlobHard(addedPhotoRef.current);
      addedPhotoRef.current = blobId;
      set('photoBlobId', blobId);
    } catch {
      setError('Kunde inte läsa fotot.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const fields = {
        name: form.name.trim(),
        colorName: form.colorName.trim(),
        amount: form.amount.trim(),
        note: form.note.trim(),
        photoBlobId: form.photoBlobId,
      };
      if (form.id) {
        // Ersattes fotot? Radera det gamla.
        if (yarn.photoBlobId && yarn.photoBlobId !== form.photoBlobId) {
          await deleteBlobHard(yarn.photoBlobId);
        }
        await updateYarn(form.id, fields);
      } else {
        await createYarn(fields);
      }
      addedPhotoRef.current = null;
      onSaved();
    } catch {
      setError('Kunde inte spara garnet.');
      setBusy(false);
    }
  }

  async function cancel() {
    if (addedPhotoRef.current) await deleteBlobHard(addedPhotoRef.current);
    onClose();
  }

  return (
    <Modal
      title={form.id ? 'Redigera garn' : 'Nytt garn'}
      onClose={cancel}
      actions={
        <>
          {form.id && (
            <button className="btn btn-danger" onClick={onDelete} disabled={busy}>
              Ta bort
            </button>
          )}
          <button className="btn" onClick={cancel} disabled={busy}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !form.name.trim()}>
            Spara
          </button>
        </>
      }
    >
      <div className="form">
        <div className="field">
          <span className="field-label">Foto</span>
          <div className="photo-row">
            {form.photoBlobId ? (
              <PhotoThumb
                key={form.photoBlobId}
                blobId={form.photoBlobId}
                onRemove={async () => {
                  const removed = form.photoBlobId;
                  set('photoBlobId', null);
                  // Ett nyss tillagt (osparat) foto kan hårdraderas direkt
                  if (removed === addedPhotoRef.current) {
                    addedPhotoRef.current = null;
                    await deleteBlobHard(removed);
                  }
                }}
              />
            ) : (
              <button
                className="photo-add"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label="Lägg till foto"
              >
                +
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        </div>

        <label className="field">
          <span className="field-label">Garn</span>
          <input
            className="input"
            autoFocus={!form.id}
            value={form.name}
            maxLength={60}
            placeholder="Märke och kvalitet, t.ex. Sandnes Tynn Merinoull"
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Färg</span>
            <input
              className="input"
              value={form.colorName}
              maxLength={40}
              placeholder="T.ex. Ljunglila 4632"
              onChange={(e) => set('colorName', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Mängd</span>
            <input
              className="input"
              value={form.amount}
              maxLength={30}
              placeholder="T.ex. 4 nystan / 200 g"
              onChange={(e) => set('amount', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Anteckning</span>
          <textarea
            className="input textarea"
            rows={2}
            value={form.note}
            maxLength={300}
            placeholder="T.ex. räcker till ett par sockor"
            onChange={(e) => set('note', e.target.value)}
          />
        </label>

        {error && <p className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}
