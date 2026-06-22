import * as THREE from 'three';

// ---------------------------------------------------------------------------
// scene.js — Geometrie und Materialien der Cornell Box
//
// Die Box reicht von (-1,-1,-1) bis (1,1,1), die Vorderwand (+Z) bleibt offen,
// damit die Kamera hineinblicken kann. Alle Wände sind nach INNEN ausgerichtet
// (Normale zeigt ins Boxinnere) — wichtig für die Normalen-Anzeige und für die
// Konsistenz mit dem Raytracer (Modus 2/3 nutzen exakt dieselben Zahlen, siehe
// SCENE unten).
//
// WICHTIG (Klausurbezug): Es gibt KEINEN ambienten Term. In three.js heißt das:
// keine AmbientLight, und die Materialien bekommen kein emissive-Grundlicht
// (außer der Lichtquelle selbst). Jede Fläche wird ausschließlich direkt
// beleuchtet.
// ---------------------------------------------------------------------------

// Wandfarben exakt nach Spezifikation
export const COLORS = {
  left: new THREE.Color(0, 1, 0), // linke Wand: grün
  right: new THREE.Color(1, 0, 0), // rechte Wand: rot
  white: new THREE.Color(1, 1, 1), // Decke / Boden / Rückwand
};

// Die drei wählbaren Lichtfarben aus den Klausuraufgaben
export const LIGHT_COLORS = {
  weiss: new THREE.Color(1, 1, 1),
  gelb: new THREE.Color(1, 1, 0),
  tuerkis: new THREE.Color(0, 1, 1),
};

// ---------------------------------------------------------------------------
// SCENE — numerische "Single Source of Truth" für die Geometrie.
// Sowohl die three.js-Meshes (unten) als auch die GLSL-Shader (raytrace.frag,
// pathtrace.frag über die Mode-Module) lesen exakt diese Werte. So rendern alle
// drei Modi garantiert dieselbe Szene.
// ---------------------------------------------------------------------------
export const SCENE = {
  box: { min: [-1, -1, -1], max: [1, 1, 1] },
  // Flächenlicht: Rechteck mittig an der Decke (y≈1).
  light: {
    halfSize: [0.25, 0.25], // halbe Kantenlänge in x bzw. z (=> 0.5 x 0.5)
    pointPos: [0.0, 0.97, 0.0], // Punktlicht in der Mitte (Phong/Raytracing)
    panelY: 0.999, // y-Höhe des sichtbaren Leuchtpaneels
  },
  // Diffuse, leicht gedrehte Säule
  pillar: {
    center: [-0.38, -0.4, -0.32],
    halfSize: [0.3, 0.6, 0.3], // => Box 0.6 x 1.2 x 0.6
    rotYdeg: 20,
  },
  // Spiegelnde Kugel
  sphere: { center: [0.42, -0.6, 0.33], radius: 0.4 },
};

/**
 * Baut eine einzelne Wand als 2x2-PlaneGeometry.
 * PlaneGeometry zeigt standardmäßig mit der Normale nach +Z; über Rotation
 * richten wir jede Wand so aus, dass die Normale ins Boxinnere zeigt.
 */
function makeWall(color, position, rotation) {
  const geo = new THREE.PlaneGeometry(2, 2);
  // MeshPhongMaterial = lokales Phong-Modell (diffus + spekular, kein Ambient).
  // shininess 0 + specular schwarz: die Wände sind matt/diffus.
  const mat = new THREE.MeshPhongMaterial({
    color,
    specular: new THREE.Color(0, 0, 0),
    shininess: 0,
    side: THREE.FrontSide, // Normale zeigt nach innen, Frontface reicht
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Erzeugt die komplette Cornell-Box-Szene und gibt Referenzen auf die
 * veränderlichen Teile zurück (Licht, Lichtpaneel, Objekte), damit GUI und
 * Mode-Module sie live anpassen können.
 */
export function buildCornellBox() {
  const root = new THREE.Group();

  // --- Wände -------------------------------------------------------------
  const walls = [
    // Boden (y=-1), Normale nach +Y
    makeWall(COLORS.white, new THREE.Vector3(0, -1, 0), { x: -Math.PI / 2, y: 0, z: 0 }),
    // Decke (y=+1), Normale nach -Y
    makeWall(COLORS.white, new THREE.Vector3(0, 1, 0), { x: Math.PI / 2, y: 0, z: 0 }),
    // Rückwand (z=-1), Normale nach +Z
    makeWall(COLORS.white, new THREE.Vector3(0, 0, -1), { x: 0, y: 0, z: 0 }),
    // Linke Wand (x=-1), grün, Normale nach +X
    makeWall(COLORS.left, new THREE.Vector3(-1, 0, 0), { x: 0, y: Math.PI / 2, z: 0 }),
    // Rechte Wand (x=+1), rot, Normale nach -X
    makeWall(COLORS.right, new THREE.Vector3(1, 0, 0), { x: 0, y: -Math.PI / 2, z: 0 }),
    // Vorderwand (+Z): bewusst NICHT gezeichnet (offen für die Kamera)
  ];
  walls.forEach((w) => root.add(w));

  // --- Flächenlicht an der Decke ----------------------------------------
  // Sichtbares, leuchtendes Paneel (kleines Rechteck, mittig an der Decke).
  // MeshBasicMaterial leuchtet unabhängig von der Beleuchtung (emissiv).
  const lw = SCENE.light.halfSize[0] * 2;
  const lightPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(lw, lw),
    new THREE.MeshBasicMaterial({ color: LIGHT_COLORS.weiss })
  );
  lightPanel.rotation.x = Math.PI / 2; // flach an der Decke, Normale nach unten
  lightPanel.position.set(0, SCENE.light.panelY, 0);
  root.add(lightPanel);

  // Punktlicht in der Mitte des Flächenlichts (Spezifikation erlaubt das
  // ausdrücklich für Phong/Raytracing). Erzeugt harte Schatten via ShadowMap.
  const light = new THREE.PointLight(LIGHT_COLORS.weiss, 4, 0, 1.2);
  light.position.set(...SCENE.light.pointPos);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 6;
  light.shadow.bias = -0.0015;
  root.add(light);

  // --- Objekte in der Box ------------------------------------------------
  // (1) Diffuse, leicht gedrehte Säule — zeigt Schatten gut und nimmt im
  //     GI-Modus das Color Bleeding der farbigen Wände an.
  const ph = SCENE.pillar.halfSize;
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(ph[0] * 2, ph[1] * 2, ph[2] * 2),
    new THREE.MeshPhongMaterial({
      color: COLORS.white,
      specular: new THREE.Color(0, 0, 0),
      shininess: 0,
    })
  );
  pillar.position.set(...SCENE.pillar.center);
  pillar.rotation.y = THREE.MathUtils.degToRad(SCENE.pillar.rotYdeg);
  pillar.castShadow = true;
  pillar.receiveShadow = true;
  root.add(pillar);

  // (2) Spiegelnde Kugel — hohe Shininess. Echte Spiegelungen der farbigen
  //     Wände kommen erst im Raytracing-Modus; im Phong-Modus sieht man hier
  //     vor allem das spekulare Glanzlicht.
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(SCENE.sphere.radius, 64, 48),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color(0.95, 0.95, 0.95),
      specular: new THREE.Color(1, 1, 1),
      shininess: 80,
    })
  );
  sphere.position.set(...SCENE.sphere.center);
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  root.add(sphere);

  return { root, walls, lightPanel, light, pillar, sphere };
}
