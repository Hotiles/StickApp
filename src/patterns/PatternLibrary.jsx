import { useCallback, useEffect, useRef, useState } from 'react';
import { navigate } from '../app/router.jsx';
import {
  listFolders,
  listPatterns,
  createFolder,
  renameFolder,
  deleteFolder,
  updatePattern,
  deletePattern,
} from '../storage/storage.js';
import { importPdfFile } from './importPattern.js';
import TopBar from '../ui/TopBar.jsx';
import Modal from '../ui/Modal.jsx';
import PatternThumb from './PatternThumb.jsx';
import YarnBall from '../ui/YarnBall.jsx';
import { SkeletonTiles } from '../ui/Skeleton.jsx';
import { NewProjectModal } from '../app/HomeView.jsx';

/*
 * Mönsterbiblioteket (§4.2): mappar, PDF-import, öppna fristående.
 * Borttagning av mapp flyttar mönstren till Osorterat.
 */
export default function PatternLibrary() {
  const [folders, setFolders] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('alla'); // 'alla' | 'osorterat' | folder-id
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderMenu, setFolderMenu] = useState(null); // folder-objekt
  const [folderRename, setFolderRename] = useState(null); // { id, name }
  const [patternMenu, setPatternMenu] = useState(null); // pattern-objekt
  const [patternRename, setPatternRename] = useState(null); // { id, name }
  const [patternMove, setPatternMove] = useState(null); // pattern-objekt
  const [confirmDeletePattern, setConfirmDeletePattern] = useState(null);
  const [startProjectFor, setStartProjectFor] = useState(null);

  const fileRef = useRef(null);

  const reload = useCallback(async () => {
    setFolders(await listFolders());
    const folderId =
      selectedFolder === 'alla' ? undefined : selectedFolder === 'osorterat' ? null : selectedFolder;
    setPatterns(await listPatterns(folderId));
  }, [selectedFolder]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleImport(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const targetFolder =
      selectedFolder !== 'alla' && selectedFolder !== 'osorterat' ? selectedFolder : null;
    const errors = [];
    for (const file of files) {
      try {
        await importPdfFile(file, targetFolder);
      } catch (err) {
        errors.push(err.message);
      }
    }
    if (errors.length) setError(errors.join(' '));
    setBusy(false);
    reload();
  }

  return (
    <div className="view">
      <TopBar
        title="Mönster"
        backTo="/"
        right={
          <button
            className="btn btn-primary btn-small"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Importerar …' : '+ PDF'}
          </button>
        }
      />
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={handleImport} />

      <div className="folder-bar" role="tablist" aria-label="Mappar">
        <FolderChip label="Alla" active={selectedFolder === 'alla'} onClick={() => setSelectedFolder('alla')} />
        <FolderChip
          label="Osorterat"
          active={selectedFolder === 'osorterat'}
          onClick={() => setSelectedFolder('osorterat')}
        />
        {folders.map((f) => (
          <FolderChip
            key={f.id}
            label={f.name}
            active={selectedFolder === f.id}
            onClick={() => (selectedFolder === f.id ? setFolderMenu(f) : setSelectedFolder(f.id))}
            showMenuDots={selectedFolder === f.id}
          />
        ))}
        <button className="folder-chip folder-chip-new" onClick={() => setNewFolderOpen(true)}>
          + Ny mapp
        </button>
      </div>

      <main className="view-body">
        {error && <p className="form-error">{error}</p>}
        {patterns === null ? (
          <SkeletonTiles count={4} />
        ) : patterns.length === 0 ? (
          <div className="empty-state">
            <YarnBall />
            <p>Inga mönster här än.</p>
            <p className="empty-state-hint">
              Tryck på ”+ PDF” för att importera ett mönster — eller dela en PDF till Stickan från en
              annan app.
            </p>
          </div>
        ) : (
          <ul className="pattern-grid">
            {patterns.map((p) => (
              <li key={p.id} className="pattern-card">
                <button className="pattern-open" onClick={() => navigate(`/monster/visa/${p.id}`)}>
                  <PatternThumb pattern={p} className="pattern-card-thumb" />
                  <span className="pattern-name">{p.name}</span>
                  <span className="pattern-meta">
                    {p.pageCount} sidor · {formatSize(p.fileSize)}
                  </span>
                </button>
                <button
                  className="pattern-card-menu"
                  onClick={() => setPatternMenu(p)}
                  aria-label={`Meny för ${p.name}`}
                >
                  ⋯
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* ---------- Mappdialoger ---------- */}
      {newFolderOpen && (
        <TextPromptModal
          title="Ny mapp"
          placeholder="T.ex. Sockor"
          onClose={() => setNewFolderOpen(false)}
          onSave={async (name) => {
            const folder = await createFolder(name);
            setNewFolderOpen(false);
            setSelectedFolder(folder.id);
          }}
        />
      )}

      {folderMenu && (
        <Modal title={folderMenu.name} onClose={() => setFolderMenu(null)}>
          <div className="menu-list">
            <button
              className="menu-item"
              onClick={() => {
                setFolderRename({ id: folderMenu.id, name: folderMenu.name });
                setFolderMenu(null);
              }}
            >
              Byt namn
            </button>
            <button
              className="menu-item menu-item-danger"
              onClick={async () => {
                await deleteFolder(folderMenu.id);
                setFolderMenu(null);
                setSelectedFolder('alla');
                reload();
              }}
            >
              Ta bort mappen (mönstren flyttas till Osorterat)
            </button>
          </div>
        </Modal>
      )}

      {folderRename && (
        <TextPromptModal
          title="Byt namn på mappen"
          initial={folderRename.name}
          onClose={() => setFolderRename(null)}
          onSave={async (name) => {
            await renameFolder(folderRename.id, name);
            setFolderRename(null);
            reload();
          }}
        />
      )}

      {/* ---------- Mönsterdialoger ---------- */}
      {patternMenu && (
        <Modal title={patternMenu.name} onClose={() => setPatternMenu(null)}>
          <div className="menu-list">
            <button
              className="menu-item menu-item-primary"
              onClick={() => {
                setStartProjectFor(patternMenu.id);
                setPatternMenu(null);
              }}
            >
              Starta projekt med mönstret
            </button>
            <button
              className="menu-item"
              onClick={() => {
                navigate(`/monster/visa/${patternMenu.id}`);
              }}
            >
              Öppna mönstret
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setPatternRename({ id: patternMenu.id, name: patternMenu.name });
                setPatternMenu(null);
              }}
            >
              Byt namn
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setPatternMove(patternMenu);
                setPatternMenu(null);
              }}
            >
              Flytta till mapp
            </button>
            <button
              className="menu-item menu-item-danger"
              onClick={() => {
                setConfirmDeletePattern(patternMenu);
                setPatternMenu(null);
              }}
            >
              Ta bort mönstret
            </button>
          </div>
        </Modal>
      )}

      {patternRename && (
        <TextPromptModal
          title="Byt namn på mönstret"
          initial={patternRename.name}
          onClose={() => setPatternRename(null)}
          onSave={async (name) => {
            await updatePattern(patternRename.id, { name });
            setPatternRename(null);
            reload();
          }}
        />
      )}

      {patternMove && (
        <Modal title="Flytta till mapp" onClose={() => setPatternMove(null)}>
          <div className="menu-list">
            <button
              className="menu-item"
              onClick={async () => {
                await updatePattern(patternMove.id, { folderId: null });
                setPatternMove(null);
                reload();
              }}
            >
              Osorterat
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                className={`menu-item ${patternMove.folderId === f.id ? 'menu-item-active' : ''}`}
                onClick={async () => {
                  await updatePattern(patternMove.id, { folderId: f.id });
                  setPatternMove(null);
                  reload();
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {confirmDeletePattern && (
        <Modal
          title="Ta bort mönstret?"
          onClose={() => setConfirmDeletePattern(null)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirmDeletePattern(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await deletePattern(confirmDeletePattern.id);
                  setConfirmDeletePattern(null);
                  reload();
                }}
              >
                Ta bort
              </button>
            </>
          }
        >
          <p>
            ”{confirmDeletePattern.name}” tas bort. Projekt som använder mönstret behåller sina
            räknare men tappar mönstret.
          </p>
        </Modal>
      )}

      {startProjectFor && (
        <NewProjectModal defaultPatternId={startProjectFor} onClose={() => setStartProjectFor(null)} />
      )}
    </div>
  );
}

function FolderChip({ label, active, onClick, showMenuDots = false }) {
  return (
    <button className={`folder-chip ${active ? 'folder-chip-active' : ''}`} onClick={onClick} role="tab" aria-selected={active}>
      {label}
      {showMenuDots && <span className="folder-chip-dots"> ⋯</span>}
    </button>
  );
}

function TextPromptModal({ title, initial = '', placeholder, onClose, onSave }) {
  const [value, setValue] = useState(initial);
  const canSave = value.trim().length > 0;

  function submit(e) {
    e?.preventDefault();
    if (canSave) onSave(value.trim());
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!canSave}>
            Spara
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <input
          className="input"
          autoFocus
          value={value}
          maxLength={40}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
      </form>
    </Modal>
  );
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
