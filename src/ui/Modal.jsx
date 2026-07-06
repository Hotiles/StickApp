import { useEffect, useRef } from 'react';

/*
 * Bottom sheet på mobil (draghandtag + svep ner för att stänga),
 * centrerad dialog på större skärmar. Escape och tryck på bakgrunden
 * stänger alltid.
 */
export default function Modal({ title, onClose, children, actions }) {
  const ref = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onHandlePointerDown(e) {
    dragRef.current = { startY: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ref.current) ref.current.style.transition = 'none';
  }

  function onHandlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || !ref.current) return;
    drag.dy = Math.max(0, e.clientY - drag.startY);
    ref.current.style.transform = `translateY(${drag.dy}px)`;
  }

  function onHandlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    const modal = ref.current;
    if (!modal) return;
    modal.style.transition = '';
    if (drag && drag.dy > 90) {
      onClose?.();
    } else {
      modal.style.transform = '';
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div
          className="modal-handle"
          aria-hidden="true"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        />
        {title && <h2 className="modal-title">{title}</h2>}
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
