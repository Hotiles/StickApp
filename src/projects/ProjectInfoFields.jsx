import { useEffect, useRef, useState } from 'react';
import { putBlob, getBlob, now } from '../storage/storage.js';
import { compressImage } from '../storage/images.js';

/*
 * Projektinfo-fälten (garn, stickor, storlek, svårighet, anteckningar, foton)
 * delas mellan FinishForm ("Markera som färdigt", spara-knapp) och
 * ProjectInfoSheet (redigering med autospar). Fälten är rena kontrollerade
 * komponenter — all persistens sköts av föräldern.
 */
export function InfoFields({ form, onSet, photoIds, onAddPhotos, onRemovePhoto, busy, notesFirst = false }) {
  const fileRef = useRef(null);

  async function pickFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length > 0) onAddPhotos(files);
  }

  const notesField = (
    <label className="field">
      <span className="field-label">Anteckningar</span>
      <textarea
        className="input textarea"
        rows={notesFirst ? 5 : 4}
        value={form.notes}
        onChange={(e) => onSet('notes', e.target.value)}
        placeholder={
          notesFirst
            ? 'T.ex. ”vänster ärm: minskade på varv 38 — gör likadant på högra!”'
            : 'Ändringar du gjorde, tips till dig själv …'
        }
      />
    </label>
  );

  return (
    <>
      {notesFirst && notesField}

      <div className="field">
        <span className="field-label">Foton</span>
        <div className="photo-row">
          {photoIds.map((id) => (
            <PhotoThumb key={id} blobId={id} onRemove={() => onRemovePhoto(id)} />
          ))}
          <button className="photo-add" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Lägg till foto">
            +
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
      </div>

      <label className="field">
        <span className="field-label">Garn</span>
        <input
          className="input"
          value={form.yarn}
          onChange={(e) => onSet('yarn', e.target.value)}
          placeholder="Märke, kvalitet, färg …"
        />
      </label>

      <label className="field">
        <span className="field-label">Garnåtgång</span>
        <input
          className="input"
          value={form.yarnAmount}
          onChange={(e) => onSet('yarnAmount', e.target.value)}
          placeholder="T.ex. 3 nystan / 150 g"
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Stickor</span>
          <input
            className="input"
            value={form.needleSize}
            onChange={(e) => onSet('needleSize', e.target.value)}
            placeholder="T.ex. 3,5 mm"
          />
        </label>
        <label className="field">
          <span className="field-label">Storlek</span>
          <input
            className="input"
            value={form.madeSize}
            onChange={(e) => onSet('madeSize', e.target.value)}
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
              onClick={() => onSet('difficulty', form.difficulty === n ? null : n)}
            >
              ●
            </button>
          ))}
        </div>
      </div>

      {!notesFirst && notesField}
    </>
  );
}

/** Komprimerar och lagrar valda bilder; returnerar nya blob-id:n. */
export async function storePhotos(files) {
  const ids = [];
  for (const file of files) {
    const compressed = await compressImage(file);
    ids.push(await putBlob(compressed));
  }
  return ids;
}

// ---------- Datumhjälpare (A2) ----------

/** ISO-tidsstämpel → värde för <input type="date">. */
export function isoToDateInput(iso) {
  return iso ? iso.slice(0, 10) : '';
}

/**
 * <input type="date"> → ISO-tidsstämpel. Dagens datum får aktuell tid så att
 * "nyast vinner"-ordningen blir rätt; andra datum läggs mitt på dagen (UTC)
 * så att årsstatistiken inte tippar över årsskiften av tidszonsskäl.
 */
export function dateInputToIso(value) {
  if (!value) return null;
  if (value === now().slice(0, 10)) return now();
  return `${value}T12:00:00.000Z`;
}

/** "3 juli 2026" — för detaljvyer. */
export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "juli 2026" — för galleriets kortmeta. */
export function formatMonthYear(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
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
