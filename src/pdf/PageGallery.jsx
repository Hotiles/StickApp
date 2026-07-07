import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { renderPageThumb } from './thumbnail.js';

/*
 * Sidgalleriet (D7): tryck på sidindikatorn → rutnät med alla sidor för
 * direkthopp. Två "här är du"-markörer: aktuell sida får en ram, och sidan
 * där bandet senast flyttades får en bandmärkning — det är återresan till
 * ditt varv efter en avstickare ("kolla diagrammet på sidan 6").
 *
 * Miniatyrerna renderas först när de syns (IntersectionObserver) och cachas
 * i minnet per dokument (WeakMap — försvinner med dokumentet). Inget sparas
 * i IndexedDB: sidminiatyrer i lagringen skulle svälla backuperna i onödan.
 */

const thumbCache = new WeakMap(); // doc → Map(pageNum → dataURL)

export default function PageGallery({ doc, currentPage, bandPage, onPick, onClose }) {
  const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return (
    <Modal title="Sidor" onClose={onClose}>
      <div className="page-gallery">
        {pages.map((p) => (
          <PageThumb
            key={p}
            doc={doc}
            pageNum={p}
            current={p === currentPage}
            hasBand={p === bandPage}
            onPick={() => onPick(p)}
          />
        ))}
      </div>
    </Modal>
  );
}

function PageThumb({ doc, pageNum, current, hasBand, onPick }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(() => thumbCache.get(doc)?.get(pageNum) ?? null);

  // Rendera miniatyren först när rutan syns (eller nästan syns)
  useEffect(() => {
    if (src) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        renderPageThumb(doc, pageNum)
          .then((url) => {
            let cache = thumbCache.get(doc);
            if (!cache) thumbCache.set(doc, (cache = new Map()));
            cache.set(pageNum, url);
            if (!cancelled) setSrc(url);
          })
          .catch(() => {
            /* trasig sida — rutan förblir tom, sidnumret räcker för hopp */
          });
      },
      { root: el.closest('.modal'), rootMargin: '300px' }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [doc, pageNum, src]);

  // Öppna galleriet med aktuell sida i blickfånget
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      ref={ref}
      className={`page-thumb ${current ? 'page-thumb-current' : ''}`}
      onClick={onPick}
      aria-label={`Sida ${pageNum}${hasBand ? ' – ditt band är här' : ''}`}
      aria-current={current ? 'page' : undefined}
    >
      <span className="page-thumb-frame">
        {src && <img src={src} alt="" />}
        {hasBand && (
          <span className="page-thumb-band" title="Ditt band är här">
            <BandBadgeIcon />
          </span>
        )}
      </span>
      <span className="page-thumb-num">{pageNum}</span>
    </button>
  );
}

function BandBadgeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="8" width="16" height="5" rx="2" fill="rgba(244,194,219,0.95)" stroke="#3d3436" strokeWidth="1.2" />
    </svg>
  );
}
