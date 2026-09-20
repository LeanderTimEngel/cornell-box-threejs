// ---------------------------------------------------------------------------
// overlay.js — die HTML-Einblendungen über dem Canvas.
//
// Zwei Elemente:
//   1. Die Info-Karte oben links, die den aktuellen Modus erklärt (mit einer
//      eigenen Akzentfarbe pro Verfahren).
//   2. Der GI-Konvergenz-Indikator unten, der im Radiosity-Modus zeigt, wie
//      viele Samples bereits akkumuliert wurden.
//
// Das Modul kennt nur den DOM und die Parameter — keine Render-Logik.
// ---------------------------------------------------------------------------

const annotationEl = document.getElementById('annotation');
const giStatusEl = document.getElementById('gi-status');
const giFillEl = giStatusEl.querySelector('.gi-fill');
const giCountEl = giStatusEl.querySelector('.gi-count');

// Ab dieser Sample-Zahl gilt das GI-Bild als praktisch konvergiert (Balken voll).
const GI_CONVERGED = 800;

// Pro Modus: Akzentfarbe (Punkt + linker Kartenrand), Titel und Erklärtext.
const ANNOTATIONS = {
  Phong: {
    accent: '#5db4ff',
    title: 'Phong',
    body:
      'Lokales Beleuchtungsmodell — jede Fläche wird unabhängig direkt beleuchtet. ' +
      'Kein ambienter Term, <b>kein Color Bleeding</b>, harte Schatten (ShadowMap). ' +
      'Die Spiegelung der farbigen Wände auf der Kugel fehlt hier.',
  },
  Raytracing: {
    accent: '#22d3c5',
    title: 'Raytracing',
    body:
      'Primär-, Schatten- und Reflexionsstrahlen im Shader. Die Kugel <b>spiegelt</b> ' +
      'die farbigen Wände, harte Schatten durch Schattenstrahlen, Abbruch nach N Reflexionen. ' +
      'Diffuse Flächen tauschen <b>kein</b> Licht aus → kein Color Bleeding.',
  },
  Radiosity: {
    accent: '#ffd166',
    title: 'Global Illumination',
    body:
      'Path Tracing mit indirekter diffuser Beleuchtung. Beachte das <b>Color Bleeding</b>: ' +
      'die grüne/rote Wand färbt Boden, Decke und Säule ein. Weiche Schatten. ' +
      'Das Bild wird progressiv akkumuliert — kurz ruhig halten.',
  },
};

// Baut die Info-Karte: Akzentfarbe setzen und Kopfzeile + Text einsetzen.
function renderCard(accent, kicker, title, body) {
  annotationEl.style.setProperty('--accent', accent);
  annotationEl.innerHTML = `
    <div class="ann-head">
      <span class="ann-dot"></span>
      <div>
        <div class="ann-kicker">${kicker}</div>
        <div class="ann-title">${title}</div>
      </div>
    </div>
    <p class="ann-body">${body}</p>`;
}

/**
 * Aktualisiert die Info-Karte passend zum aktuellen Zustand.
 * Wird nur bei Bedienvorgängen aufgerufen, nicht pro Frame.
 */
export function showMode(params) {
  if (params.compare) {
    renderCard(
      '#a78bfa',
      'Vergleichsansicht',
      `${params.modus} ↔ ${params.compareRight}`,
      `Links <b>${params.modus}</b>, rechts <b>${params.compareRight}</b>. ` +
        'Trenner in der Mitte ziehen. Achte auf das Color Bleeding, ' +
        'das nur im Radiosity-Modus auftritt.'
    );
  } else {
    const a = ANNOTATIONS[params.modus];
    renderCard(a.accent, 'Render-Modus', a.title, a.body);
  }
}

// Letzter angezeigter Zustand — damit pro Frame nur dann ins DOM geschrieben
// wird, wenn sich wirklich etwas geändert hat.
let lastVisible = null;
let lastSamples = -1;

/**
 * Aktualisiert den GI-Indikator. Wird pro Frame aufgerufen, schreibt aber nur
 * bei tatsächlicher Änderung in den DOM.
 */
export function updateGiStatus(visible, samples) {
  if (visible !== lastVisible) {
    giStatusEl.style.display = visible ? 'flex' : 'none';
    lastVisible = visible;
  }
  if (!visible || samples === lastSamples) return;
  lastSamples = samples;
  giCountEl.textContent = samples;
  giFillEl.style.width = Math.min(100, (samples / GI_CONVERGED) * 100) + '%';
}
