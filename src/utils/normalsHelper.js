import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';

// ---------------------------------------------------------------------------
// normalsHelper.js — blendet die Flächen-/Eckpunktnormalen als gelbe Pfeile
// ein. Die Klausur betont den Unterschied zwischen Flächennormalen (flache
// Boxen/Wände: pro Fläche eine Normale) und Eckpunktnormalen (Kugel: glatt
// interpolierte Normalen pro Vertex). VertexNormalsHelper zeichnet genau die
// Normalen, die three.js zur Beleuchtung verwendet.
// ---------------------------------------------------------------------------

export function createNormalsHelpers(cornell) {
  const targets = [cornell.pillar, cornell.sphere, ...cornell.walls];
  return targets.map((mesh) => {
    const helper = new VertexNormalsHelper(mesh, 0.15, 0xffff00);
    helper.visible = false;
    return helper;
  });
}
