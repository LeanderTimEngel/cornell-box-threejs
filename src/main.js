import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCornellBox, LIGHT_COLORS } from './scene.js';
import { createPhongMode } from './modes/phongMode.js';
import { createRaytraceMode } from './modes/raytraceMode.js';
import { createRadiosityMode } from './modes/radiosityMode.js';
import { createCompare } from './utils/compare.js';
import { createGUI } from './controls/gui.js';

// ---------------------------------------------------------------------------
// main.js — Einstiegspunkt: Setup, Modus-Verwaltung, Render-Loop.
//
// Drei Render-Modi teilen sich Renderer, Kamera und OrbitControls:
//   1. Phong      — three.js-Rasterisierung (modes/phongMode.js)
//   2. Raytracing — GLSL-Fragment-Shader      (modes/raytraceMode.js)
//   3. Radiosity  — GLSL-Path-Tracer + Akkumulation (modes/radiosityMode.js)
// ---------------------------------------------------------------------------

const container = document.getElementById('app');
const annotationEl = document.getElementById('annotation');

// --- Renderer --------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // harte Schatten via ShadowMap (Vereinfachung)
renderer.shadowMap.type = THREE.PCFShadowMap;
// Die Szene ist statisch -> Shadow-Map nur einmal backen (spart Leistung und
// vermeidet Scissor-Probleme im Split-Screen).
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
container.appendChild(renderer.domElement);

// --- Szene & Kamera --------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
camera.position.set(0, 0, 4); // blickt durch die offene Vorderwand (+Z) hinein

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 8;
controls.update();

// --- Cornell Box (three.js-Objekte für den Phong-Modus) --------------------
const cornell = buildCornellBox();
scene.add(cornell.root);
// WICHTIG: kein AmbientLight -> kein ambienter Term (Klausurvorgabe).

// --- Parameter (zentraler Zustand) -----------------------------------------
const params = {
  modus: 'Phong',
  compare: false,
  compareRight: 'Radiosity',
  lightColor: 'weiss',
  shininess: 80,
  maxBounces: 3, // Reflexionstiefe N (Klausurvorgabe: 3)
  shading: 'Phong',
  showNormals: false,
};

// --- Modi instanzieren -----------------------------------------------------
const phong = createPhongMode(renderer, scene, camera, cornell, params);
const raytrace = createRaytraceMode(renderer, camera, params);
const radiosity = createRadiosityMode(renderer, camera, params);
const modes = { Phong: phong, Raytracing: raytrace, Radiosity: radiosity };

const compare = createCompare(renderer);

// --- Hilfsfunktionen -------------------------------------------------------
function isRadiosityVisible() {
  if (params.modus === 'Radiosity') return true;
  if (params.compare && params.compareRight === 'Radiosity') return true;
  return false;
}

// Lichtfarbe auf alle Repräsentationen anwenden (three.js + Shader-Modi teilen
// sich params; die Shader lesen die Farbe in ihrem syncParams()).
function applyLightColor(key) {
  const c = LIGHT_COLORS[key];
  cornell.light.color.copy(c);
  cornell.lightPanel.material.color.copy(c);
  radiosity.reset(); // Beleuchtung geändert -> GI neu akkumulieren
}

const ANNOTATIONS = {
  Phong:
    '<b>Phong (lokales Beleuchtungsmodell)</b><br>Jede Fläche wird unabhängig direkt beleuchtet — ' +
    'kein ambienter Term, <b>kein Color Bleeding</b>. Harte Schatten (ShadowMap). ' +
    'Die Spiegelung der farbigen Wände auf der Kugel fehlt hier.',
  Raytracing:
    '<b>Raytracing</b><br>Primär-, Schatten- und Reflexionsstrahlen im Shader. ' +
    'Die Kugel <b>spiegelt</b> die farbigen Wände, harte Schatten durch Schattenstrahlen. ' +
    'Abbruch nach N Reflexionen. Diffuse Flächen tauschen <b>kein</b> Licht aus → kein Color Bleeding.',
  Radiosity:
    '<b>Global Illumination (Path Tracing)</b><br>Indirekte diffuse Beleuchtung. ' +
    'Beachte das <b>Color Bleeding</b>: die grüne/rote Wand färbt Boden, Decke und Säule ein. ' +
    'Weiche Schatten. Bild wird progressiv akkumuliert (kurz ruhig halten).',
};

function updateAnnotation() {
  if (params.compare) {
    annotationEl.innerHTML =
      '<b>Vergleich:</b> links = ' +
      params.modus +
      ', rechts = ' +
      params.compareRight +
      '<br>Trenner mittig ziehen. ' +
      'Achte auf das Color Bleeding, das nur im Radiosity-Modus auftritt.';
  } else {
    annotationEl.innerHTML = ANNOTATIONS[params.modus];
  }
}

// --- GUI-API (von controls/gui.js aufgerufen) ------------------------------
const api = {
  setMode(v) {
    params.modus = v;
    if (v === 'Radiosity') radiosity.reset();
    updateAnnotation();
  },
  setCompare(v) {
    compare.setVisible(v);
    if (v) radiosity.reset();
    updateAnnotation();
  },
  setCompareRight(v) {
    if (v === 'Radiosity') radiosity.reset();
    updateAnnotation();
  },
  setLightColor(v) {
    applyLightColor(v);
  },
  setShininess(v) {
    phong.setShininess(v); // raytrace liest params.shininess direkt
    radiosity.reset();
  },
  setMaxBounces() {
    radiosity.reset(); // (wirkt v. a. im Raytracing; GI sicherheitshalber neu)
  },
  setShading(v) {
    phong.applyShading(v);
  },
  setNormals(v) {
    phong.setNormalsVisible(v);
  },
};

createGUI(params, api);
applyLightColor(params.lightColor);
updateAnnotation();

// --- Resize ----------------------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  radiosity.setSize(w, h);
  renderer.shadowMap.needsUpdate = true; // Shadow-Map neu backen
}
window.addEventListener('resize', onResize);
radiosity.setSize(window.innerWidth, window.innerHeight);

// --- Render-Loop -----------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  // controls.update() liefert true, wenn sich die Kamera bewegt hat
  // (auch durch Damping-Nachlauf) -> GI-Akkumulation zurücksetzen.
  const moved = controls.update();
  if (moved) radiosity.reset();

  const w = window.innerWidth;
  const h = window.innerHeight;

  // GI-Akkumulation IMMER offscreen vor dem Scissor-Block ausführen.
  if (isRadiosityVisible()) radiosity.accumulate();

  if (params.compare) {
    compare.renderSplit(
      w,
      h,
      () => modes[params.modus].render(),
      () => modes[params.compareRight].render()
    );
  } else {
    modes[params.modus].render();
  }
}
animate();
