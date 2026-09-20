// ===========================================================================
// scene_common.glsl — geteilte Szenen-Definition für Raytracer (Modus 2) und
// Path-Tracer (Modus 3).
//
// Enthält: die analytischen Schnitttests (Strahl-Ebene/Wand, Strahl-Box,
// Strahl-Kugel), die Szenen-Komposition (intersectScene), den Schatten-/
// Sichtbarkeitstest (occluded) und die Primärstrahl-Erzeugung.
//
// Diese Datei wird von raytraceMode.js / radiosityMode.js VOR den jeweiligen
// Main-Shader gehängt. Sie deklariert nur die GEMEINSAMEN Uniforms; modus-
// spezifische Uniforms stehen im jeweiligen Main-Shader.
// ===========================================================================
precision highp float;

varying vec2 vUv;

// --- Gemeinsame Uniforms (Kamera + Geometrie, gespeist aus SCENE in scene.js)
uniform vec3 uCamPos;       // Kameraposition (Weltkoordinaten)
uniform mat4 uCamWorld;     // camera.matrixWorld
uniform mat4 uProjInv;      // camera.projectionMatrixInverse
uniform vec3 uLightColor;   // Lichtfarbe (weiß/gelb/türkis)
uniform vec3 uLightPos;     // Punktlicht-Position (Mitte des Flächenlichts)
uniform vec2 uLightHalf;    // halbe Kantenlänge des Deckenlichts (x,z)
uniform vec3 uSphereCenter;
uniform float uSphereRadius;
uniform vec3 uPillarCenter;
uniform vec3 uPillarHalf;
uniform float uPillarRot;   // Rotation der Säule um die Y-Achse (Radiant)

const float EPS = 1e-3;
const float INF = 1e9;
const float PI  = 3.14159265359;

// Material-Typen
const int MAT_DIFFUSE  = 0;
const int MAT_MIRROR   = 1;
const int MAT_EMISSIVE = 2;

struct Hit {
  float t;       // Strahlparameter (INF = kein Treffer)
  vec3 pos;      // Trefferpunkt
  vec3 normal;   // nach innen/zum Strahl zeigende Flächennormale
  vec3 color;    // Materialfarbe M
  int mat;       // MAT_DIFFUSE / MAT_MIRROR / MAT_EMISSIVE
};

// --- Wand-Schnitttest (eine Funktion für alle fünf Wände) ------------------
// Die Box ist der Würfel [-1,1]^3. Zeigt die Normale n einer Wand nach INNEN,
// so erfüllt jeder Punkt p dieser Wand dieselbe Ebenengleichung:
//
//     dot(p, n) = -1
//
// Beispiel linke Wand (x = -1, Normale (1,0,0)): dot((-1,y,z),(1,0,0)) = -1. ✓
// Dasselbe gilt für rechte Wand, Boden, Decke und Rückwand. Deshalb genügt EIN
// Schnitttest, der nur die Normale und die Farbe als Parameter bekommt.
//
// Strahl einsetzen:  dot(ro + t*rd, n) = -1  =>  t = (-1 - dot(ro,n)) / dot(rd,n)
void testWall(vec3 ro, vec3 rd, vec3 n, vec3 col, inout Hit h) {
  float denom = dot(rd, n);
  if (abs(denom) < 1e-7) return;              // Strahl parallel zur Wand
  float t = (-1.0 - dot(ro, n)) / denom;
  if (t < EPS || t > h.t) return;             // hinter uns oder weiter als bisher
  vec3 p = ro + t * rd;
  // Begrenzung: der Trefferpunkt muss innerhalb des Würfels liegen. Die Achse
  // der Wand selbst ist per Konstruktion genau ±1, die beiden anderen werden
  // hier auf [-1,1] geprüft.
  if (any(greaterThan(abs(p), vec3(1.0 + EPS)))) return;

  h.t = t; h.pos = p; h.normal = n; h.color = col; h.mat = MAT_DIFFUSE;

  // Die Decke ist die einzige Wand, deren Normale nach unten zeigt. Liegt der
  // Treffer dort im mittigen Rechteck, ist es das Flächenlicht (emissiv).
  if (n.y < -0.5 && abs(p.x) < uLightHalf.x && abs(p.z) < uLightHalf.y) {
    h.color = uLightColor; h.mat = MAT_EMISSIVE;
  }
}

// --- Strahl-Kugel (spiegelnd) ----------------------------------------------
void testSphere(vec3 ro, vec3 rd, inout Hit h) {
  vec3 oc = ro - uSphereCenter;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - uSphereRadius * uSphereRadius;
  float disc = b * b - c;
  if (disc < 0.0) return;
  float s = sqrt(disc);
  float t = -b - s;
  if (t < EPS) t = -b + s;
  if (t < EPS || t > h.t) return;
  vec3 p = ro + t * rd;
  h.t = t; h.pos = p; h.normal = normalize(p - uSphereCenter);
  h.color = vec3(0.95); h.mat = MAT_MIRROR; // spiegelnd, fast weiße Tönung
}

