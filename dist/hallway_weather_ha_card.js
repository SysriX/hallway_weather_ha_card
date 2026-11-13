// flur-wetter-card – animiertes Wetter-Modul fürs Flur-Tablet (Optik passend zu raum-panel v2)
// Ressource: /hacsfiles/hallway_weather_ha_card/hallway_weather_ha_card.js (type: module); Schriften aus fonts/ daneben (oder window.RP_FONT_BASE)
// Inhalt: animiertes Wettersymbol, Temperatur, gefühlt, Wind, Regen-Verlauf der nächsten Stunden,
// Hinweise „Schirm?“ / „Jacke?“, optional Regenradar (DWD-WMS oder RainViewer) und DWD-Unwetterwarnung (WFS).
// Konfiguration und Beispiele: ANLEITUNG-FLUR-WETTER.md
const FW_VERSION = '1.4.1';
// Ablageort dieser Datei (fonts/ liegt daneben), z. B. /hacsfiles/hallway_weather_ha_card/
const FW_BASE = (() => {
  const dir = s => String(s).replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  try { if (document.currentScript && document.currentScript.src) return dir(document.currentScript.src); } catch (e) { /* Modul: kein currentScript */ }
  try { throw new Error(); } catch (e) {
    const st = String(e.stack || ''), m = st.match(/((?:https?|file):\/\/[^\s)'"]*?\/)(?:hallway_weather_ha_card|flur-wetter-card)\.js/) || st.match(/((?:https?|file):\/\/[^\s)'"]*?\/)[^/\s)'"]+\.js/);
    if (m) return m[1];
  }
  try { const r = (performance.getEntriesByType('resource') || []).find(x => /\/(?:hallway_weather_ha_card|flur-wetter-card)\.js/.test(x.name)); if (r) return dir(r.name); } catch (e) { /* Standardpfad */ }
  return '/local/raum-tablet-card/';
})();
const DW = 480;                                   // Designbreite „breit“ in px, die Karte skaliert auf ihre Breite
const DWK = 340;                                  // Designbreite „kompakt“ (kleine, fast quadratische Rahmen wie im Flur-Panel)

const FW_DE = { 'clear-night': 'Klar', cloudy: 'Bewölkt', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter mit Regen',
  partlycloudy: 'Teils bewölkt', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'Sonnig',
  windy: 'Windig', 'windy-variant': 'Windig, bewölkt', exceptional: 'Unwetter' };
const FW_KURZ = { sunny: 'Sonne', 'clear-night': 'Klar', partlycloudy: 'Teils', cloudy: 'Wolken', fog: 'Nebel', rainy: 'Regen', pouring: 'Stark', snowy: 'Schnee',
  'snowy-rainy': 'Schn.R.', hail: 'Hagel', lightning: 'Blitz', 'lightning-rainy': 'Gewit.', windy: 'Wind', 'windy-variant': 'Wind+W', exceptional: 'Unw.' };
const RAIN_RE = /rainy|pouring|hail/;
const WARN_SEV = { Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };
const WARN_COL = { 1: '#f5d742', 2: '#ff9a2e', 3: '#ff4b3e', 4: '#c34bff' };
const DIRS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const r0 = v => v == null ? '--' : String(Math.round(v)).replace('-', '−');
const de1 = v => v == null ? '--' : (Math.round(v * 10) / 10).toLocaleString('de-DE');
const hh = d => String(d.getHours()).padStart(2, '0');
const hm = d => hh(d) + ':' + String(d.getMinutes()).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Wind in km/h umrechnen
const kmh = (v, u) => { if (v == null) return null; u = (u || 'km/h').toLowerCase(); return u === 'm/s' ? v * 3.6 : u === 'mph' ? v * 1.609 : u === 'kn' ? v * 1.852 : v; };

// gefühlte Temperatur: Windchill (≤10 °C), Hitzeindex (≥26,7 °C), sonst Steadman (Apparent Temperature ohne Sonne)
const feels = (T, rh, v) => {
  if (T == null) return null;
  v = v || 0;
  if (T <= 10 && v > 4.8) { const p = Math.pow(v, 0.16); return 13.12 + 0.6215 * T - 11.37 * p + 0.3965 * T * p; }
  if (T >= 26.7 && rh != null && rh >= 40) {
    const F = T * 9 / 5 + 32;
    const HI = -42.379 + 2.04901523 * F + 10.14333127 * rh - .22475541 * F * rh - .00683783 * F * F - .05481717 * rh * rh + .00122874 * F * F * rh + .00085282 * F * rh * rh - .00000199 * F * F * rh * rh;
    return (HI - 32) * 5 / 9;
  }
  if (rh != null) { const e = rh / 100 * 6.105 * Math.exp(17.27 * T / (237.7 + T)); return T + 0.33 * e - 0.70 * (v / 3.6) - 4.00; }
  return T;
};

// ------------------------------------------------------------------ animierte Symbole (viewBox 0 0 64 64)
const CLOUD = 'M14,44C8,44 5,40 5,35.5C5,31 8.5,27.5 13,27.5C14,20 20,15 27,15C33.5,15 38.5,19 40,25C41,24.7 42,24.5 43,24.5C49,24.5 53.5,29 53.5,34.5C53.5,39.8 49.5,44 44,44Z';
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="fw-sun" cx="40%" cy="38%" r="65%"><stop offset="0" stop-color="#fff6c4"/><stop offset=".45" stop-color="#ffd447"/><stop offset="1" stop-color="#ff9d1c"/></radialGradient>
<radialGradient id="fw-halo" r="50%"><stop offset=".35" stop-color="#ffcf4a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf4a" stop-opacity="0"/></radialGradient>
<linearGradient id="fw-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ffab2e"/></linearGradient>
<radialGradient id="fw-moon" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#fffbe8"/><stop offset=".6" stop-color="#e6e2cf"/><stop offset="1" stop-color="#b7b4a6"/></radialGradient>
<radialGradient id="fw-mhalo" r="50%"><stop offset=".4" stop-color="#cfd8ff" stop-opacity=".35"/><stop offset="1" stop-color="#cfd8ff" stop-opacity="0"/></radialGradient>
<linearGradient id="fw-cl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3e8ef"/><stop offset="1" stop-color="#b9c2cf"/></linearGradient>
<linearGradient id="fw-cl2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd5de"/><stop offset="1" stop-color="#8f99a8"/></linearGradient>
<linearGradient id="fw-cld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa3b1"/><stop offset=".7" stop-color="#666f7e"/><stop offset="1" stop-color="#4b5260"/></linearGradient>
<linearGradient id="fw-cls" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c7790"/><stop offset=".7" stop-color="#4b465c"/><stop offset="1" stop-color="#363244"/></linearGradient>
<linearGradient id="fw-drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0ff" stop-opacity=".2"/><stop offset="1" stop-color="#5fb0ff"/></linearGradient>
<linearGradient id="fw-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7b0"/><stop offset="1" stop-color="#ffc21a"/></linearGradient>
<filter id="fw-sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".45"/></filter>
<filter id="fw-gl" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs></svg>`;

const sun = (cx, cy, r) => {
  let rays = '';
  for (let i = 0; i < 12; i++) rays += `<path d="M${cx - 1.6},${cy - r - 3} L${cx},${cy - r - 3 - (i % 2 ? 4.5 : 7)} L${cx + 1.6},${cy - r - 3}Z" fill="url(#fw-ray)" transform="rotate(${i * 30} ${cx} ${cy})"/>`;
  return `<g><circle cx="${cx}" cy="${cy}" r="${r * 2}" fill="url(#fw-halo)" class="glow"/><g class="spin" style="transform-origin:${cx}px ${cy}px">${rays}</g>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#fw-sun)" filter="url(#fw-sh)"/><circle cx="${cx - r * .35}" cy="${cy - r * .38}" r="${r * .28}" fill="#fff" opacity=".45"/></g>`;
};
const moon = (cx, cy, r, stars) => {
  const st = stars ? [[12, 14, 1.3, 0], [52, 12, 1, 1.1], [48, 30, 1.4, .6], [16, 40, .9, 1.8], [56, 46, 1.1, 2.3], [24, 8, .8, 1.4]].map(([x, y, s, d]) =>
    `<path class="twk" style="animation-delay:-${d}s" d="M${x},${y - s * 2.6} L${x + s * .7},${y - s * .7} L${x + s * 2.6},${y} L${x + s * .7},${y + s * .7} L${x},${y + s * 2.6} L${x - s * .7},${y + s * .7} L${x - s * 2.6},${y} L${x - s * .7},${y - s * .7}Z" fill="#fff6d8"/>`).join('') : '';
  return `<g>${st}<circle cx="${cx}" cy="${cy}" r="${r * 1.9}" fill="url(#fw-mhalo)" class="glow"/>
<path d="M${cx + r * .35},${cy - r} A${r},${r} 0 1 0 ${cx + r},${cy + r * .25} A${r * .78},${r * .78} 0 0 1 ${cx + r * .35},${cy - r}Z" fill="url(#fw-moon)" filter="url(#fw-sh)"/>
<circle cx="${cx - r * .35}" cy="${cy + r * .2}" r="${r * .13}" fill="#000" opacity=".08"/><circle cx="${cx - r * .05}" cy="${cy + r * .55}" r="${r * .09}" fill="#000" opacity=".07"/></g>`;
};
const cloud = (x, y, s, fill = 'fw-cl', cls = 'drift') => `<g class="${cls}"><g transform="translate(${x} ${y}) scale(${s})"><path d="${CLOUD}" fill="url(#${fill})" filter="url(#fw-sh)"/>
<path d="M13,30C14.5,23 20,18.5 27,18.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/></g></g>`;
const drops = (n, x0, dx, y, fast) => { let s = ''; for (let i = 0; i < n; i++) { const x = x0 + i * dx, d = ((i * 0.37) % 1) * (fast ? .6 : 1); s += `<path class="drop${fast ? ' f' : ''}" style="animation-delay:-${d.toFixed(2)}s" d="M${x},${y} q-1.6,3.4 0,4.6 q1.6,-1.2 0,-4.6z" fill="url(#fw-drop)"/>`; } return s; };
const flakes = (n, x0, dx, y) => { let s = ''; for (let i = 0; i < n; i++) { const x = x0 + i * dx, d = (i * .73) % 3; s += `<g class="flake" style="animation-delay:-${d.toFixed(2)}s;transform-origin:${x}px ${y}px"><path d="M${x - 2.6},${y}H${x + 2.6}M${x - 1.3},${y - 2.25}L${x + 1.3},${y + 2.25}M${x + 1.3},${y - 2.25}L${x - 1.3},${y + 2.25}" stroke="#f4f9ff" stroke-width="1.1" stroke-linecap="round"/></g>`; } return s; };
const hail = (n, x0, dx, y) => { let s = ''; for (let i = 0; i < n; i++) s += `<circle class="hailb" style="animation-delay:-${((i * .29) % .8).toFixed(2)}s" cx="${x0 + i * dx}" cy="${y}" r="1.9" fill="#e9f4ff" stroke="#9fc3ff" stroke-width=".5"/>`; return s; };
const bolt = (x, y) => `<path class="bolt" d="M${x + 4},${y} L${x - 3},${y + 11} L${x + 1.5},${y + 11} L${x - 2},${y + 20} L${x + 8},${y + 7} L${x + 3},${y + 7} L${x + 6},${y}Z" fill="url(#fw-bolt)" filter="url(#fw-gl)"/>`;
const fogl = (y0) => [0, 1, 2].map(i => `<path class="fogl" style="animation-delay:-${i * 1.7}s" d="M${10 + i * 3},${y0 + i * 6}H${54 - i * 4}" stroke="#d6dce5" stroke-opacity="${.85 - i * .2}" stroke-width="3.2" stroke-linecap="round"/>`).join('');
const gusts = () => `<g fill="none" stroke="#dfe7f2" stroke-width="2.4" stroke-linecap="round">
<path class="gust" d="M6,24 H38 C46,24 46,13 39,14" pathLength="100"/><path class="gust" style="animation-delay:-.9s" d="M4,34 H50 C58,34 58,45 50,44" pathLength="100"/>
<path class="gust" style="animation-delay:-1.7s" d="M10,44 H30 C36,44 36,52 31,51" pathLength="100"/></g>`;

