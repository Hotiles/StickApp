import { useEffect, useState } from 'react';
import { openPdfFromBlob } from './pdfjs.js';

export function usePdfDocument(blob) {
  const [state, setState] = useState({ doc: null, error: null, loading: !!blob });

  useEffect(() => {
    if (!blob) {
      setState({ doc: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    let loadedDoc = null;
    setState({ doc: null, error: null, loading: true });

    openPdfFromBlob(blob)
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        loadedDoc = doc;
        setState({ doc, error: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) setState({ doc: null, error: err, loading: false });
      });

    return () => {
      cancelled = true;
      if (loadedDoc) loadedDoc.destroy();
    };
  }, [blob]);

  return state;
}
