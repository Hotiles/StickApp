import { useEffect, useState } from 'react';
import { getBlob, putBlob, updatePattern } from '../storage/storage.js';
import { renderPdfThumbnail } from '../pdf/thumbnail.js';

/*
 * Visar mönstrets miniatyr. Mönster importerade innan miniatyrer fanns
 * backfillas här: första gången de visas renderas och sparas en thumb.
 */

const inFlight = new Map(); // pattern.id → Promise<thumbBlobId|null>

export function ensurePatternThumb(pattern) {
  if (!pattern) return Promise.resolve(null);
  if (pattern.thumbBlobId) return Promise.resolve(pattern.thumbBlobId);
  if (!pattern.fileBlobId) return Promise.resolve(null);
  if (!inFlight.has(pattern.id)) {
    inFlight.set(
      pattern.id,
      (async () => {
        try {
          const pdfBlob = await getBlob(pattern.fileBlobId);
          if (!pdfBlob) return null;
          const thumb = await renderPdfThumbnail(pdfBlob);
          const thumbBlobId = await putBlob(thumb);
          await updatePattern(pattern.id, { thumbBlobId });
          return thumbBlobId;
        } catch {
          return null;
        } finally {
          inFlight.delete(pattern.id);
        }
      })()
    );
  }
  return inFlight.get(pattern.id);
}

export default function PatternThumb({ pattern, className = '' }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    ensurePatternThumb(pattern)
      .then((id) => (id ? getBlob(id) : null))
      .then((blob) => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern?.id, pattern?.thumbBlobId]);

  return (
    <div className={`pattern-thumb ${className}`} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" /> : <PatternGlyph />}
    </div>
  );
}

function PatternGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
