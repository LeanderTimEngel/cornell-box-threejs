// ---------------------------------------------------------------------------
// gui.js — Verdrahtung des Bedien-Panels.
//
// Das Panel selbst ist statisches HTML in index.html (#panel) und mit reinem
// CSS gestaltet — es kommt KEINE UI-Bibliothek zum Einsatz, nur die Standard-
// Formularelemente <select>, <input type="range"> und <input type="checkbox">.
//
// Hier werden die Steuerelemente nur mit den Callbacks aus `api` (definiert in
// main.js) verbunden. Die eigentliche Render-Logik bleibt in main.js — so ist
// die Bedienoberfläche sauber von der Darstellung getrennt.
// ---------------------------------------------------------------------------

const byId = (id) => document.getElementById(id);

// <select>: Anfangswert setzen und bei Auswahl den Callback mit dem neuen
// String-Wert aufrufen.
function bindSelect(id, initial, onChange) {
  const el = byId(id);
  el.value = initial;
  el.addEventListener('change', () => onChange(el.value));
}

// Umschalter (Checkbox): Anfangszustand setzen, Callback mit true/false.
function bindToggle(id, initial, onChange) {
  const el = byId(id);
  el.checked = initial;
  el.addEventListener('change', () => onChange(el.checked));
}

// Schieberegler: Anfangswert in Regler UND Zahlanzeige schreiben, bei jeder
// Bewegung die Anzeige aktualisieren und den Callback mit der Zahl aufrufen.
function bindSlider(id, outId, initial, onChange) {
  const el = byId(id);
  const out = byId(outId);
  el.value = initial;
  out.textContent = initial;
  el.addEventListener('input', () => {
    const value = Number(el.value);
    out.textContent = value;
    onChange(value);
  });
}

export function createGUI(params, api) {
  // Modus & Vergleich
  bindSelect('c-mode', params.modus, api.setMode);
  bindToggle('c-compare', params.compare, api.setCompare);
  bindSelect('c-compare-right', params.compareRight, api.setCompareRight);

  // Beleuchtung
  bindSelect('c-light', params.lightColor, api.setLightColor);
  bindSlider('c-shininess', 'o-shininess', params.shininess, api.setShininess);

  // Raytracing
  bindSlider('c-bounces', 'o-bounces', params.maxBounces, api.setMaxBounces);

  // Phong-Demonstration
  bindSelect('c-shading', params.shading, api.setShading);
  bindToggle('c-normals', params.showNormals, api.setNormals);
}
