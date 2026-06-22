import GUI from 'lil-gui';

// ---------------------------------------------------------------------------
// gui.js — lil-gui-Panel mit allen Parametern.
//
// Das Panel ruft nur die Callbacks aus `api` auf; die eigentliche Logik
// (Modus-Wechsel, GI-Reset etc.) liegt in main.js. So bleibt die GUI von der
// Render-Logik entkoppelt.
// ---------------------------------------------------------------------------

const MODES = ['Phong', 'Raytracing', 'Radiosity'];

export function createGUI(params, api) {
  const gui = new GUI({ title: 'Cornell Box — Rendering-Vergleich' });

  // --- Modus & Vergleich ---------------------------------------------------
  const fMode = gui.addFolder('Modus');
  fMode
    .add(params, 'modus', MODES)
    .name('Render-Modus')
    .onChange((v) => api.setMode(v));
  fMode
    .add(params, 'compare')
    .name('Vergleich (Split)')
    .onChange((v) => api.setCompare(v));
  fMode
    .add(params, 'compareRight', MODES)
    .name('… rechte Hälfte')
    .onChange((v) => api.setCompareRight(v));

  // --- Beleuchtung ---------------------------------------------------------
  const fLight = gui.addFolder('Beleuchtung');
  fLight
    .add(params, 'lightColor', ['weiss', 'gelb', 'tuerkis'])
    .name('Lichtfarbe')
    .onChange((v) => api.setLightColor(v));
  fLight
    .add(params, 'shininess', 1, 256, 1)
    .name('Shininess (Kugel)')
    .onChange((v) => api.setShininess(v));

  // --- Raytracing ----------------------------------------------------------
  const fRT = gui.addFolder('Raytracing');
  fRT
    .add(params, 'maxBounces', 0, 8, 1)
    .name('Reflexionstiefe N')
    .onChange((v) => api.setMaxBounces(v));

  // --- Phong-Demonstration -------------------------------------------------
  const fPhong = gui.addFolder('Phong-Demonstration');
  fPhong
    .add(params, 'shading', ['Flat', 'Gouraud', 'Phong'])
    .name('Shading')
    .onChange((v) => api.setShading(v));
  fPhong
    .add(params, 'showNormals')
    .name('Normalen anzeigen')
    .onChange((v) => api.setNormals(v));

  return gui;
}
