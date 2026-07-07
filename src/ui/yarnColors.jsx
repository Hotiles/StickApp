/*
 * Garnpaletten: kuraterade garniga toner som ett projekt kan få.
 * Färgen tonar projektkortet, räknarna och hjältekortet — hemskärmen
 * ska kännas som en garnkorg, inte en att-göra-lista.
 */
export const YARN_COLORS = [
  { id: 'rosa', name: 'Rosa', value: '#d4759f' },
  { id: 'terrakotta', name: 'Terrakotta', value: '#c96f4a' },
  { id: 'senap', name: 'Senap', value: '#b8892e' },
  { id: 'salvia', name: 'Salvia', value: '#71915f' },
  { id: 'dovbla', name: 'Dovblå', value: '#5f7fa6' },
  { id: 'lavendel', name: 'Lavendel', value: '#9179b8' },
  { id: 'rost', name: 'Rost', value: '#a85543' },
  { id: 'havre', name: 'Havre', value: '#998363' },
];

export function yarnColorValue(id) {
  return YARN_COLORS.find((c) => c.id === id)?.value ?? YARN_COLORS[0].value;
}

/** Slumpad startfärg så nya projekt inte alla blir likadana. */
export function randomYarnColorId() {
  return YARN_COLORS[Math.floor(Math.random() * YARN_COLORS.length)].id;
}

export function YarnColorPicker({ value, onChange }) {
  return (
    <div className="yarn-color-row" role="radiogroup" aria-label="Projektfärg">
      {YARN_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`yarn-swatch ${value === c.id ? 'yarn-swatch-active' : ''}`}
          style={{ background: c.value }}
          role="radio"
          aria-checked={value === c.id}
          aria-label={c.name}
          title={c.name}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}
