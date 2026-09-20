import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCornellBox, LIGHT_COLORS } from './scene.js';
import { createPhongMode } from './modes/phongMode.js';
import { createRaytraceMode } from './modes/raytraceMode.js';
import { createRadiosityMode } from './modes/radiosityMode.js';
import { createCompare } from './utils/compare.js';
import { createGUI } from './controls/gui.js';
import { showMode, updateGiStatus } from './controls/overlay.js';

// ---------------------------------------------------------------------------
// main.js — Einstiegspunkt: Setup, Modus-Verwaltung, Render-Loop.
//
// Drei Render-Modi teilen sich Renderer, Kamera und OrbitControls:
//   1. Phong      — three.js-Rasterisierung (modes/phongMode.js)
//   2. Raytracing — GLSL-Fragment-Shader      (modes/raytraceMode.js)
//   3. Radiosity  — GLSL-Path-Tracer + Akkumulation (modes/radiosityMode.js)
// ---------------------------------------------------------------------------

const container = document.getElementById('app');

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
scene.background = new THREE.Color(0x0e0f13);

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
// Ist der Radiosity-Modus gerade sichtbar (direkt oder als rechte Vergleichshälfte)?
function isRadiosityVisible() {
  return (
    params.modus === 'Radiosity' ||
    (params.compare && params.compareRight === 'Radiosity')
  );
}

// Lichtfarbe auf alle Repräsentationen anwenden (three.js + Shader-Modi teilen
// sich params; die Shader lesen die Farbe in ihrem syncParams()).
function applyLightColor(key) {
  const c = LIGHT_COLORS[key];
  cornell.light.color.copy(c);
  cornell.lightPanel.material.color.copy(c);
  radiosity.reset(); // Beleuchtung geändert -> GI neu akkumulieren
}

// --- GUI-API (von controls/gui.js aufgerufen) ------------------------------
// Jeder Setter schreibt den neuen Wert nach `params` (die Render-Modi lesen
// von dort) und löst die nötigen Seiteneffekte aus.
const api = {
  setMode(v) {
    params.modus = v;
    if (v === 'Radiosity') radiosity.reset();
    showMode(params);
  },
  setCompare(v) {
    params.compare = v;
    compare.setVisible(v);
    if (v) radiosity.reset();
    showMode(params);
  },
  setCompareRight(v) {
    params.compareRight = v;
    if (v === 'Radiosity') radiosity.reset();
    showMode(params);
  },
  setLightColor(v) {
    params.lightColor = v; // die Shader-Modi lesen die Lichtfarbe aus params
    applyLightColor(v);
  },
  setShininess(v) {
    params.shininess = v; // raytrace liest params.shininess direkt
    phong.setShininess(v);
    radiosity.reset();
  },
  setMaxBounces(v) {
    params.maxBounces = v; // raytrace liest params.maxBounces direkt
    radiosity.reset();
  },
  setShading(v) {
    params.shading = v;
    phong.applyShading(v);
  },
  setNormals(v) {
    params.showNormals = v;
    phong.setNormalsVisible(v);
  },
};

createGUI(params, api);
applyLightColor(params.lightColor);
showMode(params);

// --- Fenstergröße ----------------------------------------------------------
// Die aktuellen Maße werden gecacht, damit die Render-Loop sie nicht bei jedem
// Frame neu vom Browser erfragen muss.
let viewW = window.innerWidth;
let viewH = window.innerHeight;

function onResize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  camera.aspect = viewW / viewH;
  camera.updateProjectionMatrix();
  renderer.setSize(viewW, viewH);
  radiosity.setSize(viewW, viewH);
  renderer.shadowMap.needsUpdate = true; // Shadow-Map neu backen
}
window.addEventListener('resize', onResize);
radiosity.setSize(viewW, viewH);

// --- Render-Loop -----------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  // controls.update() liefert true, wenn sich die Kamera bewegt hat
  // (auch durch Damping-Nachlauf) -> GI-Akkumulation zurücksetzen.
  if (controls.update()) radiosity.reset();

  // GI-Akkumulation IMMER offscreen vor dem Scissor-Block ausführen,
  // sonst würde der Split-Screen nur eine Hälfte akkumulieren.
  const giVisible = isRadiosityVisible();
  if (giVisible) radiosity.accumulate();
  updateGiStatus(giVisible, radiosity.getFrame());

  if (params.compare) {
    compare.renderSplit(
      viewW,
      viewH,
      () => modes[params.modus].render(),
      () => modes[params.compareRight].render()
    );
  } else {
    modes[params.modus].render();
  }
}
animate();
