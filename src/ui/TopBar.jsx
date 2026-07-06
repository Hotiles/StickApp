import { navigate } from '../app/router.jsx';

export default function TopBar({ title, backTo, right }) {
  return (
    <header className="topbar">
      {backTo != null ? (
        <button className="btn-icon topbar-back" onClick={() => navigate(backTo)} aria-label="Tillbaka">
          ‹
        </button>
      ) : (
        <span className="topbar-back-placeholder" />
      )}
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}
