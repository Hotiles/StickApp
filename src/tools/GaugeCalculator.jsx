import { useState } from 'react';
import TopBar from '../ui/TopBar.jsx';

/*
 * Masktäthetsräknaren: provlappens täthet + önskat mått → antal
 * maskor att lägga upp och varv att sticka. Räknar live, helt lokalt.
 */
export default function GaugeCalculator() {
  const [stitchesPer10, setStitchesPer10] = useState('');
  const [rowsPer10, setRowsPer10] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  const stitches = calc(stitchesPer10, width);
  const rows = calc(rowsPer10, height);

  return (
    <div className="view">
      <TopBar title="Masktäthet" backTo="/" />
      <main className="view-body">
        <p className="form-intro">
          Sticka en provlapp, mät hur många maskor och varv du får på 10 cm och fyll i vad du vill
          att det färdiga stycket ska mäta.
        </p>

        <section className="tool-card">
          <h2 className="section-title">Provlappen</h2>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Maskor per 10 cm</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="1"
                value={stitchesPer10}
                onChange={(e) => setStitchesPer10(e.target.value)}
                placeholder="T.ex. 22"
              />
            </label>
            <label className="field">
              <span className="field-label">Varv per 10 cm</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="1"
                value={rowsPer10}
                onChange={(e) => setRowsPer10(e.target.value)}
                placeholder="T.ex. 30"
              />
            </label>
          </div>
        </section>

        <section className="tool-card">
          <h2 className="section-title">Önskat mått</h2>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Bredd (cm)</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="T.ex. 50"
              />
            </label>
            <label className="field">
              <span className="field-label">Höjd (cm)</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="T.ex. 60"
              />
            </label>
          </div>
        </section>

        {(stitches || rows) && (
          <section className="tool-result">
            {stitches && (
              <p className="tool-result-line">
                Lägg upp <strong>{stitches} maskor</strong>
              </p>
            )}
            {rows && (
              <p className="tool-result-line">
                Sticka <strong>{rows} varv</strong>
              </p>
            )}
            <p className="settings-hint">Avrundat till närmaste hel maska/varv.</p>
          </section>
        )}
      </main>
    </div>
  );
}

function calc(per10, cm) {
  const a = parseFloat(String(per10).replace(',', '.'));
  const b = parseFloat(String(cm).replace(',', '.'));
  if (!(a > 0) || !(b > 0)) return null;
  return Math.round((a / 10) * b);
}