const fwIcon = (c, night) => {
  const body = (() => {
    switch (c) {
      case 'sunny': return night ? moon(32, 32, 14, true) : sun(32, 32, 13);
      case 'clear-night': return moon(32, 32, 14, true);
      case 'partlycloudy': return (night ? moon(23, 22, 11, false) : sun(23, 22, 10)) + cloud(9, 12, .9);
      case 'cloudy': return cloud(14, 0, .72, 'fw-cl2', 'drift2') + cloud(3, 12, .95);
      case 'fog': return cloud(5, 0, .9, 'fw-cl2') + fogl(43);
      case 'rainy': return cloud(4, 2, .95, 'fw-cld') + drops(4, 20, 8, 46);
      case 'pouring': return cloud(4, 0, .95, 'fw-cld') + drops(6, 15, 6.5, 44, true);
      case 'snowy': return cloud(4, 2, .95, 'fw-cl2') + flakes(4, 19, 8.5, 48);
      case 'snowy-rainy': return cloud(4, 2, .95, 'fw-cl2') + drops(2, 20, 17, 46) + flakes(2, 28, 17, 48);
      case 'hail': return cloud(4, 2, .95, 'fw-cld') + hail(5, 18, 7, 48);
      case 'lightning': return cloud(4, 0, .95, 'fw-cls') + bolt(29, 38);
      case 'lightning-rainy': return cloud(4, 0, .95, 'fw-cls') + drops(3, 17, 7, 46) + bolt(37, 38);
      case 'windy': return gusts();
      case 'windy-variant': return cloud(10, -4, .85, 'fw-cl2') + `<g transform="translate(0 14)">${gusts()}</g>`;
      case 'exceptional': return `<g class="glow"><path d="M32,8 L58,54 H6Z" fill="#ff4b3e" stroke="#ffd2cc" stroke-width="2" stroke-linejoin="round" filter="url(#fw-sh)"/><rect x="29.5" y="22" width="5" height="18" rx="2.5" fill="#fff"/><circle cx="32" cy="46.5" r="3" fill="#fff"/></g>`;
      default: return cloud(4, 6, .95, 'fw-cl2');
    }
  })();
  return `<svg viewBox="0 0 64 64" overflow="visible">${body}</svg>`;
};

// kleine Symbole für die Hinweise
const ICON_SCHIRM = s => s === 'nein'
  ? `<svg viewBox="0 0 40 40"><path d="M20,5 L23,27 H17Z" fill="#6f7682"/><path d="M20,27 V33 Q20,36 17,36 Q14,36 14,33" fill="none" stroke="#aeb2b9" stroke-width="2.2" stroke-linecap="round"/><path d="M20,5 V3" stroke="#aeb2b9" stroke-width="2" stroke-linecap="round"/></svg>`
  : `<svg viewBox="0 0 40 40"><g class="rock"><path d="M4,19 Q5,6 20,5 Q35,6 36,19 Q32,16 28,19 Q24,15.5 20,19 Q16,15.5 12,19 Q8,16 4,19Z" fill="${s === 'ja' ? '#4d9cff' : '#7aa7d9'}" stroke="#cfe4ff" stroke-width=".8"/>
<path d="M20,5 Q15,9 12,19 M20,5 Q25,9 28,19" fill="none" stroke="#cfe4ff" stroke-opacity=".6" stroke-width=".8"/>
<path d="M20,19 V32 Q20,35 17,35 Q14,35 14,32" fill="none" stroke="#e1e4ea" stroke-width="2.2" stroke-linecap="round"/></g>
${s === 'ja' ? `<path class="drop" d="M8,24 q-1.4,3 0,4 q1.4,-1 0,-4z" fill="#8cc4ff"/><path class="drop" style="animation-delay:-.5s" d="M33,23 q-1.4,3 0,4 q1.4,-1 0,-4z" fill="#8cc4ff"/>` : ''}</svg>`;
const ICON_JACKE = s => s === 'nein'
  ? `<svg viewBox="0 0 40 40"><path d="M14,7 L8,10 L4,17 L9,20 L11,17 V34 H29 V17 L31,20 L36,17 L32,10 L26,7 Q20,11 14,7Z" fill="#ffb347" stroke="#ffe0b0" stroke-width=".8" stroke-linejoin="round"/></svg>`
  : `<svg viewBox="0 0 40 40"><path d="M14,6 L7,9 Q4,11 4,15 L3,33 H9 L10,18 V35 H30 V18 L31,33 H37 L36,15 Q36,11 33,9 L26,6 L20,12Z" fill="${s === 'warm' ? '#3f7ad6' : s === 'jacke' ? '#5c8fd8' : '#7fa9de'}" stroke="#cfe0ff" stroke-width=".8" stroke-linejoin="round"/>
<path d="M20,12 V35" stroke="#1d3561" stroke-width="1.2"/><path d="M14,6 L20,12 L26,6" fill="none" stroke="#e8f0ff" stroke-width="1.2"/>
${s === 'warm' ? '<path d="M10,20 H30 M10,25.5 H30 M10,31 H30" stroke="#2c5aa3" stroke-width="1.1"/><path d="M15,4 Q20,2 25,4 L26,6 Q20,9 14,6Z" fill="#e7e2d6"/>' : ''}</svg>`;

