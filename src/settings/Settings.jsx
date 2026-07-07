import { useEffect, useState } from 'react';
import {
  getSettings,
  updateSettings,
  storageEstimate,
  requestPersistence,
} from '../storage/storage.js';
import { exportBackup, readBackupZip, restoreReplace, restoreMerge } from '../storage/backup.js';
import { checkForUpdate } from '../app/appUpdate.js';
import TopBar from '../ui/TopBar.jsx';
import Modal from '../ui/Modal.jsx';
import { formatSize } from '../ui/format.js';
import { BAND_COLOR } from '../pdf/BandOverlay.jsx';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null); // { data, blobRecords, summary }
  const [error, setError] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null); // 'checking' | 'found' | 'none' | 'error'

  useEffect(() => {
    getSettings().then(setSettings);
    storageEstimate().then(setEstimate);
    requestPersistence().then(setPersisted);
  }, []);

  async function set(changes) {
    setSettings(await updateSettings(changes));
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { done } = await exportBackup();
      if (done) {
        setMessage('Säkerhetskopian är skapad.');
        setSettings(await getSettings());
      }
    } catch {
      setError('Kunde inte skapa säkerhetskopian.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setRestorePreview(await readBackupZip(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyRestore(mode) {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'replace') await restoreReplace(restorePreview);
      else await restoreMerge(restorePreview);
      setRestorePreview(null);
      setMessage(mode === 'replace' ? 'Allt är återställt från backupen.' : 'Backupen är ihopslagen med din data.');
      setSettings(await getSettings());
      setEstimate(await storageEstimate());
    } catch {
      setError('Återställningen misslyckades.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckUpdate() {
    setUpdateStatus('checking');
    try {
      setUpdateStatus((await checkForUpdate()) ? 'found' : 'none');
    } catch {
      setUpdateStatus('error');
    }
  }

  if (!settings) return <div className="view loading-view">Laddar …</div>;

  return (
    <div className="view">
      <TopBar title="Inställningar" backTo="/" />
      <main className="view-body settings-body">
        <section>
          <h2 className="section-title">Säkerhetskopiering</h2>
          <p className="settings-hint">
            {settings.lastBackupAt
              ? `Senaste säkerhetskopia: ${formatDate(settings.lastBackupAt)}`
              : 'Ingen säkerhetskopia gjord än.'}
          </p>
          <div className="settings-actions">
            <button className="btn btn-primary" onClick={handleExport} disabled={busy}>
              {busy ? 'Arbetar …' : 'Säkerhetskopiera nu'}
            </button>
            <label className={`btn ${busy ? 'btn-disabled' : ''}`}>
              Återställ från backup
              <input type="file" accept=".zip,application/zip" hidden onChange={handleRestoreFile} disabled={busy} />
            </label>
          </div>
          <p className="settings-hint">
            Backupen blir en zip-fil med alla mönster, projekt och foton. Spara den i iCloud, Google
            Drive eller Filer.
          </p>
          {message && <p className="settings-message">{message}</p>}
          {error && <p className="form-error">{error}</p>}
        </section>

        <section>
          <h2 className="section-title">Bandet</h2>
          <label className="field">
            <span className="field-label">Synlighet (opacitet): {Math.round(settings.bandOpacity * 100)} %</span>
            <input
              type="range"
              min="0.15"
              max="0.7"
              step="0.05"
              value={settings.bandOpacity}
              onChange={(e) => set({ bandOpacity: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field-label">Tjocklek: {settings.bandThickness} pt</span>
            <input
              type="range"
              min="10"
              max="60"
              step="2"
              value={settings.bandThickness}
              onChange={(e) => set({ bandThickness: Number(e.target.value) })}
            />
          </label>
          <div
            className="band-preview"
            style={{ background: `rgba(${BAND_COLOR}, ${settings.bandOpacity})`, height: `${settings.bandThickness}px` }}
            aria-hidden="true"
          />
        </section>

        <section>
          <h2 className="section-title">Lagring</h2>
          {estimate ? (
            <p className="settings-hint">
              Använt: {formatSize(estimate.usage)} av ca {formatSize(estimate.quota)}.
            </p>
          ) : (
            <p className="settings-hint">Lagringsinfo är inte tillgänglig i den här webbläsaren.</p>
          )}
          <p className="settings-hint">
            {persisted === true
              ? 'Lagringen är skyddad — webbläsaren rensar den inte automatiskt.'
              : persisted === false
                ? 'Obs: webbläsaren kan i sällsynta fall rensa lagringen. Ta backup regelbundet!'
                : ''}
          </p>
        </section>

        <section>
          <h2 className="section-title">Om</h2>
          <p className="settings-hint">Stickan v1 · funkar helt offline · all data stannar på din enhet.</p>
          <div className="settings-actions">
            <button className="btn" onClick={handleCheckUpdate} disabled={updateStatus === 'checking'}>
              {updateStatus === 'checking' ? 'Söker …' : 'Sök efter uppdatering'}
            </button>
          </div>
          {updateStatus === 'found' && (
            <p className="settings-message">En ny version hämtas — tryck ”Uppdatera” i rutan som strax dyker upp.</p>
          )}
          {updateStatus === 'none' && <p className="settings-hint">Du har redan den senaste versionen.</p>}
          {updateStatus === 'error' && <p className="form-error">Kunde inte söka efter uppdatering — är du offline?</p>}
        </section>
      </main>

      {restorePreview && (
        <Modal
          title="Återställ från backup"
          onClose={() => setRestorePreview(null)}
          actions={
            <button className="btn" onClick={() => setRestorePreview(null)} disabled={busy}>
              Avbryt
            </button>
          }
        >
          <p>
            Backupen är från {formatDate(restorePreview.summary.exportedAt)} och innehåller{' '}
            <strong>{restorePreview.summary.patternCount} mönster</strong>,{' '}
            <strong>{restorePreview.summary.projectCount} projekt</strong> och{' '}
            {restorePreview.summary.folderCount} mappar.
          </p>
          <div className="menu-list restore-choices">
            <button className="menu-item" onClick={() => applyRestore('merge')} disabled={busy}>
              <strong>Slå ihop</strong>
              <span className="menu-item-meta">Behåller din data — nyaste versionen vinner</span>
            </button>
            <button className="menu-item menu-item-danger" onClick={() => applyRestore('replace')} disabled={busy}>
              <strong>Ersätt allt</strong>
              <span className="menu-item-meta">Raderar det som finns i appen nu</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}
