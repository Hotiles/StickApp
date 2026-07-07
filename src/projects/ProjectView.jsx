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
  DEFAULT_VIEW_STATE,
} from '../storage/storage.js';
import { usePdfDocument } from '../pdf/usePdfDocument.js';
import PdfViewer from '../pdf/PdfViewer.jsx';
import CounterPanel from '../counters/CounterPanel.jsx';
import Modal from '../ui/Modal.jsx';
import FinishForm from './FinishForm.jsx';
import ProjectInfoSheet from './ProjectInfoSheet.jsx';
import PatternThumb from '../patterns/PatternThumb.jsx';
import { YarnColorPicker, yarnColorValue } from '../ui/yarnColors.jsx';
import { useWakeLock } from '../ui/useWakeLock.js';

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
  const [editingInfo, setEditingInfo] = useState(false);
  const [pickingPattern, setPickingPattern] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(null); // { deadline, label }
  const [settings, setSettings] = useState(null);

  const { doc, loading: pdfLoading, error: pdfError } = usePdfDocument(pdfBlob);

  // Soffläget: skärmen ska inte slockna medan man stickar med projektet öppet
  useWakeLock(settings?.keepAwake ?? false);

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
    updateProject(projectId, pending).catch((err) => {
      // Tyst dataförlust är värre än en loggrad — syns i felsökningsläge.
      console.error('Kunde inte spara projektläget', err);
    });
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
    const changes = { patternId };
    if (patternId !== project.patternId) {
      // Nytt mönster ska inte ärva förra mönstrets sida/zoom/band —
      // släng även odebounce:ade vyändringar som hör till det gamla.
      changes.viewState = DEFAULT_VIEW_STATE();
      delete pendingRef.current.viewState;
    }
    const updated = await updateProject(projectId, changes);
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
    <div className="view project-view" style={{ '--project-color': yarnColorValue(project.color) }}>
      <header className="topbar">
        <button className="btn-icon topbar-back" onClick={() => navigate('/')} aria-label="Tillbaka">
          ‹
        </button>
        <h1 className="topbar-title">{project.name}</h1>
        <button
          className="btn-icon"
          onClick={() => {
            // Anteckningen mitt i varvet: ett tryck från mönstret (UX-plan A1)
            flush();
            setEditingInfo(true);
          }}
          aria-label="Projektinfo och anteckningar"
        >
          <PencilIcon />
        </button>
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
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                flush();
                setEditingInfo(true);
              }}
            >
              Projektinfo & anteckningar
              <span className="menu-item-meta">Garn, stickor, foton — sparas medan du skriver</span>
            </button>
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
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                setPickingColor(true);
              }}
            >
              Byt garnfärg
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                setEditingDeadline({
                  deadline: project.deadline || '',
                  label: project.deadlineLabel || '',
                });
              }}
            >
              {project.deadline ? 'Ändra deadline' : 'Sätt deadline …'}
              <span className="menu-item-meta">T.ex. ”Julklapp, klar 24 december”</span>
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

      {editingInfo && (
        <ProjectInfoSheet
          project={project}
          onClose={(updated) => {
            setEditingInfo(false);
            // Räknare/vyläge kan inte ha ändrats medan arket var öppet
            // (flush körs innan det öppnas) — DB-versionen är sanningen.
            if (updated) setProject(updated);
          }}
        />
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

      {editingDeadline && (
        <Modal
          title="Deadline"
          onClose={() => setEditingDeadline(null)}
          actions={
            <>
              {project.deadline && (
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    const updated = await updateProject(projectId, {
                      deadline: null,
                      deadlineLabel: '',
                    });
                    setProject(updated);
                    setEditingDeadline(null);
                  }}
                >
                  Ta bort
                </button>
              )}
              <button className="btn" onClick={() => setEditingDeadline(null)}>
                Avbryt
              </button>
              <button
                className="btn btn-primary"
                disabled={!editingDeadline.deadline}
                onClick={async () => {
                  const updated = await updateProject(projectId, {
                    deadline: editingDeadline.deadline,
                    deadlineLabel: editingDeadline.label.trim(),
                  });
                  setProject(updated);
                  setEditingDeadline(null);
                }}
              >
                Spara
              </button>
            </>
          }
        >
          <div className="form">
            <label className="field">
              <span className="field-label">Klart senast</span>
              <input
                className="input"
                type="date"
                value={editingDeadline.deadline}
                onChange={(e) => setEditingDeadline({ ...editingDeadline, deadline: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Etikett (valfri)</span>
              <input
                className="input"
                value={editingDeadline.label}
                maxLength={30}
                placeholder="T.ex. Julklapp 🎁"
                onChange={(e) => setEditingDeadline({ ...editingDeadline, label: e.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}

      {pickingColor && (
        <Modal title="Garnfärg" onClose={() => setPickingColor(false)}>
          <YarnColorPicker
            value={project.color}
            onChange={async (color) => {
              const updated = await updateProject(projectId, { color });
              setProject(updated);
              setPickingColor(false);
            }}
          />
        </Modal>
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

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" strokeLinejoin="round" />
    </svg>
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
              className={`menu-item menu-item-row ${p.id === currentId ? 'menu-item-active' : ''}`}
              onClick={() => onPick(p.id)}
            >
              <PatternThumb pattern={p} className="menu-item-thumb" />
              <span className="menu-item-text">
                {p.name}
                <span className="menu-item-meta">{p.pageCount} sidor</span>
              </span>
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
