// ===========================================================================
// raytrace.frag — Modus 2: Whitted-Raytracing im Fragment-Shader.
//
// Wird hinter scene_common.glsl gehängt (dort: Schnitttests, occluded,
// makePrimaryRay, Hit, gemeinsame Uniforms).
//
// Ablauf pro Pixel:
//   1. Primärstrahl von der Kamera durch das Pixel.
//   2. Nächsten Treffer suchen.
//   3. Spiegelnde Fläche  -> Reflexionsstrahl, Materialfarbe einmultiplizieren,
//      wiederholen (rekursiv als Schleife), Abbruch nach N Reflexionen.
//   4. Diffuse Fläche      -> lokale Phong-Beleuchtung + Schattenstrahl, fertig.
// ===========================================================================

// Modus-spezifische Uniforms
uniform float uShininess;     // spekularer Exponent (Glanzlicht der Kugel)
uniform float uLightIntensity;// Helligkeit der Lichtquelle
uniform int   uMaxBounces;    // Reflexionstiefe N (Default 3)

const int HARD_MAX = 16;      // konstante Schleifenobergrenze (WebGL-Vorgabe)

// --- Lokales Phong-Beleuchtungsmodell --------------------------------------
// Klausurformel:  Farbe = Lichtfarbe ⊙ M ⊙ ( max(0, L·N) + (R·V)^shininess )
// - L: Vektor zum Licht, N: Flächennormale  (diffuser Term)
// - R: Reflektanzvektor von L an N, V: Vektor zum Auge (spekularer Term)
// Kein ambienter Term. Liegt der Punkt im Schatten, entfällt die direkte
// Beleuchtung komplett (harte Schatten).
vec3 shadePhong(Hit h, vec3 rd) {
  vec3 N = h.normal;
  vec3 toL = uLightPos - h.pos;
  float dist = length(toL);
  vec3 L = toL / dist;
  vec3 V = normalize(-rd);              // Richtung zum Auge

  // Schattenstrahl zum Licht: bei Treffer -> keine direkte Beleuchtung.
  float vis = occluded(h.pos + N * EPS, L, dist - EPS) ? 0.0 : 1.0;

  float diffuse = max(dot(N, L), 0.0);
  vec3 R = reflect(-L, N);             // Reflektanzvektor R
  // Glanzlicht nur auf der spiegelnden Kugel; matte Flächen glänzen nicht.
  float specular = (h.mat == MAT_MIRROR)
      ? pow(max(dot(R, V), 0.0), uShininess)
      : 0.0;

  // milde Abstandsabschwächung, damit die Box wie im Phong-Modus zu den Ecken
  // hin abdunkelt (Punktlicht-Charakter).
  float atten = uLightIntensity / (1.0 + 0.35 * dist * dist);

  // komponentenweise Multiplikation Lichtfarbe ⊙ Materialfarbe
  return uLightColor * h.color * (diffuse + specular) * vis * atten;
}

void main() {
  vec3 ro, rd;
  makePrimaryRay(vUv, ro, rd);

  vec3 radiance = vec3(0.0);
  vec3 throughput = vec3(1.0); // akkumulierte Materialfarbe der Spiegel-Kette

  for (int b = 0; b <= HARD_MAX; b++) {
    if (b > uMaxBounces) break;        // Reflexionstiefe N respektieren

    Hit h = intersectScene(ro, rd);
    if (h.t >= INF) break;             // Strahl verlässt die Box (offene Vorderwand) -> schwarz

    if (h.mat == MAT_EMISSIVE) {       // direkt ins Licht geschaut
      radiance += throughput * uLightColor * uLightIntensity;
      break;
    }

    if (h.mat == MAT_MIRROR && b < uMaxBounces) {
      // Spiegelung: Materialfarbe der getroffenen Fläche einmultiplizieren
      // (wie in der Klausurlösung) und Reflexionsstrahl weiterverfolgen.
      throughput *= h.color;
      ro = h.pos + h.normal * EPS;
      rd = reflect(rd, h.normal);      // <-- hier wird R bestimmt
      continue;
    }

    // Diffuse Fläche ODER letzte erlaubte Reflexion: lokal beleuchten + Stop.
    radiance += throughput * shadePhong(h, rd);
    break;
  }

  // Farbwerte > 1 auf 1 clampen, anschließend Gamma (sRGB) für konsistente
  // Helligkeit gegenüber dem Phong-Modus.
  vec3 col = clamp(radiance, 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
}