// --- Strahl-Box (orientierte Säule, OBB) -----------------------------------
// Eine gedrehte Box lässt sich nicht direkt mit dem Slab-Test prüfen. Trick:
// Statt die Box zu drehen, drehen wir den STRAHL ins lokale Boxsystem zurück,
// machen dort den normalen (achsenparallelen) Slab-Test und drehen die
// gefundene Normale wieder zurück in Weltkoordinaten.
void testPillar(vec3 ro, vec3 rd, inout Hit h) {
  // Rotation um die Y-Achse. Die Inverse einer Rotationsmatrix ist ihre
  // Transponierte — wir brauchen cos/sin daher nur einmal.
  float c = cos(uPillarRot), s = sin(uPillarRot);
  mat3 R    = mat3(c, 0.0, -s,  0.0, 1.0, 0.0,   s, 0.0, c); // lokal -> Welt
  mat3 Rinv = mat3(c, 0.0,  s,  0.0, 1.0, 0.0,  -s, 0.0, c); // Welt  -> lokal

  vec3 lo = Rinv * (ro - uPillarCenter); // Strahl im lokalen Boxsystem
  vec3 ld = Rinv * rd;

  // Slab-Test: pro Achse Ein-/Austrittsparameter, dann das größte tmin und das
  // kleinste tmax. Getroffen wird die Box zwischen tn (Eintritt) und tf (Austritt).
  vec3 t1 = (-uPillarHalf - lo) / ld;
  vec3 t2 = ( uPillarHalf - lo) / ld;
  vec3 tmin = min(t1, t2);
  vec3 tmax = max(t1, t2);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn > tf || tf < EPS) return;

  float t = (tn > EPS) ? tn : tf; // von außen: Eintritt, von innen: Austritt
  if (t > h.t) return;

  // Flächennormale = die Achse mit dem betragsgrößten lokalen Koordinatenanteil
  vec3 lp = lo + t * ld;
  vec3 al = abs(lp);
  vec3 nl;
  if (al.x >= al.y && al.x >= al.z) nl = vec3(sign(lp.x), 0.0, 0.0);
  else if (al.y >= al.z)            nl = vec3(0.0, sign(lp.y), 0.0);
  else                              nl = vec3(0.0, 0.0, sign(lp.z));

  h.t = t; h.pos = ro + t * rd;
  h.normal = R * nl;      // Rotation erhält die Länge -> kein normalize nötig
  h.color = vec3(1.0);    // weiße, diffuse Säule (wie COLORS.white in scene.js)
  h.mat = MAT_DIFFUSE;
}

// --- Gesamte Szene: nächster Treffer ---------------------------------------
// Jede Wand wird nur durch ihre nach innen zeigende Normale und ihre Farbe
// beschrieben. Die Farben sind identisch zu COLORS in scene.js.
Hit intersectScene(vec3 ro, vec3 rd) {
  Hit h; h.t = INF; h.mat = MAT_DIFFUSE; h.color = vec3(0.0); h.normal = vec3(0.0);
  //        Normale (nach innen)        Farbe
  testWall(ro, rd, vec3( 1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), h); // links:   grün
  testWall(ro, rd, vec3(-1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), h); // rechts:  rot
  testWall(ro, rd, vec3( 0.0, 1.0, 0.0), vec3(1.0),            h); // Boden:   weiß
  testWall(ro, rd, vec3( 0.0,-1.0, 0.0), vec3(1.0),            h); // Decke:   weiß + Licht
  testWall(ro, rd, vec3( 0.0, 0.0, 1.0), vec3(1.0),            h); // Rückwand: weiß
  // Vorderwand (z = +1): bewusst nicht vorhanden — die Box ist zur Kamera offen.
  testSphere(ro, rd, h);
  testPillar(ro, rd, h);
  return h;
}

// --- Schatten-/Sichtbarkeitstest -------------------------------------------
// Gibt true zurück, wenn zwischen ro und einem Punkt in Distanz maxT ein
// Objekt liegt (=> Punkt im Schatten). Das emissive Licht blockt nicht.
bool occluded(vec3 ro, vec3 rd, float maxT) {
  Hit h = intersectScene(ro, rd);
  return (h.t < maxT && h.mat != MAT_EMISSIVE);
}

// --- Primärstrahl aus Pixelkoordinate (vUv in [0,1]) -----------------------
// Über die inverse Projektion + Kamera-Weltmatrix wird die Strahlrichtung
// rekonstruiert. Ergebnis: Ursprung = Kamera, Richtung = durch das Pixel.
void makePrimaryRay(vec2 uv, out vec3 ro, out vec3 rd) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, -1.0, 1.0);
  vec4 vp = uProjInv * ndc;
  vp /= vp.w;                       // Punkt auf der near-Ebene (View-Space)
  vec3 dirView = normalize(vp.xyz);
  rd = normalize(mat3(uCamWorld) * dirView);
  ro = uCamPos;
}
