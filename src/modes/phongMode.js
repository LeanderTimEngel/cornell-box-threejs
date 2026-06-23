import * as THREE from 'three';
import { createNormalsHelpers } from '../utils/normalsHelper.js';

// ---------------------------------------------------------------------------
// phongMode.js — Modus 1: lokales Phong-Beleuchtungsmodell über die normale
// three.js-Rasterisierung (MeshPhongMaterial, kein ambienter Term).
//
// Zusätzlich gekapselt:
//   - Shading-Umschaltung Flat / Gouraud / Phong (Demonstration der
//     Normalen-Interpolation).
//   - Normalen-Anzeige (gelbe Pfeile).
// ---------------------------------------------------------------------------

// Basis-Materialdaten beim ersten Mal sichern, damit wir zwischen den
// Shading-Modi hin- und herwechseln können, ohne Farben zu verlieren.
function captureBase(mesh) {
  if (mesh.userData.base) return mesh.userData.base;
  const m = mesh.material;
  mesh.userData.base = {
    color: m.color.clone(),
    specular: m.specular ? m.specular.clone() : new THREE.Color(0, 0, 0),
    shininess: m.shininess !== undefined ? m.shininess : 0,
    side: m.side,
  };
  return mesh.userData.base;
}

function makeMaterial(base, mode, shininess) {
  if (mode === 'Gouraud') {
    // MeshLambertMaterial beleuchtet PRO VERTEX (Gouraud-Shading) und
    // interpoliert die Farbe über die Fläche — nur diffus, kein Glanzlicht.
    return new THREE.MeshLambertMaterial({ color: base.color, side: base.side });
  }
  // MeshPhongMaterial beleuchtet PRO FRAGMENT (Phong-Shading).
  const m = new THREE.MeshPhongMaterial({
    color: base.color,
    specular: base.specular,
    shininess: shininess !== undefined ? shininess : base.shininess,
    side: base.side,
  });
  // Flat-Shading: eine Normale pro Dreieck (keine Interpolation).
  m.flatShading = mode === 'Flat';
  return m;
}

export function createPhongMode(renderer, scene, camera, cornell, params) {
  const meshes = [...cornell.walls, cornell.pillar, cornell.sphere];
  meshes.forEach(captureBase);

  // Normalen-Pfeile in die Szene hängen (zunächst unsichtbar).
  const helpers = createNormalsHelpers(cornell);
  helpers.forEach((h) => scene.add(h));

  function applyShading(mode) {
    meshes.forEach((mesh) => {
      const base = captureBase(mesh);
      // nur die Kugel nutzt den Shininess-Slider
      const sh = mesh === cornell.sphere ? params.shininess : base.shininess;
      const old = mesh.material;
      mesh.material = makeMaterial(base, mode, sh);
      old.dispose();
    });
  }
  applyShading(params.shading);

  return {
    render() {
      renderer.render(scene, camera);
    },
    applyShading,
    setShininess(v) {
      // Kugelmaterial live aktualisieren (nur im Phong-Shading vorhanden).
      if (cornell.sphere.material.shininess !== undefined) {
        cornell.sphere.material.shininess = v;
      }
    },
    setNormalsVisible(visible) {
      helpers.forEach((h) => {
        h.visible = visible;
        if (visible) h.update();
      });
    },
  };
}
