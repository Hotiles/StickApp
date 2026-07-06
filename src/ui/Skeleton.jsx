/*
 * Skimrande platshållare medan listor läses från IndexedDB —
 * lugnare än tom yta eller "Laddar …".
 */
export function SkeletonCards({ count = 3 }) {
  return (
    <div className="card-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function SkeletonTiles({ count = 4 }) {
  return (
    <div className="gallery-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-tile" />
      ))}
    </div>
  );
}