// ------------------------------------------------------------------ CSS
const FW_CSS = `
:host{display:block;position:relative;--fw-acc:#9fc3ff}
:host([fuellen]){height:100%}
*{box-sizing:border-box;margin:0}
.wrap{position:relative;width:100%;overflow:hidden}
:host([fuellen]) .wrap{height:100%}
.stage{position:absolute;left:0;top:0;width:${DW}px;transform-origin:top left;color:#c9ccd2;line-height:1.2;
  font-family:Rajdhani,'Segoe UI',sans-serif;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.plate{position:relative;border-radius:20px;overflow:hidden;padding:16px 18px 16px}
.bg-glas .plate,.bg-himmel .plate{background:linear-gradient(180deg,rgba(50,52,58,.78),rgba(24,25,29,.88));border:1px solid rgba(255,255,255,.07);
  box-shadow:0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.6),0 20px 36px rgba(0,0,0,.55)}
.bg-keiner .plate{padding:4px 2px}
.sky{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .6s,background 2s}
.bg-himmel .sky{opacity:var(--sky-o,1)}
.sky::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(10,11,14,.55))}
.fx{position:absolute;inset:0;pointer-events:none;overflow:hidden;display:none;opacity:var(--fx-o,1);transition:opacity .6s}
.efx .fx{display:block}
.plate::before{content:"";position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.08),rgba(255,255,255,0) 38%);pointer-events:none;z-index:1}
.bg-keiner .plate::before{display:none}
.z{position:relative;z-index:2;display:flex;flex-direction:column;gap:12px}
.cap{font-size:12px;letter-spacing:2.5px;color:#8a8e96;font-weight:700;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;gap:8px;white-space:nowrap}
.cap .upd{letter-spacing:1px;font-weight:600;color:#959aa3}
.mono{font-family:'Share Tech Mono',monospace}
.head{display:flex;align-items:center;gap:14px;cursor:pointer}
.ic{width:142px;height:142px;flex:none;margin:-8px -4px -10px -6px}
.ic svg{width:100%;height:100%;display:block;overflow:visible}
.now{flex:1;min-width:0}
.tmp{display:flex;align-items:flex-start;color:#f1f2f4;line-height:.9;text-shadow:0 0 18px rgba(255,255,255,.12)}
.tmp .tv{font-family:'Share Tech Mono',monospace;font-size:70px;letter-spacing:-2px}
.tmp .dg{font-size:34px;margin-top:4px;color:#c9ccd2}
.cond{font-size:15px;letter-spacing:2.4px;font-weight:700;color:#d6d9de;text-transform:uppercase;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row2{display:flex;gap:14px;margin-top:8px;font-size:14.5px;font-weight:600;color:#aeb2b9;white-space:nowrap}
.row2 b{color:#eceef1;font-weight:700}
.wind{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:14.5px;font-weight:600;color:#aeb2b9;white-space:nowrap}
.wind svg{width:22px;height:22px;flex:none;transition:transform 1.5s cubic-bezier(.3,1.4,.5,1)}
.wind b{color:#eceef1}
.hints{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hint{position:relative;display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:12px;min-width:0;
  background:rgba(0,0,0,.25);box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05)}
.hint svg{width:42px;height:42px;flex:none;overflow:visible}
.hint .t{font-size:15.5px;font-weight:700;letter-spacing:.4px;color:#eceef1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hint .s{font-size:12.5px;font-weight:600;color:#8a8e96;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hint .led{position:absolute;right:9px;top:9px;width:8px;height:8px;border-radius:50%;background:var(--lc,#3a3c41);box-shadow:0 0 8px var(--lc,transparent)}
.hint.ja{box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 0 0 1px rgba(95,176,255,.45),0 0 16px rgba(95,176,255,.18)}
.hint.ja .t{color:#bfe0ff;text-shadow:0 0 10px rgba(95,176,255,.6)}
.hint.warm .t{color:#cfe0ff}
.chart{position:relative;padding:8px 10px 4px;border-radius:12px;background:rgba(0,0,0,.25);box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05);cursor:pointer}
.chart .n{font-size:11.5px;letter-spacing:2px;font-weight:700;color:#8a8e96;text-transform:uppercase;display:flex;justify-content:space-between;gap:6px;white-space:nowrap}
.chart .n i{font-style:normal;color:var(--fw-acc)}
.chart svg{display:block;width:100%;height:96px;overflow:visible}
.chart text{font-family:Rajdhani,'Segoe UI',sans-serif;font-weight:700}
.warn{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;background:color-mix(in srgb,var(--wc) 16%,rgba(0,0,0,.35));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--wc) 55%,transparent),0 0 18px color-mix(in srgb,var(--wc) 25%,transparent);cursor:pointer}
.warn svg{width:30px;height:30px;flex:none}
.warn .t{font-size:14.5px;font-weight:700;color:#fff;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.warn .s{font-size:12.5px;font-weight:600;color:#d6d9de;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.warn .tx{min-width:0;flex:1}
.an .warn svg{animation:fwglow 1.6s ease-in-out infinite alternate}
.wdet{position:absolute;inset:0;z-index:6;padding:18px;border-radius:20px;background:rgba(14,15,18,.96);overflow:auto;font-size:14px;color:#d6d9de;line-height:1.35}
.wdet h3{font-size:16px;color:#fff;margin:0 0 4px}.wdet p{margin:4px 0 12px;white-space:pre-line}.wdet .x{position:absolute;right:12px;top:10px;font-size:22px;color:#8a8e96;cursor:pointer}
.radar{position:relative;height:250px;border-radius:12px;overflow:hidden;background:#0e1013;box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05)}
.radar.ov{position:absolute;inset:0;height:auto;z-index:5;border-radius:20px}
.radar .map,.radar .lay{position:absolute;inset:0}
.radar img{position:absolute;display:block;pointer-events:none;-webkit-user-drag:none}
.radar .base.dunkel img{filter:invert(1) hue-rotate(180deg) brightness(.8) contrast(.85) saturate(.35)}
.radar .lab{opacity:.85}
.radar .fr{opacity:0;transition:opacity .25s}
.radar .fr.on{opacity:.85}
.radar .me{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#ff5a4a;box-shadow:0 0 0 2px #fff,0 0 12px #ff5a4a}
.an .radar .me::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid #ff5a4a;animation:fwping 2s ease-out infinite}
.radar .bar{position:absolute;left:10px;right:10px;bottom:8px;display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:9px;background:rgba(0,0,0,.6);font-size:13px;font-weight:700;color:#eceef1}
.radar .tl{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.12);position:relative;overflow:hidden}
.radar .tl b{position:absolute;left:0;top:0;bottom:0;background:var(--fw-acc);border-radius:3px}
.radar .tl s{position:absolute;top:0;bottom:0;width:2px;background:#fff;opacity:.6}
.radar .ti{min-width:92px;text-align:right}.radar .ti.fc{color:#ffd47a}
.radar .src{position:absolute;right:10px;top:8px;font-size:10.5px;color:#cfd2d8;opacity:.75;text-shadow:0 1px 2px #000}
.radar .x{position:absolute;left:12px;top:6px;font-size:24px;color:#eceef1;text-shadow:0 1px 3px #000;cursor:pointer}
.radar .msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:#8a8e96}
.pv{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
.pv button{font:700 11.5px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#9a9ea6;background:linear-gradient(180deg,#2c2e33,#1f2023);
  border:0;border-radius:7px;padding:5px 8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 1px 2px #000;cursor:pointer}
.pv button.on{color:#0f1012;background:var(--fw-acc)}
.pvr{display:flex;gap:14px;align-items:center;font:700 11.5px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#9a9ea6}
.pvr label{display:flex;align-items:center;gap:6px;flex:1}.pvr input{flex:1;accent-color:var(--fw-acc);min-width:0}
.hide{display:none!important}
/* kompakt */
.sh{display:none}.k .sh{display:inline}.k .lg{display:none}
.k .plate{padding:12px 14px}
.k .z{gap:9px}
.k .cap{font-size:11px;letter-spacing:2px}
.k .head{gap:8px}
.k .ic{width:112px;height:112px;margin:-8px -2px -8px -6px}
.k .tmp .tv{font-size:58px;letter-spacing:-1.5px}.k .tmp .dg{font-size:28px}
.k .cond{font-size:13.5px;letter-spacing:1.8px;margin-top:4px}
.k .row2{font-size:13px;gap:10px;margin-top:6px}
.k .wind{font-size:13px;gap:5px;margin-top:4px}.k .wind svg{width:18px;height:18px}
.k .hints{gap:8px}
.k .hint{padding:7px 9px 7px 7px;gap:7px}
.k .hint svg{width:32px;height:32px}
.k .hint .t{font-size:14px;letter-spacing:.2px}.k .hint .s{font-size:11.5px}
.k .hint .led{right:6px;top:6px;width:6px;height:6px}
.k .chart{padding:6px 8px 3px}.k .chart .n{font-size:10.5px;letter-spacing:1.6px}.k .chart svg{height:74px}
.k .warn{padding:6px 9px;gap:8px}.k .warn svg{width:24px;height:24px}.k .warn .t{font-size:13px}.k .warn .s{font-size:11.5px}
/* Rahmen füllen: Verlauf wächst */
.fh .plate{height:100%}.fh .z{height:100%}.fh .chart{flex:1;display:flex;flex-direction:column;min-height:0}.fh .chart svg{flex:1;height:auto;min-height:0}
/* im Glasrahmen des Raum-Panels: keine zweite Platte, Himmel bleibt */
.inp .plate{border:0;box-shadow:none;background:none}
/* Ebene über die ganze Kartenfläche (beim Füllen): Himmel + Effekte bis an den Rand, nicht nur hinter der skalierten Bühne */
.bgl{position:absolute;inset:0;overflow:hidden;pointer-events:none;display:none}
.wrap.fl .bgl{display:block}
.wrap.fl:not(.inpw).bg-glas .bgl,.wrap.fl:not(.inpw).bg-himmel .bgl{border-radius:20px;background:linear-gradient(180deg,rgba(50,52,58,.78),rgba(24,25,29,.88));border:1px solid rgba(255,255,255,.07);box-shadow:0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.14),0 20px 36px rgba(0,0,0,.55)}
.wrap.fl .stage:not(.tbg) .plate{background:none;border:0;box-shadow:none}
.wrap.fl .stage:not(.tbg) .plate::before{display:none}
/* im Raum-Panel schneidet der Glasrahmen die Ecken selbst ab: keine eigene Rundung (sonst Spalt in den Ecken) */
.inp .plate,.inpw .bgl{border-radius:0}
/* Baustein allein (teil:, raum-panel „frei anordnen“): nur dieser Abschnitt; _hintergrund = nur Himmel/Effekte */
.teil .z>[data-t]:not(.ton){display:none!important}.teil .plate{padding:2px}
.tbg .z{display:none}.tbg .plate{height:100%;padding:0}
.hv .hints{grid-template-columns:1fr}
/* Animationen */
.an .spin{animation:fwspin 40s linear infinite}
.an .glow{animation:fwglow 4s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
.an .drift{animation:fwdrift 7s ease-in-out infinite alternate}
.an .drift2{animation:fwdrift 10s ease-in-out -3s infinite alternate-reverse}
.an .drop{animation:fwdrop 1.1s linear infinite}
.an .drop.f{animation-duration:.65s}
.an .flake{animation:fwsnow 3s linear infinite}
.an .hailb{animation:fwhail .8s cubic-bezier(.5,0,1,.5) infinite}
.an .bolt{animation:fwbolt 4.2s linear infinite}
.bolt{opacity:.9}
.an .fogl{animation:fwfog 5s ease-in-out infinite alternate}
.an .twk{animation:fwtw 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.gust{stroke-dasharray:55 45}
.an .gust{animation:fwgust 2.4s linear infinite}
.an .rock{animation:fwrock 3s ease-in-out infinite alternate;transform-origin:20px 32px}
/* Effekte über die ganze Karte */
.fx .rn{position:absolute;inset:-40px;background:repeating-linear-gradient(105deg,transparent 0 18px,rgba(170,205,255,.13) 18px 19px,transparent 19px 41px)}
.an .fx .rn{animation:fwrain .5s linear infinite}
.fx .rn.b{opacity:.7;background-size:83px 100%}.an .fx .rn.b{animation-duration:.8s}
.fx .rn.h{background:repeating-linear-gradient(103deg,transparent 0 9px,rgba(170,205,255,.2) 9px 10.5px,transparent 10.5px 23px)}.an .fx .rn.h{animation:fwrainh .32s linear infinite}
.fx .sn{position:absolute;inset:-120px 0 0;background-image:radial-gradient(2px 2px at 20px 30px,#fff9,transparent),radial-gradient(1.5px 1.5px at 90px 70px,#fff8,transparent),radial-gradient(2.5px 2.5px at 150px 20px,#fff8,transparent),radial-gradient(1.5px 1.5px at 60px 110px,#fff8,transparent);background-size:180px 120px}
.an .fx .sn{animation:fwsnowbg 9s linear infinite}
.fx .sn.b{inset:-160px 0 0;background-image:radial-gradient(3.5px 3.5px at 40px 50px,#fffc,transparent),radial-gradient(3px 3px at 170px 120px,#fffb,transparent);background-size:240px 160px;filter:blur(.6px)}
.an .fx .sn.b{animation:fwsnowbg2 13s linear infinite}
.fx .hl{position:absolute;inset:-60px 0 0;background-image:radial-gradient(2.6px 2.6px at 15px 10px,#f1f8ff,transparent),radial-gradient(2px 2px at 50px 40px,#dfeeff,transparent);background-size:70px 60px}
.an .fx .hl{animation:fwhl .38s linear infinite}
.fx .hl.b{background-size:95px 60px;opacity:.7}.an .fx .hl.b{animation-duration:.55s}
.fx .cb{position:absolute;width:var(--w,200px);height:var(--h,60px);border-radius:50%;background:radial-gradient(ellipse at 50% 55%,rgba(235,240,248,.22),rgba(235,240,248,.09) 45%,transparent 70%);filter:blur(5px)}
.fx .cb.d{background:radial-gradient(ellipse at 50% 55%,rgba(110,120,138,.42),rgba(80,90,106,.18) 45%,transparent 70%)}
.an .fx .cb{animation:fwcloud linear infinite}
.fx .sg{position:absolute;left:-14%;top:-18%;width:75%;height:75%;border-radius:50%;background:radial-gradient(circle,rgba(255,214,120,.30),transparent 65%)}
.fx .mg{position:absolute;left:-12%;top:-16%;width:70%;height:70%;border-radius:50%;background:radial-gradient(circle,rgba(190,205,255,.16),transparent 65%)}
.an .fx .sg,.an .fx .mg{animation:fwpulse 6s ease-in-out infinite alternate}
.fx .bk{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(255,236,170,.4),transparent 70%)}
.an .fx .bk{animation:fwbk 13s linear infinite}
.fx .ss{position:absolute;width:90px;height:1.5px;background:linear-gradient(90deg,#fff,transparent);opacity:0;transform:rotate(-25deg)}
.an .fx .ss{animation:fwss 11s ease-in infinite}
.fx .wd{position:absolute;inset:0;width:100%;height:100%}
.fx .wd path{fill:none;stroke:rgba(230,238,250,.38);stroke-width:1.4;stroke-linecap:round;stroke-dasharray:16 84;vector-effect:non-scaling-stroke}
.an .fx .wd path{animation:fwgust 1.9s linear infinite}
.fx .lf{position:absolute;left:-10%;width:10px;height:6px;border-radius:0 100% 0 100%;background:linear-gradient(135deg,#d9a24a,#9c6526);opacity:.85}
.an .fx .lf{animation:fwleaf 4.6s linear infinite}
.fx .bb{position:absolute;overflow:visible;opacity:0;filter:drop-shadow(0 0 4px #c9c2ff) drop-shadow(0 0 10px #8f86ff)}
.an .fx .bb{animation:fwbolt 4.2s linear infinite}
.fx .vg{position:absolute;inset:0;box-shadow:inset 0 0 70px rgba(255,60,40,.5)}
.an .fx .vg{animation:fwpulse 1.6s ease-in-out infinite alternate}
.fx .st{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.5}
.an .fx .st{animation:fwtw 3.5s ease-in-out infinite}
.fx .sr{position:absolute;left:-30%;top:-60%;width:90%;height:150%;background:conic-gradient(from 160deg at 30% 0%,transparent 0deg,rgba(255,220,140,.10) 8deg,transparent 16deg,rgba(255,220,140,.07) 26deg,transparent 34deg);filter:blur(4px)}
.an .fx .sr{animation:fwrays 14s ease-in-out infinite alternate}
.fx .fl{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(200,190,255,.35),transparent 60%);opacity:0}
.an .fx .fl{animation:fwbolt 4.2s linear infinite}
.fx .fg{position:absolute;left:-20%;right:-20%;height:60px;background:linear-gradient(90deg,transparent,rgba(210,215,225,.08),transparent);filter:blur(6px)}
.an .fx .fg{animation:fwfog 9s ease-in-out infinite alternate}
@keyframes fwspin{to{transform:rotate(360deg)}}
@keyframes fwglow{from{opacity:.6;transform:scale(.94)}to{opacity:1;transform:scale(1.06)}}
@keyframes fwdrift{from{transform:translateX(-2.5px)}to{transform:translateX(2.5px)}}
@keyframes fwdrop{0%{transform:translate(1px,-5px);opacity:0}15%{opacity:1}100%{transform:translate(-3px,13px);opacity:0}}
@keyframes fwsnow{0%{transform:translate(0,-5px) rotate(0);opacity:0}15%{opacity:1}50%{transform:translate(2px,4px) rotate(90deg)}100%{transform:translate(-1px,13px) rotate(180deg);opacity:0}}
@keyframes fwhail{0%{transform:translateY(-6px);opacity:0}20%{opacity:1}100%{transform:translateY(12px);opacity:0}}
@keyframes fwbolt{0%,84%,100%{opacity:0}86%,91%{opacity:1}88.5%{opacity:.25}}
@keyframes fwfog{from{transform:translateX(-4px)}to{transform:translateX(4px)}}
@keyframes fwtw{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes fwgust{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes fwrock{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
@keyframes fwrain{from{transform:translate(0,0)}to{transform:translate(-11px,41px)}}
@keyframes fwsnowbg{from{transform:translateY(0)}to{transform:translateY(120px)}}
@keyframes fwsnowbg2{from{transform:translate(0,0)}to{transform:translate(-20px,160px)}}
@keyframes fwrainh{from{transform:translate(0,0)}to{transform:translate(-5px,23px)}}
@keyframes fwhl{from{transform:translateY(0)}to{transform:translateY(60px)}}
@keyframes fwcloud{from{left:-55%}to{left:110%}}
@keyframes fwpulse{from{opacity:.55}to{opacity:1}}
@keyframes fwbk{0%{transform:translateY(0) scale(.8);opacity:0}25%{opacity:1}100%{transform:translateY(-300px) scale(1.2);opacity:0}}
@keyframes fwss{0%,88%{opacity:0;transform:translate(0,0) rotate(-25deg)}90%{opacity:1}100%{opacity:0;transform:translate(-170px,80px) rotate(-25deg)}}
@keyframes fwleaf{0%{left:-8%;transform:translateY(0) rotate(0)}50%{transform:translateY(-22px) rotate(230deg)}100%{left:108%;transform:translateY(12px) rotate(500deg)}}
@keyframes fwrays{from{transform:rotate(-6deg);opacity:.6}to{transform:rotate(6deg);opacity:1}}
@keyframes fwping{from{transform:scale(.6);opacity:1}to{transform:scale(2.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.an *{animation:none!important}}
`;
// gleiche Schrift wie die anderen eigenen Karten (raum-panel: Charlie Dotted)
const FW_CD_CSS = `*{font-family:'RP Charlie Voll','Share Tech Mono',monospace!important;font-weight:400!important;font-synthesis:none!important;font-size-adjust:cap-height .6}
.dots,.dots *{font-family:'RP Charlie Punkte','RP Charlie Voll',monospace!important}`;
const fwFonts = cd => {
  if (!document.getElementById('rtc-fonts')) {
    const l = document.createElement('link'); l.id = 'rtc-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Share+Tech+Mono&display=swap';
    document.head.appendChild(l);
  }
  if (cd && !document.getElementById('rp-cd-faces')) {
    const b = window.RP_FONT_BASE || FW_BASE + 'fonts/', st = document.createElement('style'); st.id = 'rp-cd-faces';
    st.textContent = `@font-face{font-family:'RP Charlie Punkte';src:url('${b}charlie_punkte.ttf') format('truetype');font-display:block}
@font-face{font-family:'RP Charlie Voll';src:url('${b}charlie_voll.ttf') format('truetype');font-display:block}`;
    document.head.appendChild(st);
  }
};

