import { useEffect, useState } from 'react';
import { getPattern, getBlob, getSettings } from '../storage/storage.js';
import { usePdfDocument } from '../pdf/usePdfDocument.js';
import PdfViewer from '../pdf/PdfViewer.jsx';
import TopBar from '../ui/TopBar.jsx';

/* Fristående mönstervisning (utan projekt) — för att bläddra i ett mönster. */
export default function PatternView({ patternId }) {
  const [pattern, setPattern] = useState(null);
  const [missing, setMissing] = useState(false);
  const [blob, setBlob] = useState(null);
  const [settings, setSettings] = useState(null);

  const { doc, loading, error } = usePdfDocument(blob);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getPattern(patternId);
      if (cancelled) return;
      if (!p) {
        setMissing(true);
        return;
      }
      setPattern(p);
      setSettings(await getSettings());
      const b = await getBlob(p.fileBlobId);
      if (!cancelled) {
        if (b) setBlob(b);
        else setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patternId]);

  if (missing) {
    return (
      <div className="view">
        <TopBar title="Mönster" backTo="/monster" />
        <div className="empty-state">
          <p>Mönstret hittades inte.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view project-view">
      <TopBar title={pattern?.name ?? 'Mönster'} backTo="/monster" />
      <div className="project-main">
        {error ? (
          <div className="empty-state">
            <p>Mönstret kunde inte öppnas.</p>
          </div>
        ) : !doc || loading || !settings ? (
          <div className="pdf-status">Laddar mönster …</div>
        ) : (
          <PdfViewer
            doc={doc}
            initialViewState={{
              page: 1,
              zoom: 1,
              scrollX: 0,
              scrollY: 0,
              band: {
                orientation: 'horisontell',
                positionByPage: {},
                positionByPageV: {},
                visible: false,
                lastMovedPage: null,
              },
            }}
            bandOpacity={settings.bandOpacity}
            bandThickness={settings.bandThickness}
          />
        )}
      </div>
    </div>
  );
}
