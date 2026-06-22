// ===========================================================================
// pathtrace.frag — Modus 3: Global Illumination via Monte-Carlo-Path-Tracing
// (Variante A der Aufgabenstellung).
//
// Wird hinter scene_common.glsl gehängt. Der zentrale Lerneffekt ist das
// COLOR BLEEDING: diffuse Strahlen, die von der roten/grünen Wand zurück-
// streuen, tragen deren Farbe auf Decke, Boden und Objekte.
//
// Technik:
//   - Pfad pro Pixel: Kamera -> diffuse Bounces (cosinus-gewichtet) bis zu
//     einer Maximaltiefe.
//   - An jedem diffusen Treffer: direkte Beleuchtung durch Sampling eines
//     Punktes auf dem Flächenlicht (Next Event Estimation) -> wenig Rauschen.
//   - Indirekte Beleuchtung über die diffuse Weiterstreuung -> Color Bleeding.
//   - Spiegelnde Kugel: perfekte Reflexion (Materialfarbe einmultipliziert).
//   - Ergebnis wird über viele Frames in einem Float-Target gemittelt
//     (Progressive Rendering); Reset bei Kamera-/Parameteränderung in JS.
// ===========================================================================

uniform float uLightEmission; // Strahlungsleistung des Flächenlichts
uniform float uFrame;         // bisher akkumulierte Frames (0 = erster Frame)
uniform vec2  uResolution;    // Render-Auflösung (für RNG-Seed)
uniform sampler2D uPrev;      // bisher akkumulierte Summe (Ping-Pong)

const int MAX_DEPTH = 6;      // maximale Pfadlänge

// --- Einfacher Pseudo-Zufallsgenerator (pro Pixel & Frame) -----------------
float g_seed;
float rand() {
  g_seed = fract(sin(g_seed * 12.9898 + 78.233) * 43758.5453123);
  return g_seed;
}

// Cosinus-gewichtetes Hemisphären-Sampling um die Normale n.
// Liefert eine zufällige Richtung, deren Verteilung proportional zu cos(theta)
// ist — passend zur diffusen (Lambert-)Reflexion.
vec3 cosineSampleHemisphere(vec3 n) {
  float u1 = rand();
  float u2 = rand();
  float r = sqrt(u1);
  float phi = 2.0 * PI * u2;
  // orthonormale Basis um n
  vec3 t = normalize(abs(n.x) > 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0));
  vec3 tangent = normalize(cross(t, n));
  vec3 bitan = cross(n, tangent);
  return normalize(tangent * (r * cos(phi)) + bitan * (r * sin(phi)) + n * sqrt(max(0.0, 1.0 - u1)));
}

// Direkte Beleuchtung: zufälligen Punkt auf dem Deckenlicht sampeln und die
// Sichtbarkeit testen (Next Event Estimation für Flächenlichter).
vec3 sampleLight(vec3 p, vec3 n) {
  // Punkt auf dem Licht-Rechteck (y = 1, x/z innerhalb uLightHalf)
  vec3 lp = vec3((rand() * 2.0 - 1.0) * uLightHalf.x, 1.0,
                 (rand() * 2.0 - 1.0) * uLightHalf.y);
  vec3 toL = lp - p;
  float dist2 = dot(toL, toL);
  float dist = sqrt(dist2);
  vec3 wi = toL / dist;
  float cosSurf = dot(n, wi);                 // Winkel an der Oberfläche
  float cosLight = dot(vec3(0.0, -1.0, 0.0), -wi); // Licht strahlt nach unten
  if (cosSurf <= 0.0 || cosLight <= 0.0) return vec3(0.0);
  if (occluded(p + n * EPS, wi, dist - EPS)) return vec3(0.0);
  float area = (2.0 * uLightHalf.x) * (2.0 * uLightHalf.y);
  vec3 Le = uLightColor * uLightEmission;
  // Flächenlicht-Schätzer: Le * cosSurf * cosLight * Fläche / dist^2
  // (die diffuse BRDF 1/PI wird beim Aufrufer per throughput berücksichtigt)
  return Le * (cosSurf * cosLight * area / dist2) / PI;
}

vec3 tracePath(vec3 ro, vec3 rd) {
  vec3 radiance = vec3(0.0);
  vec3 throughput = vec3(1.0);
  bool prevSpecular = true; // Kamerastrahl: emittiertes Licht direkt zählen

  for (int depth = 0; depth < MAX_DEPTH; depth++) {
    Hit h = intersectScene(ro, rd);
    if (h.t >= INF) break; // verlässt die Box -> kein Beitrag

    if (h.mat == MAT_EMISSIVE) {
      // Licht nur zählen, wenn es über einen Spiegel-/Kamerastrahl getroffen
      // wurde — sonst wäre es über sampleLight() doppelt gezählt.
      if (prevSpecular) radiance += throughput * uLightColor * uLightEmission;
      break;
    }

    if (h.mat == MAT_MIRROR) {
      // perfekte Spiegelung: Materialfarbe einmultiplizieren, weiter.
      throughput *= h.color;
      ro = h.pos + h.normal * EPS;
      rd = reflect(rd, h.normal);
      prevSpecular = true;
      continue;
    }

    // --- diffuse Fläche -----------------------------------------------------
    // 1) direkte Beleuchtung (Schatten weich, weil Lichtfläche gesampelt wird)
    radiance += throughput * h.color * sampleLight(h.pos, h.normal);
    // 2) indirekte Beleuchtung: diffus weiterstreuen. HIER entsteht das Color
    //    Bleeding — der nächste Treffer "sieht" die Farbe dieser Fläche über
    //    throughput.
    throughput *= h.color;
    ro = h.pos + h.normal * EPS;
    rd = cosineSampleHemisphere(h.normal);
    prevSpecular = false;
  }
  return radiance;
}

void main() {
  // RNG-Seed aus Pixel + Frame, damit jeder Frame anders sampelt.
  g_seed = dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uFrame * 0.6180339887;

  // Primärstrahl mit Sub-Pixel-Jitter -> Anti-Aliasing über die Akkumulation.
  vec2 jitter = (vec2(rand(), rand()) - 0.5) / uResolution;
  vec3 ro, rd;
  makePrimaryRay(vUv + jitter, ro, rd);

  vec3 sampleColor = tracePath(ro, rd);

  // Firefly-Clamp: einzelne, extrem helle Pfade (z. B. diffus -> Spiegelkugel
  // -> direkt ins Licht) erzeugen sonst grelle Ausreißer-Pixel. Das Begrenzen
  // pro Sample kostet minimal Bias, beruhigt das Bild aber deutlich.
  sampleColor = min(sampleColor, vec3(3.5));

  // Progressive Akkumulation: Summe der Samples im Float-Target.
  vec3 prev = texture2D(uPrev, vUv).rgb;
  vec3 accum = (uFrame < 0.5) ? sampleColor : prev + sampleColor;
  gl_FragColor = vec4(accum, 1.0);
}