// ------------------------------------------------------------------ Vorschau-Daten (Wetterlagen ohne echtes Wetter testen)
const PV = {
  sunny: { t: 24, rh: 45, w: 9, mm: [] }, 'clear-night': { t: 8, rh: 80, w: 4, mm: [] }, partlycloudy: { t: 17, rh: 60, w: 12, mm: [0, 0, 0, 0, 0, .1, .3, .1] },
  cloudy: { t: 12, rh: 78, w: 14, mm: [0, 0, 0, .1, .2, 0] }, fog: { t: 5, rh: 99, w: 3, mm: [] }, rainy: { t: 11, rh: 92, w: 18, mm: [.6, 1.1, 1.4, .8, .3, .1, 0, 0, .2, .4] },
  pouring: { t: 15, rh: 96, w: 24, mm: [4.5, 7, 3.2, 1.2, .4, 0, 0, 0] }, snowy: { t: -3, rh: 88, w: 10, mm: [.3, .5, .6, .4, .2, .1] },
  'snowy-rainy': { t: 1, rh: 94, w: 16, mm: [.4, .7, .5, .3, .1] }, hail: { t: 9, rh: 85, w: 30, g: 60, mm: [2, 1, .3] },
  lightning: { t: 26, rh: 62, w: 20, g: 55, mm: [0, 0, 1.5, 3, .5] }, 'lightning-rainy': { t: 23, rh: 80, w: 25, g: 70, mm: [3, 5, 2, .6, .2] },
  windy: { t: 9, rh: 70, w: 48, g: 80, mm: [] }, 'windy-variant': { t: 8, rh: 75, w: 42, g: 75, mm: [0, .1] }, exceptional: { t: 14, rh: 90, w: 75, g: 110, mm: [6, 8, 4] },
};
const PV_ORDER = ['sunny', 'clear-night', 'partlycloudy', 'cloudy', 'fog', 'rainy', 'pouring', 'snowy', 'snowy-rainy', 'hail', 'lightning', 'lightning-rainy', 'windy', 'windy-variant', 'exceptional'];

// ------------------------------------------------------------------ Karte
const FW_FC = {};   // gemeinsamer Vorhersage-Abruf je Entität

