import { useState } from 'react';
import TopBar from '../ui/TopBar.jsx';
import { distribute } from './distribute.js';

/*
 * Öka & minska jämnt: skriv in antal maskor och hur många du vill lägga
 * till eller ta bort, så ger verktyget två förslag — det enklaste (ett kort
 * upprepningskommando) och det mest balanserade (jämnt fördelat med hela
 * maskor kvar i båda kanterna). Räknar live, helt lokalt.
 */
export default function DistributeCalculator() {
  const [mode, setMode] = useState('decrease');
  const [total, setTotal] = useState('');
  const [change, setChange] = useState('');

  const result = distribute(total, change, mode);
  const hasInput = total !== '' && change !== '';
  const verb = mode === 'decrease' ? 'minska' : 'öka';

  return (
    <div className="view">
      <TopBar title="Öka &amp; minska" backTo="/" />
      <main className="view-body">
        <p className="form-intro">
          Skriv in hur många maskor du har och hur många du vill ändra med, så
          räknar Stickan ut hur du fördelar dem jämnt över varvet.
        </p>

        <div className="mode-toggle" role="tablist" aria-label="Öka eller minska">
          <button
            role="tab"
            aria-selected={mode === 'decrease'}
            className={`mode-toggle-btn ${mode === 'decrease' ? 'is-active' : ''}`}
            onClick={() => setMode('decrease')}
          >
            Minska
          </button>
          <button
            role="tab"
            aria-selected={mode === 'increase'}
            className={`mode-toggle-btn ${mode === 'increase' ? 'is-active' : ''}`}
            onClick={() => setMode('increase')}
          >
            Öka
          </button>
        </div>

        <section className="tool-card">
          <div className="field-row">
            <label className="field">
              <span className="field-label">Antal maskor</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="1"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="T.ex. 100"
              />
            </label>
            <label className="field">
              <span className="field-label">Maskor att {verb}</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="1"
                value={change}
                onChange={(e) => setChange(e.target.value)}
                placeholder="T.ex. 10"
              />
            </label>
          </div>
        </section>

        {hasInput && !result.ok && <p className="form-error">{result.error}</p>}

        {result.ok && (
          <>
            <section className="tool-result">
              <p className="tool-result-line">
                {result.total} → <strong>{result.result} maskor</strong>
              </p>
              <p className="settings-hint">
                {result.change} {result.change === 1 ? 'maska' : 'maskor'}{' '}
                {mode === 'decrease' ? 'minskade' : 'ökade'} jämnt fördelat ·{' '}
                {result.opLabel}
              </p>
            </section>

            <Suggestion
              title="Enklaste sättet"
              hint="Ett kort kommando att upprepa, resten på slutet."
              plan={result.simple}
            />
            <Suggestion
              title="Mest balanserade sättet"
              hint="Jämnt fördelat med hela maskor kvar i båda kanterna."
              plan={result.balanced}
            />
          </>
        )}
      </main>
    </div>
  );
}

function Suggestion({ title, hint, plan }) {
  return (
    <section className="tool-card suggestion">
      <div className="suggestion-head">
        <h2 className="section-title">{title}</h2>
        <p className="settings-hint suggestion-hint">{hint}</p>
      </div>
      <p className="suggestion-text">{plan.text}</p>
      <StitchStrip segments={plan.segments} />
    </section>
  );
}

/* Maskrad-remsa: släta maskor som neutrala brickor, åtgärden markerad. */
function StitchStrip({ segments }) {
  return (
    <ol className="stitch-strip" aria-label="Maskrad">
      {segments.map((s, i) => (
        <li key={i} className="stitch-seg">
          {s.knit > 0 && <span className="stitch-knit">K{s.knit}</span>}
          {s.op && <span className="stitch-op">{s.op}</span>}
        </li>
      ))}
    </ol>
  );
}
