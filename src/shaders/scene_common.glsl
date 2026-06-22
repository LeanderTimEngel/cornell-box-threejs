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

// --- Wand-Schnitttests (achsenparallele, endliche Quads) -------------------
// Strahl-Ebene: t = (planeCoord - ro.k) / rd.k, danach Begrenzung prüfen.
void testWallX(vec3 ro, vec3 rd, float x, float nx, vec3 col, inout Hit h) {
  if (abs(rd.x) < 1e-7) return;
  float t = (x - ro.x) / rd.x;
  if (t < EPS || t > h.t) return;
  vec3 p = ro + t * rd;
  if (p.y < -1.0 || p.y > 1.0 || p.z < -1.0 || p.z > 1.0) return;
  h.t = t; h.pos = p; h.normal = vec3(nx, 0.0, 0.0); h.color = col; h.mat = MAT_DIFFUSE;
}
void testWallZ(vec3 ro, vec3 rd, float z, float nz, vec3 col, inout Hit h) {
  if (abs(rd.z) < 1e-7) return;
  float t = (z - ro.z) / rd.z;
  if (t < EPS || t > h.t) return;
  vec3 p = ro + t * rd;
  if (p.x < -1.0 || p.x > 1.0 || p.y < -1.0 || p.y > 1.0) return;
  h.t = t; h.pos = p; h.normal = vec3(0.0, 0.0, nz); h.color = col; h.mat = MAT_DIFFUSE;
}
// Boden / Decke. Bei der Decke (isCeiling) wird das mittige Licht-Rechteck als
// emissive Fläche markiert.
void testWallY(vec3 ro, vec3 rd, float y, float ny, vec3 col, bool isCeiling, inout Hit h) {
  if (abs(rd.y) < 1e-7) return;
  float t = (y - ro.y) / rd.y;
  if (t < EPS || t > h.t) return;
  vec3 p = ro + t * rd;
  if (p.x < -1.0 || p.x > 1.0 || p.z < -1.0 || p.z > 1.0) return;
  h.t = t; h.pos = p; h.normal = vec3(0.0, ny, 0.0); h.color = col; h.mat = MAT_DIFFUSE;
  if (isCeiling && abs(p.x) < uLightHalf.x && abs(p.z) < uLightHalf.y) {
    h.color = uLightColor; h.mat = MAT_EMISSIVE; // Flächenlicht
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

// Rotationsmatrix um die Y-Achse (Spalten-Major wie in GLSL üblich)
mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c);
}

// --- Strahl-Box (orientierte Säule, OBB) -----------------------------------
// Wir transformieren den Strahl ins lokale Boxsystem (Rotation rückgängig),
// machen dort einen Standard-Slab-Test und drehen die Normale zurück.
void testPillar(vec3 ro, vec3 rd, inout Hit h) {
  mat3 Rinv = rotY(-uPillarRot);
  vec3 lo = Rinv * (ro - uPillarCenter);
  vec3 ld = Rinv * rd;
  vec3 inv = 1.0 / ld;
  vec3 t1 = (-uPillarHalf - lo) * inv;
  vec3 t2 = ( uPillarHalf - lo) * inv;
  vec3 tmin = min(t1, t2);
  vec3 tmax = max(t1, t2);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn > tf || tf < EPS) return;
  float t = (tn > EPS) ? tn : tf;
  if (t > h.t) return;
  vec3 lp = lo + t * ld;
  // Flächennormale = Achse mit dem betragsgrößten lokalen Koordinatenanteil
  vec3 al = abs(lp);
  vec3 nl;
  if (al.x >= al.y && al.x >= al.z) nl = vec3(sign(lp.x), 0.0, 0.0);
  else if (al.y >= al.z)            nl = vec3(0.0, sign(lp.y), 0.0);
  else                              nl = vec3(0.0, 0.0, sign(lp.z));
  h.t = t; h.pos = ro + t * rd; h.normal = normalize(rotY(uPillarRot) * nl);
  h.color = vec3(0.95); h.mat = MAT_DIFFUSE;
}

// --- Gesamte Szene: nächster Treffer ---------------------------------------
Hit intersectScene(vec3 ro, vec3 rd) {
  Hit h; h.t = INF; h.mat = MAT_DIFFUSE; h.color = vec3(0.0); h.normal = vec3(0.0);
  testWallX(ro, rd, -1.0,  1.0, vec3(0.0, 1.0, 0.0), h); // links: grün
  testWallX(ro, rd,  1.0, -1.0, vec3(1.0, 0.0, 0.0), h); // rechts: rot
  testWallY(ro, rd, -1.0,  1.0, vec3(1.0), false, h);    // Boden
  testWallY(ro, rd,  1.0, -1.0, vec3(1.0), true,  h);    // Decke + Licht
  testWallZ(ro, rd, -1.0,  1.0, vec3(1.0), h);           // Rückwand
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