class FlurWetterCard extends HTMLElement {
  // Bausteine für raum-panel („✥ Anordnen“, layout: custom unter type: card) – siehe RPExtCard in raum-panel.js
  static get rpTeile() {
    return { titel: { h: 20 }, warnung: { h: 44 }, jetzt: { h: 110 }, hinweise: { h: 92 }, verlauf: { h: 110 } };
  }
  // Optionen für den raum-panel-Editor (Schlüssel unter card:)
  static get rpOptionen() {
    return {
      hintergrund: { name: 'Hintergrund', typ: 'auswahl', werte: [['himmel', 'Himmel'], ['glas', 'Glas'], ['keiner', 'keiner']], standard: 'himmel' },
      himmel_deckkraft: { name: 'Himmel-Deckkraft %', typ: 'zahl', min: 0, max: 100, schritt: 5, standard: 100, hinweis: '0 = kein Farbverlauf, Effekte bleiben' },
      effekte: { name: 'Wetter-Effekte', typ: 'schalter', standard: true },
      effekte_deckkraft: { name: 'Effekte-Deckkraft %', typ: 'zahl', min: 0, max: 100, schritt: 5, standard: 100 },
      animation: { name: 'Animation', typ: 'schalter', standard: true },
    };
  }
  static get rpDesign() { return { breite: DWK, hoehe: 400 }; }
  static get rpHintergrund() { return true; }
  static get rpStart() {
    return { grid: { columns: 12, row_height: 20, gap: 6, width: DWK },
      elements: { titel: { col: 1, row: 1, w: 12, h: 1 }, jetzt: { col: 1, row: 2, w: 12, h: 5 }, hinweise: { col: 1, row: 7, w: 12, h: 4 }, verlauf: { col: 1, row: 11, w: 12, h: 5 } } };
  }
  static getStubConfig(hass) {
    const w = hass && Object.keys(hass.states).find(e => e.startsWith('weather.'));
    return { entity: w || 'weather.forecast_home' };
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: 'auto' }; }

  setConfig(c) {
    if (!c) throw new Error('Konfiguration fehlt');
    const pct = (v, d) => Math.max(0, Math.min(100, v == null || v === '' || isNaN(Number(v)) ? d : Number(v))) / 100;
    const o = (v, d) => Object.assign({}, d, typeof v === 'object' && v ? v : {});
    const radar = c.radar === true ? { quelle: 'dwd' } : typeof c.radar === 'string' ? { quelle: c.radar } : c.radar && typeof c.radar === 'object' ? c.radar : null;
    this._c = {
      entity: c.entity || c.weather || '',
      forecast: c.vorhersage || c.forecast_entity || '',
      temp: c.temperatur || '', hum: c.feuchte || '', wind: c.wind || '', gust: c.boeen || '',
      titel: c.titel ?? 'Wetter', ort: c.ort ?? '',
      stunden: Math.max(4, Math.min(24, Number(c.stunden) || 12)),
      schirm: o(c.schirm, { stunden: 4, prozent: 40, mm: 0.2 }),
      jacke: o(c.jacke, { stunden: 3, warm: 8, normal: 15, leicht: 19 }),
      radar: radar ? Object.assign({ quelle: 'dwd', zoom: radar.quelle === 'rainviewer' ? 7 : 8, modus: 'tippen', vor: 60, nach: 90 }, radar) : null,
      warnung: c.warnung === undefined ? 'dwd' : c.warnung,        // 'dwd' (WFS am Standort) | sensor.* (dwd_weather_warnings) | false
      warn_min: WARN_SEV[c.warnung_ab] || Number(c.warnung_ab) || 1,
      radar_sensoren: c.radar_sensoren === undefined ? 'auto' : c.radar_sensoren,
      bg: c.hintergrund === false ? 'keiner' : c.hintergrund === true ? 'glas' : ['himmel', 'glas', 'keiner'].includes(c.hintergrund) ? c.hintergrund : 'himmel',
      anim: c.animation !== false,
      skyO: pct(c.himmel_deckkraft, 100),                        // Himmel-Farbverlauf 0–100 % (0 = aus, Effekte bleiben)
      fx: c.effekte ?? (c.hintergrund === undefined || c.hintergrund === 'himmel'),   // Wetter-Effekte über die ganze Karte
      fxO: pct(c.effekte_deckkraft, 100),
      schrift: c.schrift || window.RP_SCHRIFT || 'charlie',
      fuellen: c.fuellen === undefined ? 'auto' : !!c.fuellen,   // auto = im Raum-Panel füllen
      layout: ['breit', 'kompakt'].includes(c.layout) ? c.layout : 'auto',
      aus: new Set([].concat(c.ausblenden || [])),
      pv: !!c.vorschau, pvCond: c.vorschau_zustand || null, pvNight: c.vorschau_nacht ?? null,
    };
    // teil: nur ein Baustein (raum-panel ordnet die Bausteine frei an) – randlos, füllend, Himmel nur in _hintergrund
    const T = c.teil ? String(c.teil) : null;
    this._c.teil = T;
    if (T) { this._c.fuellen = true; this._c.pv = false; if (T !== '_hintergrund') { this._c.bg = 'keiner'; this._c.fx = false; } }
    this._pv = { cond: this._c.pvCond, night: this._c.pvNight, warn: false };
    this._inPanel = undefined; this._lay = null;
    this._built = false;
    if (this.isConnected) this._build();
  }

  set hass(h) {
    const old = this._hass; this._hass = h;
    if (!this._c) return;
    if (!this._built) this._build();
    if (!this._fc && !this._fcBusy) {
      // letzte Vorhersage aus dem Browser zeigen, bis get_forecasts antwortet (DWD braucht teils >10 s)
      try { const k = JSON.parse(localStorage.getItem('flur-wetter-fc:' + (this._c.forecast || this._c.entity)) || 'null'); if (k && Date.now() - k.t < 3 * 3600e3) this._fc = k.f; } catch (e) { /* ohne Speicher */ }
      this._loadForecast();
    }
    if (this._warnWfs === undefined && this.isConnected) { this._warnWfs = null; this._loadWarn(); }
    if (this._c.radar && this._c.radar.modus === 'immer' && !this._radarIv && !this._radarBusy && this.isConnected) this._radarStart();
    const ids = this._watch();
    if (!old || ids.some(e => old.states[e] !== h.states[e])) {
      const ws = h.states[this._c.forecast || this._c.entity];
      if (ws && old && old.states[ws.entity_id] !== ws && Date.now() - (this._fcAt || 0) > 120e3) this._loadForecast();
      this._update();
    }
  }

  connectedCallback() {
    if (this._c && !this._built) this._build();
    this._ro = this._ro || new ResizeObserver(() => this._fit());
    this._ro.observe(this);
    clearInterval(this._iv);
    this._iv = setInterval(() => {
      this._loadForecast(); this._loadWarn(); this._update();
      if (this._radarIv && Date.now() - (this._radarAt || 0) > 9 * 60e3) this._radarStart();   // Radarbilder auffrischen, solange sichtbar
    }, 10 * 60e3);
    this._loadWarn();
  }
  disconnectedCallback() { clearInterval(this._iv); this._ro && this._ro.disconnect(); this._radarStop(); }

  _watch() {
    const c = this._c, l = [c.entity, c.forecast, c.temp, c.hum, c.wind, c.gust, 'sun.sun', ...this._radarSensors()];
    if (typeof c.warnung === 'string' && c.warnung.startsWith('sensor.')) l.push(c.warnung);
    return l.filter(Boolean);
  }
  _radarSensors() {
    const c = this._c, h = this._hass;
    if (!h || c.radar_sensoren === false) return [];
    if (Array.isArray(c.radar_sensoren)) return c.radar_sensoren;
    const obj = (c.entity || '').split('.')[1] || '';
    return ['_radar_niederschlag_aktuell', '_radar_niederschlag_nachste_5_minuten', '_radar_nachster_niederschlag'].map(s => 'sensor.' + obj + s).filter(e => h.states[e]);
  }

  // ---------------------------------------------------------------- Aufbau
  _build() {
    if (!this._c) return;
    const c = this._c;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const cd = c.schrift === 'charlie';
    fwFonts(cd);
    const r = this.shadowRoot;
    const radarSec = c.radar && c.radar.modus === 'immer' && (!c.teil || c.teil === 'verlauf');
    const on = n => c.teil === n ? ' ton' : '';
    r.innerHTML =`<style>${FW_CSS}${cd ? FW_CD_CSS : ''}</style>${DEFS}
<div class="wrap bg-${c.bg}${c.anim ? ' an' : ''}${c.fx ? ' efx' : ''}" style="--sky-o:${c.skyO};--fx-o:${c.fxO}"><div class="bgl" id="bgl"></div><div class="stage${c.teil ? ' teil' + (c.teil === '_hintergrund' ? ' tbg' : '') : ''}" id="st"><div class="plate">
 <div class="sky" id="sky"></div><div class="fx" id="fx"></div>
 <div class="z">
  <div class="cap${c.titel || c.ort ? '' : ' hide'}${on('titel')}" data-t="titel"><span id="ti">${esc(c.titel)}${c.ort ? ' · ' + esc(c.ort) : ''}</span><span class="upd" id="upd"></span></div>
  <div class="warn hide${on('warnung')}" id="warn" data-t="warnung"></div>
  <div class="head${on('jetzt')}" id="head" data-t="jetzt">
   <div class="ic" id="ic"></div>
   <div class="now">
    <div class="tmp"><span class="tv dots" id="tv">--</span><span class="dg">°</span></div>
    <div class="cond" id="cond"></div>
    <div class="row2${c.aus.has('gefuehlt') ? ' hide' : ''}" id="row2"></div>
    <div class="wind${c.aus.has('wind') ? ' hide' : ''}" id="wind"></div>
   </div>
  </div>
  <div class="hints${c.aus.has('hinweise') ? ' hide' : ''}${on('hinweise')}" data-t="hinweise">
   <div class="hint" id="h-schirm"></div><div class="hint" id="h-jacke"></div>
  </div>
  <div class="chart${c.aus.has('verlauf') ? ' hide' : ''}${on('verlauf')}" id="chart" data-t="verlauf"><div class="n"><span id="ch-t">Regen · nächste ${c.stunden} h</span><i id="ch-i"></i></div><svg id="ch" preserveAspectRatio="none"></svg></div>
  ${radarSec ? '<div class="radar" id="radar"></div>' : ''}
  ${c.pv ? `<div class="pvr"><label>Himmel <input type="range" min="0" max="100" id="pv-sky" value="${Math.round(c.skyO * 100)}"></label><label>Effekte <input type="range" min="0" max="100" id="pv-fx" value="${Math.round(c.fxO * 100)}"></label></div><div class="pv" id="pv"></div>` : ''}
 </div>
 ${c.radar && !radarSec ? '<div class="radar ov hide" id="radar"></div>' : ''}
 <div class="wdet hide" id="wdet"></div>
</div></div></div>`;
    const $ = id => r.getElementById(id);
    this.$ = $;
    $('head').addEventListener('click', () => this._more(c.entity));
    $('chart').addEventListener('click', () => { if (c.radar && !radarSec) this._radarOpen(); else this._more(c.entity); });
    $('warn').addEventListener('click', () => this._warnDetail(true));
    $('wdet').addEventListener('click', e => { if (e.target.classList.contains('x') || e.target === $('wdet')) this._warnDetail(false); });
    if (c.pv) ['sky', 'fx'].forEach(k => $('pv-' + k).addEventListener('input', e => r.querySelector('.wrap').style.setProperty('--' + k + '-o', e.target.value / 100)));
    if (c.pv) $('pv').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'echt') this._pv = { cond: null, night: null, warn: false };
      else if (k === 'tag') this._pv.night = false; else if (k === 'nacht') this._pv.night = true;
      else if (k === 'warn') this._pv.warn = !this._pv.warn; else this._pv.cond = k;
      this._iconKey = ''; this._update();
    });
    this._built = true; this._iconKey = ''; this._skyKey = ''; this._dw = DW; this._lay = null;
    if (radarSec) this._radarStart();
    this._update();
    requestAnimationFrame(() => this._fit());
  }

  // im Raum-Panel? (dort: Rahmen füllen, keine eigene Platte)
  _panel() {
    if (this._inPanel) return true;
    let h = this; while (h) { if (h.tagName === 'RAUM-PANEL') return (this._inPanel = true); const r = h.getRootNode(); h = r && r.host; }
    return false;
  }
  _setLayout(L) {
    const st = this.$('st'), k = L === 'kompakt';
    this._dw = k ? DWK : DW;
    st.style.width = this._dw + 'px';
    st.classList.toggle('k', k);
  }
  _fit() {
    const st = this.$ && this.$('st'); if (!st) return;
    const c = this._c, inp = this._panel();
    // nur Himmel/Effekte hinter den Bausteinen: ungeskaliert auf die ganze Fläche
    if (c.teil === '_hintergrund') {
      this.toggleAttribute('fuellen', true); st.classList.toggle('inp', inp); this._bgLayer(false, inp);
      Object.assign(st.style, { transform: 'none', left: '0px', top: '0px', width: (this.clientWidth || DW) + 'px', height: (this.clientHeight || 200) + 'px' });
      return;
    }
    const fill = c.fuellen === true || (c.fuellen === 'auto' && inp);
    this.toggleAttribute('fuellen', fill);
    st.classList.toggle('inp', inp);
    this._bgLayer(fill && !c.teil, inp);
    const w = this.clientWidth || DW, hh = fill ? this.clientHeight : 0;
    st.classList.remove('fh'); st.style.height = '';           // natürliche Höhe messen
    const scale = () => { const s = w / this._dw; return hh ? Math.min(s, hh / (st.offsetHeight || 1)) : s; };
    // Anordnung: breit (480) oder kompakt (340) – automatisch die, die größer dargestellt wird
    let lay = c.teil ? 'kompakt' : c.layout;
    if (lay === 'auto') {
      if (hh) { this._setLayout('breit'); const sb = scale(); this._setLayout('kompakt'); lay = scale() > sb * 1.04 ? 'kompakt' : 'breit'; }
      else lay = w < 380 ? 'kompakt' : 'breit';
    }
    this._setLayout(lay);
    // Baustein allein: Designbreite = Zellbreite (150–340 px), größere Zellen vergrößern gleichmäßig
    // Hinweise in hoher, schmaler Zelle untereinander statt nebeneinander
    if (c.teil) { this._dw = Math.max(150, Math.min(w, DWK)); st.style.width = this._dw + 'px'; st.classList.toggle('hv', c.teil === 'hinweise' && hh > w * .75); }
    if (lay !== this._lay) { this._lay = lay; if (this._chartArgs) this._chart(...this._chartArgs); }
    const nat = st.offsetHeight || 1, s = scale();
    this._scale = s;
    st.style.transform = `scale(${s})`;
    // Rahmen höher als nötig → Regenverlauf wächst mit, damit die Karte den Rahmen ganz füllt
    let top = fill ? Math.max(0, (hh - nat * s) / 2) : 0;
    if (fill && hh / s - nat > 6 && !c.aus.has('verlauf') && (!c.teil || c.teil === 'verlauf')) { st.classList.add('fh'); st.style.height = (hh / s) + 'px'; top = 0; }
    const ch = this.$('ch'), chH = Math.round(ch.getBoundingClientRect().height / s) || 0;
    if (chH && chH !== this._chH) { this._chH = chH; if (this._chartArgs) this._chart(...this._chartArgs); }
    if (fill) { st.style.left = Math.max(0, (w - this._dw * s) / 2) + 'px'; st.style.top = top + 'px'; this.shadowRoot.querySelector('.wrap').style.height = ''; }
    else { st.style.left = st.style.top = '0px'; this.shadowRoot.querySelector('.wrap').style.height = Math.ceil(nat * s) + 'px'; }
    // Charlie: große Zahl in Punkten nur, wenn die Punkte groß genug sind (wie raum-panel, CD_MIN 3.2 px)
    const tv = this.$('tv'); if (tv) tv.classList.toggle('dots', (lay === 'kompakt' ? 58 : 70) * s * 32 / 1024 >= 3.2);
  }

  // fl = Himmel/Effekte liegen in .bgl über der ganzen Kartenfläche (ungeskaliert), sonst in der Platte hinter dem Inhalt
  _bgLayer(fl, inp) {
    const w = this.shadowRoot.querySelector('.wrap'), bgl = this.$('bgl'), sky = this.$('sky'), fx = this.$('fx');
    w.classList.toggle('fl', fl); w.classList.toggle('inpw', !!inp);
    if (!sky || !fx) return;
    const home = fl ? bgl : this.$('st').querySelector('.plate');
    if (sky.parentNode !== home) { home.insertBefore(fx, home.firstChild); home.insertBefore(sky, fx); }
  }

  _more(e) { if (!e) return; const ev = new Event('hass-more-info', { bubbles: true, composed: true }); ev.detail = { entityId: e }; this.dispatchEvent(ev); }

  // ---------------------------------------------------------------- Daten
  async _loadForecast() {
    const h = this._hass, id = this._c && (this._c.forecast || this._c.entity);
    if (!h || !id || !h.states[id] || this._fcBusy) return;
    this._fcBusy = true;
    try {
      // gemeinsamer Abruf je Entität (mehrere Bausteine im Raum-Panel = mehrere Instanzen), 60 s gültig
      let C = FW_FC[id];
      if (!C || Date.now() - C.at > 60e3) C = FW_FC[id] = { at: Date.now(), p: h.connection.sendMessagePromise({ type: 'call_service', domain: 'weather', service: 'get_forecasts',
        service_data: { type: 'hourly' }, target: { entity_id: id }, return_response: true }) };
      let r; try { r = await C.p; } catch (e) { delete FW_FC[id]; throw e; }
      const f = r && r.response && r.response[id] && r.response[id].forecast;
      if (Array.isArray(f)) {
        this._fc = f; this._fcAt = Date.now(); this._fcErr = null;
        try { localStorage.setItem('flur-wetter-fc:' + id, JSON.stringify({ t: this._fcAt, f })); } catch (e) { /* Speicher voll/gesperrt */ }
      }
    } catch (e) { this._fcErr = e && (e.message || e.code) || 'Fehler'; console.warn('flur-wetter-card: get_forecasts', e); }
    this._fcBusy = false;
    this._update();
  }

  async _loadWarn() {
    const c = this._c, h = this._hass;
    if (!c || c.warnung !== 'dwd' || !h || !h.config || (c.teil && c.teil !== 'warnung')) return;
    const lat = h.config.latitude, lon = h.config.longitude;
    if (lat == null) return;
    try {
      const u = 'https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=dwd:Warnungen_Gemeinden&outputFormat=application/json'
        + '&propertyName=NAME,EVENT,SEVERITY,HEADLINE,DESCRIPTION,INSTRUCTION,ONSET,EXPIRES,EC_AREA_COLOR,EC_GROUP'
        + `&CQL_FILTER=${encodeURIComponent(`INTERSECTS(THE_GEOM,POINT(${lat} ${lon}))`)}`;
      const j = await (await fetch(u)).json();
      this._warnWfs = (j.features || []).map(f => f.properties);
    } catch (e) { this._warnWfs = null; }
    this._update();
  }

  // aktuelle Werte (Sensor-Überschreibungen > Wetter-Entität)
  _cur() {
    const h = this._hass, c = this._c, s = h && h.states[c.entity];
    const sv = id => { const st = id && h.states[id]; return st ? num(st.state) : null; };
    const a = (s && s.attributes) || {};
    const wu = (c.wind && h.states[c.wind] && h.states[c.wind].attributes.unit_of_measurement) || a.wind_speed_unit;
    const out = {
      ok: !!s && !['unavailable', 'unknown'].includes(s.state),
      cond: s ? s.state : null,
      temp: sv(c.temp) ?? num(a.temperature),
      hum: sv(c.hum) ?? num(a.humidity),
      wind: kmh(sv(c.wind) ?? num(a.wind_speed), wu),
      gust: kmh(sv(c.gust) ?? num(a.wind_gust_speed), wu),
      bearing: num(a.wind_bearing),
      app: num(a.apparent_temperature),
      name: a.friendly_name || '',
      upd: s ? new Date(s.last_updated) : null,
    };
    const sun = h && h.states['sun.sun'];
    out.night = sun ? sun.state === 'below_horizon' : (new Date().getHours() < 7 || new Date().getHours() >= 19);
    return out;
  }

  // stündliche Reihe ab jetzt
  _series(cur) {
    const now = Date.now(), wu = (this._hass.states[this._c.forecast || this._c.entity] || { attributes: {} }).attributes.wind_speed_unit;
    return (this._fc || []).filter(f => new Date(f.datetime).getTime() > now - 45 * 60e3).slice(0, 48).map(f => ({
      t: new Date(f.datetime), cond: f.condition, temp: num(f.temperature), hum: num(f.humidity),
      wind: kmh(num(f.wind_speed), wu), gust: kmh(num(f.wind_gust_speed), wu),
      pp: num(f.precipitation_probability), mm: num(f.precipitation), day: f.is_daytime,
    }));
  }

  // Vorschau: Werte/Reihe synthetisch
  _preview(cur) {
    const k = this._pv.cond, p = PV[k];
    if (p) {
      Object.assign(cur, { ok: true, cond: k, temp: p.t, hum: p.rh, wind: p.w, gust: p.g ?? Math.round(p.w * 1.6), bearing: 250, app: null });
    }
    if (this._pv.night != null) cur.night = this._pv.night;
    if (k === 'clear-night') cur.night = this._pv.night ?? true;
    if (!p) return null;
    const t0 = new Date(); t0.setMinutes(0, 0, 0);
    const ser = [];
    for (let i = 1; i <= 24; i++) {
      const mm = p.mm[i - 1] || 0;
      ser.push({ t: new Date(t0.getTime() + i * 3600e3), cond: mm >= .3 ? (k === 'snowy' ? 'snowy' : 'rainy') : k, temp: p.t + Math.sin(i / 4) * 2 - i * .15, hum: p.rh, wind: p.w, gust: p.g,
        pp: mm > 0 ? Math.min(98, Math.round(35 + mm * 25)) : (i % 5 === 0 ? 10 : 0), mm, day: null });
    }
    return ser;
  }

  _nightAt(t) {
    const sun = this._hass.states['sun.sun'];
    if (!sun) { const h = t.getHours(); return h < 7 || h >= 19; }
    const ns = new Date(sun.attributes.next_setting), nr = new Date(sun.attributes.next_rising);
    const iv = ns < nr ? [[ns, nr]] : [[new Date(0), nr], [ns, new Date(nr.getTime() + 864e5)]];
    return iv.some(([a, b]) => t >= a && t < b);
  }

  // ---------------------------------------------------------------- Hinweise
  _schirm(cur, ser, rad) {
    const S = this._c.schirm, n = Number(S.stunden) || 4, P = Number(S.prozent) || 40, MM = Number(S.mm) || 0.2;
    const win = ser.slice(0, n), end = win.length ? new Date(win[win.length - 1].t.getTime() + 3600e3) : null;
    if ((cur.cond && RAIN_RE.test(cur.cond)) || (rad.now != null && rad.now > 0))
      return { s: 'ja', t: 'Schirm mitnehmen', k: 'Schirm mit!', d: rad.now > 0 ? `es regnet gerade (${de1(rad.now)} mm/h)` : 'es regnet gerade' };
    if (rad.next && rad.next - Date.now() < n * 3600e3 && rad.next > Date.now() - 300e3)
      return { s: 'ja', t: 'Schirm mitnehmen', k: 'Schirm mit!', d: `Regen ab ${hm(rad.next)} Uhr (Radar)` };
    const hit = win.find(x => (x.pp != null && x.pp >= P) || (x.mm != null && x.mm >= MM) || (x.cond && RAIN_RE.test(x.cond)));
    if (hit) {
      const i = win.indexOf(hit), v = hit.pp != null ? `${Math.round(hit.pp)} %` : hit.mm ? `${de1(hit.mm)} mm` : '';
      const w = hit.cond === 'snowy' ? 'Schnee' : 'Regen';
      return { s: 'ja', t: 'Schirm mitnehmen', k: 'Schirm mit!', d: (i === 0 ? `${w} in der nächsten Stunde` : `${w} ab ${hh(hit.t)} Uhr`) + (v ? ' · ' + v : '') };
    }
    const maybe = win.find(x => (x.pp != null && x.pp >= P / 2) || (x.mm != null && x.mm > 0));
    if (maybe) return { s: 'evtl', t: 'Schirm vielleicht', k: 'Schirm?', d: `etwas Regen möglich um ${hh(maybe.t)} Uhr` };
    if (!win.length) return { s: 'nein', t: 'Kein Schirm nötig', k: 'Kein Schirm', d: 'keine Vorhersage' };
    return { s: 'nein', t: 'Kein Schirm nötig', k: 'Kein Schirm', d: `trocken bis ${hh(end)} Uhr` };
  }
  _jacke(cur, ser) {
    const J = this._c.jacke, n = Number(J.stunden) || 3;
    const vals = [cur.app ?? feels(cur.temp, cur.hum, cur.wind), ...ser.slice(0, n).map(x => feels(x.temp, x.hum, x.wind))].filter(v => v != null);
    if (!vals.length) return { s: 'nein', t: 'Jacke?', d: 'keine Daten' };
    const m = Math.min(...vals), d = `gefühlt bis ${r0(m)}°`;
    if (m < J.warm) return { s: 'warm', t: 'Warme Jacke', d: d + (m < 0 ? ' · Mütze!' : '') };
    if (m < J.normal) return { s: 'jacke', t: 'Jacke anziehen', k: 'Jacke', d };
    if (m < J.leicht) return { s: 'leicht', t: 'Leichte Jacke', d };
    return { s: 'nein', t: 'Keine Jacke nötig', k: 'Keine Jacke', d };
  }

  _radarVals() {
    const h = this._hass, out = { now: null, next: null };
    for (const e of this._radarSensors()) {
      const st = h.states[e]; if (!st) continue;
      if (e.endsWith('_aktuell') || e.endsWith('_5_minuten')) { const v = num(st.state); if (v != null) out.now = Math.max(out.now || 0, v); }
      if (e.endsWith('_nachster_niederschlag')) { const d = new Date(st.state); if (!isNaN(d)) out.next = d; }
    }
    if (this._pv.cond) { out.now = null; out.next = null; }
    return out;
  }

  // ---------------------------------------------------------------- Warnungen
  _warnings() {
    const c = this._c, h = this._hass;
    if (this._pv.warn) return [{ sev: 3, t: 'VORSCHAU: Amtliche UNWETTERWARNUNG vor ORKANBÖEN', d: 'Es treten Orkanböen bis 120 km/h auf.', ins: 'Bleiben Sie in Gebäuden.', from: new Date(), to: new Date(Date.now() + 6 * 3600e3), col: null }];
    let l = [];
    if (c.warnung === 'dwd' && this._warnWfs) {
      l = this._warnWfs.map(p => ({ sev: WARN_SEV[p.SEVERITY] || 1, t: p.HEADLINE || p.EVENT, d: p.DESCRIPTION, ins: p.INSTRUCTION, from: p.ONSET && new Date(p.ONSET), to: p.EXPIRES && new Date(p.EXPIRES),
        col: p.EC_AREA_COLOR ? `rgb(${p.EC_AREA_COLOR.split(' ').join(',')})` : null }));
    } else if (typeof c.warnung === 'string' && c.warnung.startsWith('sensor.') && h.states[c.warnung]) {
      const a = h.states[c.warnung].attributes, n = Number(a.warning_count) || 0;
      for (let i = 1; i <= n; i++) l.push({ sev: Number(a[`warning_${i}_level`]) || 1, t: a[`warning_${i}_headline`] || a[`warning_${i}_name`], d: a[`warning_${i}_description`], ins: a[`warning_${i}_instruction`],
        from: a[`warning_${i}_start`] && new Date(a[`warning_${i}_start`]), to: a[`warning_${i}_end`] && new Date(a[`warning_${i}_end`]), col: a[`warning_${i}_color`] || null });
    }
    const now = Date.now();
    return l.filter(w => w.sev >= c.warn_min && (!w.to || w.to.getTime() > now) && (!w.from || w.from.getTime() < now + 24 * 3600e3)).sort((a, b) => b.sev - a.sev || (a.from || 0) - (b.from || 0));
  }
  _when(w) {
    const f = d => { const td = new Date(); const same = d.toDateString() === td.toDateString(); const tm = new Date(td.getTime() + 864e5).toDateString() === d.toDateString();
      return (same ? '' : tm ? 'morgen ' : d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ') + hm(d); };
    if (w.from && w.from.getTime() > Date.now()) return `ab ${f(w.from)} Uhr` + (w.to ? ` bis ${f(w.to)}` : '');
    return w.to ? `bis ${f(w.to)} Uhr` : 'aktiv';
  }
  _warnDetail(on) {
    const el = this.$('wdet');
    if (!on) { el.classList.add('hide'); return; }
    const l = this._warnings(); if (!l.length) return;
    el.innerHTML = `<span class="x">✕</span>` + l.map(w => `<h3 style="color:${w.col || WARN_COL[w.sev]}">${esc(w.t)}</h3><div style="color:#8a8e96">${esc(this._when(w))}</div><p>${esc(w.d)}${w.ins ? '\n\n' + esc(w.ins) : ''}</p>`).join('');
    el.classList.remove('hide');
  }

  // ---------------------------------------------------------------- Darstellung
  _update() {
    if (!this._built || !this._hass) return;
    const c = this._c, $ = this.$;
    const cur = this._cur();
    const pser = this._pv.cond || this._pv.night != null ? this._preview(cur) : null;
    const ser = pser || this._series(cur);
    if (cur.app == null) cur.app = feels(cur.temp, cur.hum, cur.wind);
    if (cur.gust == null && ser[0] && ser[0].gust != null) cur.gust = ser[0].gust;
    // Symbol + Himmel (nur bei Änderung neu, damit Animationen ruhig weiterlaufen)
    const ik = cur.cond + '|' + cur.night;
    if (ik !== this._iconKey) { this._iconKey = ik; $('ic').innerHTML = cur.ok ? fwIcon(cur.cond, cur.night) : fwIcon('cloudy', false); this._sky(cur); }
    $('tv').textContent = cur.ok ? r0(cur.temp) : '--';
    const cn = cur.ok ? (cur.night && cur.cond === 'sunny' ? 'Klar' : cur.night && cur.cond === 'partlycloudy' ? 'Teils bewölkt' : FW_DE[cur.cond] || cur.cond) : 'Wetter nicht verfügbar';
    $('cond').textContent = cn;
    const parts = [];
    if (cur.app != null) parts.push(`gefühlt <b>${r0(cur.app)}°</b>`);
    if (cur.hum != null) parts.push(`<span>${Math.round(cur.hum)} % rF</span>`);
    $('row2').innerHTML = parts.join('');
    if (cur.wind != null) {
      const to = cur.bearing != null ? cur.bearing + 180 : 0, dir = cur.bearing != null ? DIRS[Math.round(cur.bearing / 45) % 8] : '';
      $('wind').innerHTML = `<svg viewBox="0 0 24 24" style="transform:rotate(${to}deg)"><circle cx="12" cy="12" r="10.5" fill="rgba(0,0,0,.3)" stroke="rgba(255,255,255,.12)"/><path d="M12,3.5 L17,15 L12,12.6 L7,15Z" fill="#9fc3ff"/></svg>
<span><span class="lg">Wind </span><b>${Math.round(cur.wind)}</b> km/h${dir ? '<span class="lg"> aus</span> ' + dir : ''}${cur.gust != null && cur.gust > cur.wind + 5 ? ` · Böen <b>${Math.round(cur.gust)}</b>` : ''}</span>`;
    } else $('wind').innerHTML = '';
    const u = pser || this._pv.night != null ? 'VORSCHAU' : cur.upd ? 'Stand ' + hm(cur.upd) : '';
    $('upd').textContent = u;
    // Hinweise
    const rad = this._radarVals();
    const sc = this._schirm(cur, ser, rad), jk = this._jacke(cur, ser);
    const led = { ja: '#5fb0ff', evtl: '#f5d742', nein: '#4caf50', warm: '#5fb0ff', jacke: '#7fa9de', leicht: '#9fc3ff' };
    $('h-schirm').className = 'hint' + (sc.s === 'ja' ? ' ja' : '');
    $('h-schirm').innerHTML = `${ICON_SCHIRM(sc.s)}<div style="min-width:0"><div class="t"><span class="lg">${sc.t}</span><span class="sh">${sc.k || sc.t}</span></div><div class="s">${esc(sc.d)}</div></div><span class="led" style="--lc:${led[sc.s]}"></span>`;
    $('h-jacke').className = 'hint' + (jk.s === 'warm' ? ' warm' : '');
    $('h-jacke').innerHTML = `${ICON_JACKE(jk.s)}<div style="min-width:0"><div class="t"><span class="lg">${jk.t}</span><span class="sh">${jk.k || jk.t}</span></div><div class="s">${esc(jk.d)}</div></div><span class="led" style="--lc:${led[jk.s] || '#4caf50'}"></span>`;
    // Verlauf
    this._chart(ser, pser ? null : this._fcErr);
    // Warnung
    const wl = this._warnings(), wb = $('warn');
    if (wl.length && !c.aus.has('warnung')) {
      const w = wl[0], col = w.col || WARN_COL[w.sev];
      wb.style.setProperty('--wc', col);
      wb.innerHTML = `<svg viewBox="0 0 30 30"><path d="M15,3 L28,26 H2Z" fill="${col}" stroke="#fff" stroke-opacity=".7" stroke-linejoin="round"/><rect x="13.6" y="11" width="2.8" height="8" rx="1.4" fill="#111"/><circle cx="15" cy="22.3" r="1.6" fill="#111"/></svg>
<div class="tx"><div class="t">${esc(w.t)}</div><div class="s">${esc(this._when(w))}${wl.length > 1 ? ` · +${wl.length - 1} weitere` : ''}</div></div>`;
      wb.classList.remove('hide');
    } else wb.classList.add('hide');
    // Vorschau-Leiste
    if (c.pv) {
      const b = (k, l, on) => `<button data-k="${k}" class="${on ? 'on' : ''}">${l}</button>`;
      $('pv').innerHTML = b('echt', 'Echt', !this._pv.cond && this._pv.night == null && !this._pv.warn) + b('tag', 'Tag', this._pv.night === false) + b('nacht', 'Nacht', this._pv.night === true)
        + b('warn', 'Warnung', this._pv.warn) + PV_ORDER.map(k => b(k, FW_KURZ[k], this._pv.cond === k)).join('');
    }
    this._fit();
  }

  _sky(cur) {
    const c = cur.cond || 'cloudy', n = cur.night || c === 'clear-night';
    const g = (a, b) => `linear-gradient(180deg,${a},${b})`;
    // Bausteine (laufen über die ganze Karte, hinter dem Inhalt)
    const stars = k => Array.from({ length: k }, (_, i) => `<i class="st" style="left:${(i * 47 + 3) % 100}%;top:${(i * 29 + 5) % 82}%;animation-delay:-${(i * .7) % 3.5}s;${i % 3 ? '' : 'width:3px;height:3px'}"></i>`).join('')
      + '<i class="ss" style="left:88%;top:10%"></i><i class="ss" style="left:70%;top:30%;animation-delay:-5.5s"></i><i class="mg"></i>';
    const sun = () => '<div class="sg"></div><div class="sr"></div>' + [[12, 8, 22], [34, 2, 14], [58, 14, 26], [76, 6, 18], [90, 20, 12], [46, 30, 20], [22, 40, 16]]
      .map(([l, bt, w], i) => `<i class="bk" style="left:${l}%;bottom:${bt}%;width:${w}px;height:${w}px;animation-delay:-${(i * 1.9).toFixed(1)}s"></i>`).join('');
    const clouds = (k, dark, sp = 1) => Array.from({ length: k }, (_, i) => {
      const w = 160 + (i * 67) % 140, d = (38 + (i * 23) % 30) / sp;
      return `<i class="cb${dark ? ' d' : ''}" style="--w:${w}px;--h:${Math.round(w * .32)}px;top:${(i * 37 + 4) % 78}%;left:${(i * 41) % 100 - 20}%;animation-duration:${d.toFixed(0)}s;animation-delay:-${(d * ((i * .37) % 1)).toFixed(1)}s"></i>`;
    }).join('');
    const rain = k => '<div class="rn"></div>' + (k > 1 ? '<div class="rn b"></div>' : '') + (k > 2 ? '<div class="rn h"></div>' : '');
    const snow = () => '<div class="sn"></div><div class="sn b"></div>';
    const hail = () => '<div class="hl"></div><div class="hl b"></div>';
    const fog = () => [18, 42, 66, 86].map((t, i) => `<div class="fg" style="top:${t}%;animation-delay:-${i * 2.3}s"></div>`).join('');
    const wind = () => `<svg class="wd" viewBox="0 0 100 100" preserveAspectRatio="none">${[12, 26, 41, 55, 70, 84].map((y, i) =>
      `<path pathLength="100" style="animation-delay:-${(i * .53).toFixed(2)}s;animation-duration:${(1.6 + (i % 3) * .4).toFixed(1)}s" d="M-10,${y} C25,${y - 5} 60,${y + 5} 110,${y - 2}"/>`).join('')}</svg>`
      + [20, 48, 72].map((t, i) => `<i class="lf" style="top:${t}%;animation-delay:-${(i * 1.6).toFixed(1)}s"></i>`).join('');
    const storm = () => '<div class="fl"></div><svg class="bb" style="left:64%;top:0;width:48px;height:72%" viewBox="0 0 48 200" preserveAspectRatio="none"><polyline points="30,0 20,52 32,60 14,116 27,124 8,200" fill="none" stroke="#f6f3ff" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
    let bg, fx;
    if (c === 'exceptional') { bg = n ? g('#2a1416', '#100809') : g('#4a2a2c', '#1f1213'); fx = '<div class="vg"></div>' + clouds(3, true, 2) + wind() + rain(2); }
    else if (/lightning/.test(c)) { bg = n ? g('#1f1a2e', '#0e0c14') : g('#3b3550', '#1a1724'); fx = clouds(4, true) + storm() + (c === 'lightning-rainy' ? rain(2) : ''); }
    else if (c === 'hail') { bg = n ? g('#16202c', '#0b0f15') : g('#3a4b5e', '#18202a'); fx = clouds(3, true) + hail(); }
    else if (c === 'pouring') { bg = n ? g('#121a24', '#080b10') : g('#2c3b4c', '#141b24'); fx = clouds(4, true) + rain(3); }
    else if (c === 'rainy') { bg = n ? g('#16202c', '#0b0f15') : g('#34465a', '#18202a'); fx = clouds(3, true) + rain(1); }
    else if (c === 'snowy-rainy') { bg = n ? g('#1a2330', '#0b0f15') : g('#46566a', '#202832'); fx = clouds(3, false) + snow() + rain(1); }
    else if (c === 'snowy') { bg = n ? g('#1c2533', '#0c1016') : g('#4a5a6e', '#222a35'); fx = clouds(2, false) + snow(); }
    else if (c === 'fog') { bg = n ? g('#23262b', '#111315') : g('#4a4f57', '#24272c'); fx = clouds(2, false, .6) + fog(); }
    else if (c === 'windy-variant') { bg = n ? g('#1b1f27', '#0d0f13') : g('#3d4652', '#1d2128'); fx = clouds(4, false, 2.6) + wind(); }
    else if (c === 'windy') { bg = n ? g('#16202e', '#0b0f16') : g('#2f4a66', '#17222e'); fx = (n ? stars(14) : '') + wind(); }
    else if (c === 'cloudy') { bg = n ? g('#1b1f27', '#0d0f13') : g('#3d4652', '#1d2128'); fx = clouds(5, false); }
    else if (c === 'partlycloudy') { bg = n ? g('#121c3a', '#080b18') : g('#2f557f', '#162538'); fx = (n ? stars(16) : sun()) + clouds(3, false); }
    else { bg = n ? g('#101a3a', '#070a17') : g('#2c6aa6', '#14304d'); fx = n ? stars(24) : sun(); }
    this.$('sky').style.background = bg;
    this.$('fx').innerHTML = fx;
  }

  _chart(ser, err) {
    this._chartArgs = [ser, err];
    const k = this._lay === 'kompakt', svg = this.$('ch'), N = this._c.stunden, s = ser.slice(0, N), W = (this._dw || DW) - (k ? 44 : 56), H = this._chH || (k ? 74 : 96);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (!s.length) { svg.innerHTML = `<text x="${W / 2}" y="52" text-anchor="middle" fill="#6c7079" font-size="14">${err ? 'Vorhersage nicht verfügbar' : 'Vorhersage wird geladen …'}</text>`; this.$('ch-i').textContent = ''; return; }
    const hasPP = s.some(x => x.pp != null);
    const bw = W / N, base = H - 24, bh = Math.max(k ? 24 : 34, (H - 24) * .5);
    const val = x => hasPP ? (x.pp || 0) / 100 : Math.min(1, Math.sqrt((x.mm || 0) / 4));
    let out = '';
    // Nacht-Hintergrund
    s.forEach((x, i) => { const nt = x.day != null ? !x.day : this._nightAt(new Date(x.t.getTime() + 1800e3)); if (nt) out += `<rect x="${i * bw}" y="0" width="${bw + .5}" height="${base + 2}" fill="#000" opacity=".22"/>`; });
    out += `<line x1="0" x2="${W}" y1="${base + .5}" y2="${base + .5}" stroke="rgba(255,255,255,.1)"/>`;
    // Balken
    s.forEach((x, i) => {
      const v = val(x), cx = i * bw + bw / 2, w = Math.min(18, bw * .56);
      if (v > 0.001) {
        const hgt = Math.max(2, v * bh);
        out += `<rect x="${cx - w / 2}" y="${base - hgt}" width="${w}" height="${hgt}" rx="2.5" fill="url(#fw-bar)"/>`;
        const lbl = hasPP ? Math.round(x.pp) + '%' : de1(x.mm);
        out += `<text x="${cx}" y="${base - hgt - 3}" text-anchor="middle" font-size="10.5" fill="#bfe0ff">${lbl}</text>`;
      } else out += `<rect x="${cx - w / 2}" y="${base - 1.5}" width="${w}" height="1.5" rx=".75" fill="rgba(159,195,255,.25)"/>`;
      if (i % 3 === 0) out += `<text x="${cx}" y="${H - 2}" text-anchor="middle" font-size="12" fill="#8a8e96">${i === 0 && x.t - Date.now() < 3600e3 ? 'jetzt' : hh(x.t)}</text>`;
    });
    // Temperaturlinie
    const ts = s.map(x => x.temp).filter(v => v != null);
    if (ts.length > 1) {
      const mn = Math.min(...ts), mx = Math.max(...ts), rg = Math.max(3, mx - mn), y = v => 10 + (1 - (v - mn) / rg) * Math.max(k ? 14 : 22, (H - 24) * .3);
      const pts = s.map((x, i) => x.temp == null ? null : [i * bw + bw / 2, y(x.temp)]).filter(Boolean);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      out += `<path d="${d}" fill="none" stroke="#ffb347" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`;
      const iMx = s.findIndex(x => x.temp === mx), iMn = s.findIndex(x => x.temp === mn);
      [[iMx, mx, -5], [iMn, mn, 13]].forEach(([i, v, dy], k) => { if (k && iMn === iMx) return; const px = Math.min(W - 12, Math.max(12, i * bw + bw / 2)); out += `<circle cx="${i * bw + bw / 2}" cy="${y(v)}" r="2.6" fill="#ffb347"/><text x="${px}" y="${y(v) + dy}" text-anchor="middle" font-size="11.5" fill="#ffd29a">${r0(v)}°</text>`; });
    }
    svg.innerHTML = `<defs><linearGradient id="fw-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc4ff"/><stop offset="1" stop-color="#2f6fd6"/></linearGradient></defs>` + out;
    const sum = s.slice(0, this._c.stunden).reduce((a, x) => a + (x.mm || 0), 0);
    this.$('ch-t').textContent = (hasPP ? 'Regenwahrscheinlichkeit' : 'Niederschlag') + ` · ${N} h`;
    this.$('ch-i').textContent = hasPP ? '' : sum > 0 ? `Σ ${de1(sum)} mm` : 'trocken';
  }

  // ---------------------------------------------------------------- Regenradar
  _radarOpen() {
    const el = this.$('radar'); if (!el) return;
    el.classList.remove('hide');
    this._radarStart();
    clearTimeout(this._radarTo);
    this._radarTo = setTimeout(() => this._radarClose(), 60e3);
  }
  _radarClose() { const el = this.$('radar'); if (el && el.classList.contains('ov')) { el.classList.add('hide'); this._radarStop(); } }
  _radarStop() { clearInterval(this._radarIv); this._radarIv = null; clearTimeout(this._radarTo); }

  async _radarStart() {
    const c = this._c, el = this.$('radar'), h = this._hass;
    if (!el || !h || !h.config || this._radarBusy) return;
    this._radarBusy = true;
    try { await this._radarBuild(el, c, h); } finally { this._radarBusy = false; }
  }
  async _radarBuild(el, c, h) {
    const R = c.radar, lat = R.lat ?? h.config.latitude, lon = R.lon ?? h.config.longitude;
    const ovl = el.classList.contains('ov'), W = ovl ? this._dw : this._dw - (c.bg === 'keiner' ? 4 : this._lay === 'kompakt' ? 28 : 36), Hh = ovl ? Math.max(250, this.$('st').offsetHeight) : 250;
    const z = Number(R.zoom) || 8, zi = Math.floor(z), T = 256 * Math.pow(2, z - zi);
    const wx = (lon + 180) / 360 * Math.pow(2, zi) * T;
    const sl = Math.sin(lat * Math.PI / 180), wy = (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * Math.pow(2, zi) * T;
    const ox = wx - W / 2, oy = wy - Hh / 2;
    const tiles = (url, at = '') => { let s = ''; for (let tx = Math.floor(ox / T); tx <= Math.floor((ox + W) / T); tx++) for (let ty = Math.floor(oy / T); ty <= Math.floor((oy + Hh) / T); ty++)
      s += `<img src="${url(zi, tx, ty)}" style="left:${(tx * T - ox).toFixed(1)}px;top:${(ty * T - oy).toFixed(1)}px;width:${T}px;height:${T}px" loading="eager" alt=""${at}>`; return s; };
    // Grundkarte: esri (Dark Gray Canvas, Ortsnamen als eigene Ebene über dem Radar) | osm (abgedunkelt) | eigene URL mit {z}/{x}/{y}
    // HA sendet Referrer-Policy: no-referrer → OSM sperrt Kacheln ohne Referer („Access blocked“); deshalb referrerpolicy am Bild
    const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_';
    const km = R.karte || 'esri', kt = km === 'esri' ? ESRI + 'Base/MapServer/tile/{z}/{y}/{x}' : km === 'osm' ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' : km;
    const tpl = t => (z0, x, y) => t.replace('{z}', z0).replace('{x}', x).replace('{y}', y);
    const base = tpl(kt), kAttr = km === 'esri' ? '© Esri' : km === 'osm' ? '© OpenStreetMap' : (R.karte_quelle || '');
    const baseHtml = tiles(base, ' referrerpolicy="strict-origin-when-cross-origin"'), labels = km === 'esri' ? tiles(tpl(ESRI + 'Reference/MapServer/tile/{z}/{y}/{x}')) : '';
    let frames = [], src = '';
    try {
      if (R.quelle === 'rainviewer') {
        const j = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
        frames = [...(j.radar.past || []), ...(j.radar.nowcast || [])].map(f => ({ t: new Date(f.time * 1000), html: tiles((z0, x, y) => `${j.host}${f.path}/256/${z0}/${x}/${y}/2/1_1.png`) }));
        src = 'RainViewer';
      } else {
        // DWD-WMS: ein Bild je Zeitschritt, Ausschnitt in Web-Mercator passend zur Grundkarte
        const res = 2 * Math.PI * 6378137 / (Math.pow(2, zi) * T), O = Math.PI * 6378137;
        const bbox = [ox * res - O, O - (oy + Hh) * res, (ox + W) * res - O, O - oy * res].map(v => v.toFixed(1)).join(',');
        const step = 10 * 60e3, t0 = Math.floor((Date.now() - 10 * 60e3) / step) * step;
        for (let t = t0 - (R.vor || 60) * 60e3; t <= t0 + (R.nach || 90) * 60e3; t += step) {
          const iso = new Date(t).toISOString().replace('.000Z', 'Z');
          frames.push({ t: new Date(t), fc: t > t0, html: `<img src="https://maps.dwd.de/geoserver/dwd/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=dwd:${R.ebene || 'Niederschlagsradar'}&STYLES=&SRS=EPSG:3857&BBOX=${bbox}&WIDTH=${Math.round(W)}&HEIGHT=${Math.round(Hh)}&FORMAT=image/png&TRANSPARENT=true&TIME=${iso}" style="left:0;top:0;width:${W}px;height:${Hh}px" alt="">` });
        }
        src = '© DWD';
      }
    } catch (e) { el.innerHTML = `<div class="msg">Radar nicht erreichbar</div>`; return; }
    const ov = el.classList.contains('ov');
    el.innerHTML = `<div class="map base ${km === 'osm' ? 'dunkel' : ''}">${baseHtml}</div>${frames.map((f, i) => `<div class="lay fr" data-i="${i}">${f.html}</div>`).join('')}${labels ? `<div class="map lab">${labels}</div>` : ''}<div class="me"></div>
<div class="src">${src}${kAttr ? ' · ' + kAttr : ''}</div>${ov ? '<span class="x">✕</span>' : ''}<div class="bar"><span>Radar</span><div class="tl"><b></b>${frames.findIndex(f => f.fc) > 0 ? `<s style="left:${frames.findIndex(f => f.fc) / (frames.length - 1) * 100}%"></s>` : ''}</div><span class="ti"></span></div>`;
    if (ov) el.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); this._radarClose(); });
    // fehlende Zeitschritte (Bild-Fehler) überspringen
    const lays = [...el.querySelectorAll('.fr')], bad = new Set();
    lays.forEach((l, i) => l.querySelectorAll('img').forEach(im => im.addEventListener('error', () => { if (R.quelle !== 'rainviewer') bad.add(i); })));
    let i = 0, hold = 0;
    clearInterval(this._radarIv);
    this._radarIv = setInterval(() => {
      if (hold > 0) { hold--; return; }
      let k = 0; do { i = (i + 1) % frames.length; k++; } while (bad.has(i) && k < frames.length);
      lays.forEach((l, j) => l.classList.toggle('on', j === i));
      const f = frames[i], ti = el.querySelector('.ti');
      ti.textContent = (f.fc ? 'Vorhers. ' : '') + hm(f.t) + ' Uhr'; ti.classList.toggle('fc', !!f.fc);
      el.querySelector('.tl b').style.width = (i / Math.max(1, frames.length - 1) * 100) + '%';
      if (i === frames.length - 1) hold = 4;
    }, 450);
    this._radarAt = Date.now();
  }
}

customElements.define('flur-wetter-card', FlurWetterCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'flur-wetter-card', name: 'Flur Wetter (animiert)', description: 'Animiertes Wetter mit Schirm-/Jacken-Hinweis, Regenverlauf, Radar und DWD-Warnung', preview: true });
console.info(`%c FLUR-WETTER-CARD %c ${FW_VERSION} `, 'background:#2f6fd6;color:#fff;font-weight:700', 'background:#222;color:#9fc3ff');
