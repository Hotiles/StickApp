import { useCallback, useEffect, useRef, useState } from 'react';
import { navigate } from '../app/router.jsx';
import {
  getProject,
  updateProject,
  deleteProject,
  getPattern,
  getBlob,
  getSettings,
  updateSettings,
  listPatterns,
} from '../storage/storage.js';
import { usePdfDocument } from '../pdf/usePdfDocument.js';
import PdfViewer from '../pdf/PdfViewer.jsx';
import CounterPanel from '../counters/CounterPanel.jsx';
import Modal from '../ui/Modal.jsx';
import FinishForm from './FinishForm.jsx';

/*
 * Projektvyn (§4.3): mönsterläge + räknarpanel. Allt state (sida, zoom,
 * scroll, band, räknare) sparas debounce:at (~500 ms) så att återuppta
 * alltid funkar — även om appen dödas.
 */
export default function ProjectView({ projectId }) {
  const [project, setProject] = useState(null);
  const [missing, setMissing] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [blobMissing, setBlobMissing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [pickingPattern, setPickingPattern] = useState(false);
  const [settings, setSettings] = useState(null);

  const { doc, loading: pdfLoading, error: pdfError } = usePdfDocument(pdfBlob);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getProject(projectId);
      if (cancelled) return;
      if (!p) {
        setMissing(true);
        return;
      }
      setProject(p);
      setSettings(await getSettings());
      updateSettings({ lastOpenedProjectId: p.id });
      if (p.patternId) {
        const pattern = await getPattern(p.patternId);
        const blob = pattern?.fileBlobId ? await getBlob(pattern.fileBlobId) : null;
        if (!cancelled) {
          if (blob) setPdfBlob(blob);
          else setBlobMissing(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ---------- Debounce:ad persistens ----------
  const pendingRef = useRef({});
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingRef.current = {};
    updateProject(projectId, pending).catch(() => {});
  }, [projectId]);

  const saveDebounced = useCallback(
    (changes) => {
      pendingRef.current = { ...pendingRef.current, ...changes };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 500);
    },
    [flush]
  );

  // Spara direkt om appen göms/stängs — sista chansen innan iOS dödar den
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

  function handleViewStateChange(viewState) {
    saveDebounced({ viewState });
  }

  function handleCountersChange(counters) {
    setProject((p) => ({ ...p, counters }));
    saveDebounced({ counters });
  }

  async function handleRename(name) {
    const updated = await updateProject(projectId, { name });
    setProject(updated);
  }

  async function handlePickPattern(patternId) {
    const updated = await updateProject(projectId, { patternId });
    setPickingPattern(false);
    setProject(updated);
    setPdfBlob(null);
    setBlobMissing(false);
    if (patternId) {
      const pattern = await getPattern(patternId);
      const blob = pattern?.fileBlobId ? await getBlob(pattern.fileBlobId) : null;
      if (blob) setPdfBlob(blob);
      else setBlobMissing(true);
    }
  }

  if (missing) {
    return (
      <div className="view">
        <div className="empty-state">
          <p>Projektet hittades inte.</p>
          <button className="btn" onClick={() => navigate('/')}>
            Till startsidan
          </button>
        </div>
      </div>
    );
  }

  if (!project || !settings) return <div className="view loading-view">Laddar …</div>;

  return (
    <div className="view project-view">
      <header className="topbar">
        <button className="btn-icon topbar-back" onClick={() => navigate('/')} aria-label="Tillbaka">
          ‹
        </button>
        <h1 className="topbar-title">{project.name}</h1>
        <button className="btn-icon" onClick={() => setMenuOpen(true)} aria-label="Projektmeny">
          ⋯
        </button>
      </header>

      <div className="project-main">
        {project.patternId ? (
          pdfError || blobMissing ? (
            <div className="empty-state">
              <p>Mönstret kunde inte öppnas.</p>
              <button className="btn" onClick={() => setPickingPattern(true)}>
                Välj annat mönster
              </button>
            </div>
          ) : pdfBlob == null || pdfLoading ? (
            <div className="pdf-status">Laddar mönster …</div>
          ) : (
            doc && (
              <PdfViewer
                doc={doc}
                initialViewState={project.viewState}
                bandOpacity={settings.bandOpacity}
                bandThickness={settings.bandThickness}
                onStateChange={handleViewStateChange}
              />
            )
          )
        ) : (
          <div className="empty-state project-no-pattern">
            <p>Inget mönster valt för det här projektet.</p>
            <button className="btn btn-primary" onClick={() => setPickingPattern(true)}>
              Välj mönster
            </button>
          </div>
        )}
      </div>

      <CounterPanel counters={project.counters} onChange={handleCountersChange} />

      {menuOpen && (
        <Modal title={project.name} onClose={() => setMenuOpen(false)}>
          <div className="menu-list">
            <button
              className="menu-item menu-item-primary"
              onClick={() => {
                setMenuOpen(false);
                flush();
                setFinishing(true);
              }}
            >
              Markera som färdigt
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                setPickingPattern(true);
              }}
            >
              {project.patternId ? 'Byt mönster' : 'Välj mönster'}
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(project.name);
              }}
            >
              Byt namn
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

      {renaming != null && (
        <RenameModal
          value={renaming}
          onChange={setRenaming}
          onClose={() => setRenaming(null)}
          onSave={async () => {
            if (renaming.trim()) await handleRename(renaming.trim());
            setRenaming(null);
          }}
        />
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
                  navigate('/');
                }}
              >
                Ta bort
              </button>
            </>
          }
        >
          <p>
            ”{project.name}” och dess foton tas bort. Mönstret ligger kvar i biblioteket. Det här går
            inte att ångra.
          </p>
        </Modal>
      )}

      {finishing && (
        <FinishForm
          project={project}
          onClose={() => setFinishing(false)}
          onSaved={(updated) => {
            setFinishing(false);
            navigate(`/fardiga/${updated.id}`);
          }}
        />
      )}

      {pickingPattern && (
        <PatternPickerModal
          currentId={project.patternId}
          onClose={() => setPickingPattern(false)}
          onPick={handlePickPattern}
        />
      )}
    </div>
  );
}

function RenameModal({ value, onChange, onClose, onSave }) {
  return (
    <Modal
      title="Byt namn"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={!value.trim()}>
            Spara
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <input className="input" autoFocus value={value} maxLength={60} onChange={(e) => onChange(e.target.value)} />
      </form>
    </Modal>
  );
}

function PatternPickerModal({ currentId, onClose, onPick }) {
  const [patterns, setPatterns] = useState(null);

  useEffect(() => {
    listPatterns().then(setPatterns);
  }, []);

  return (
    <Modal title="Välj mönster" onClose={onClose}>
      {patterns === null ? (
        <p>Laddar …</p>
      ) : patterns.length === 0 ? (
        <div className="empty-state">
          <p>Inga mönster i biblioteket än.</p>
          <button className="btn" onClick={() => navigate('/monster')}>
            Öppna mönsterbiblioteket
          </button>
        </div>
      ) : (
        <div className="menu-list">
          {patterns.map((p) => (
            <button
              key={p.id}
              className={`menu-item ${p.id === currentId ? 'menu-item-active' : ''}`}
              onClick={() => onPick(p.id)}
            >
              {p.name}
              <span className="menu-item-meta">{p.pageCount} sidor</span>
            </button>
          ))}
          {currentId && (
            <button className="menu-item menu-item-danger" onClick={() => onPick(null)}>
              Ta bort kopplingen till mönstret
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
