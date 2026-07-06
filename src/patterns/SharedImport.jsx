import { useEffect, useState } from 'react';
import { navigate } from '../app/router.jsx';
import { listFolders } from '../storage/storage.js';
import { importPdfFile } from './importPattern.js';
import TopBar from '../ui/TopBar.jsx';

/*
 * Tar emot en PDF som delats till appen via Web Share Target.
 * Service workern lägger filen i cachen 'stickan-shared'; här hämtar vi den,
 * låter användaren välja namn + mapp och sparar som mönster.
 */
export default function SharedImport() {
  const [file, setFile] = useState(undefined); // undefined = laddar, null = ingen fil
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folders, setFolders] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setFolders(await listFolders());
      try {
        const cache = await caches.open('stickan-shared');
        const response = await cache.match('shared-pdf');
        if (!response) {
          setFile(null);
          return;
        }
        const fileName = decodeURIComponent(response.headers.get('X-File-Name') || 'delat-monster.pdf');
        const blob = await response.blob();
        await cache.delete('shared-pdf');
        setFile(new File([blob], fileName, { type: blob.type || 'application/pdf' }));
        setName(fileName.replace(/\.pdf$/i, ''));
      } catch {
        setFile(null);
      }
    })();
  }, []);

  async function save() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const renamed = new File([file], `${name.trim() || 'Mönster'}.pdf`, { type: file.type });
      await importPdfFile(renamed, folderId || null);
      navigate('/monster', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="view">
      <TopBar title="Importera mönster" backTo="/monster" />
      <main className="view-body">
        {file === undefined ? (
          <p>Hämtar den delade filen …</p>
        ) : file === null ? (
          <div className="empty-state">
            <p>Ingen delad fil hittades.</p>
            <button className="btn" onClick={() => navigate('/monster')}>
              Till mönsterbiblioteket
            </button>
          </div>
        ) : (
          <div className="form">
            <label className="field">
              <span className="field-label">Namn</span>
              <input className="input" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Mapp</span>
              <select className="input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">Osorterat</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" onClick={save} disabled={busy || !name.trim()}>
              {busy ? 'Sparar …' : 'Spara mönstret'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
