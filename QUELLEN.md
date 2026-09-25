# Quellen und Referenzen

Dokumentation der Grundlagen, auf denen die Implementierung dieses Projekts beruht.
Gegliedert nach Aufgabenstellung, technischer Dokumentation, wissenschaftlicher
Primärliteratur und Lernressourcen. Am Ende ordnet eine Tabelle jeder Quelle die
konkrete Stelle im Code zu.

---

## 1. Aufgabenstellung

Primäre Vorgabe ist die Projektanweisung des Fachs Computergrafik. Aus ihr stammen
die verbindlichen Festlegungen, die im Code unverändert umgesetzt sind:

- Aufbau und Farbgebung der Cornell Box (linke Wand grün, rechte Wand rot, übrige
  Flächen weiß, Vorderwand offen)
- **Ambienter Term = 0**
- Lichtfarben weiß `(1,1,1)`, gelb `(1,1,0)`, türkis `(0,1,1)`
- Reflexionstiefe des Raytracers, Standardwert **N = 3**
- Die drei zu vergleichenden Verfahren (lokales Phong-Modell, Raytracing,
  Global Illumination / Radiosity)

---

## 2. Technische Dokumentation

| Quelle | Verwendung im Projekt |
|---|---|
| **three.js — Dokumentation**, https://threejs.org/docs/ | `MeshPhongMaterial`, `MeshLambertMaterial`, `ShaderMaterial`, `WebGLRenderTarget`, `PointLight`, `PlaneGeometry`, `BoxGeometry`, `SphereGeometry`, Shadow-Map-Konfiguration |
| **three.js — Addons** (`examples/jsm`) | `OrbitControls` (Kamerasteuerung), `VertexNormalsHelper` (Normalen-Anzeige) |
| **Vite — Dokumentation**, https://vite.dev/ | Dev-Server, Produktions-Build, `?raw`-Import der GLSL-Dateien, `base`-Pfad für das Hosting |
| **OpenGL ES Shading Language 1.00 Specification** (Khronos Group), https://registry.khronos.org/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf | GLSL-Sprachumfang der Fragment-Shader; u. a. die Vorgabe konstanter Schleifenobergrenzen |
| **WebGL 2.0 Specification** (Khronos Group), https://registry.khronos.org/webgl/specs/latest/2.0/ | Float-Render-Targets für die progressive Akkumulation |
| **MDN Web Docs**, https://developer.mozilla.org/ | `requestAnimationFrame`, Pointer Events, Formularelemente und CSS des Bedien-Panels |

---

## 3. Wissenschaftliche Primärliteratur

### Lokale Beleuchtung und Shading

- **Phong, B. T. (1975).** *Illumination for Computer Generated Pictures.*
  Communications of the ACM, 18(6), 311–317.
  → Das Beleuchtungsmodell (diffuser + spekularer Term, Reflektanzvektor `R`,
  Exponent `shininess`) sowie das Phong-Shading (Normaleninterpolation pro Fragment).

- **Gouraud, H. (1971).** *Continuous Shading of Curved Surfaces.*
  IEEE Transactions on Computers, C-20(6), 623–629.
  → Gouraud-Shading (Beleuchtung pro Eckpunkt, Interpolation der Farbe) als
  Vergleichsmodus im Shading-Umschalter.

### Schatten

- **Williams, L. (1978).** *Casting Curved Shadows on Curved Surfaces.*
  SIGGRAPH '78, 270–274.
  → Shadow Mapping, wie es three.js im Phong-Modus verwendet.

### Raytracing

- **Whitted, T. (1980).** *An Improved Illumination Model for Shaded Display.*
  Communications of the ACM, 23(6), 343–349.
  → Rekursives Raytracing mit Primär-, Schatten- und Reflexionsstrahlen sowie
  Abbruch nach einer festen Rekursionstiefe.

- **Kay, T. L., & Kajiya, J. T. (1986).** *Ray Tracing Complex Scenes.*
  SIGGRAPH '86, 269–278.
  → Slab-Methode für den Strahl-Box-Schnitttest (Grundlage des OBB-Tests der Säule).

### Globale Beleuchtung

- **Goral, C. M., Torrance, K. E., Greenberg, D. P., & Battaile, B. (1984).**
  *Modeling the Interaction of Light Between Diffuse Surfaces.*
  SIGGRAPH '84, 213–222.
  → Radiosity-Verfahren und der Effekt des **Color Bleeding**. In dieser Arbeit
  wurde die Cornell Box als Referenzszene eingeführt.

- **Kajiya, J. T. (1986).** *The Rendering Equation.*
  SIGGRAPH '86, 143–150.
  → Die Rendering-Gleichung und Path Tracing als Monte-Carlo-Lösungsverfahren.

- **Cook, R. L., Porter, T., & Carpenter, L. (1984).** *Distributed Ray Tracing.*
  SIGGRAPH '84, 137–145.
  → Weiche Schatten durch Sampling ausgedehnter Lichtquellen.

- **Veach, E. (1997).** *Robust Monte Carlo Methods for Light Transport Simulation.*
  Dissertation, Stanford University.
  → Next Event Estimation (direktes Sampling der Lichtfläche) und die Vermeidung
  von Doppelzählung zwischen Licht-Sampling und zufälligem Lichttreffer.

---

## 4. Lehrbücher und Lernressourcen

- **Pharr, M., Jakob, W., & Humphreys, G. (2023).** *Physically Based Rendering:
  From Theory to Implementation* (4. Auflage). MIT Press.
  Online frei verfügbar: https://www.pbr-book.org/
  → Referenz für cosinus-gewichtetes Hemisphären-Sampling, den Flächenlicht-Schätzer
  (Umrechnung Raumwinkel → Fläche) und den Umgang mit Ausreißer-Pfaden („Fireflies“).

- **Akenine-Möller, T., Haines, E., & Hoffman, N. (2018).** *Real-Time Rendering*
  (4. Auflage). CRC Press.
  → Überblick über lokale Beleuchtungsmodelle, Shadow Mapping und Shading-Verfahren.

- **Shirley, P.** *Ray Tracing in One Weekend* (Buchreihe),
  https://raytracing.github.io/
  → Kompakte Herleitung des Strahl-Kugel-Schnitttests und der Pfadverfolgung.

- **Scratchapixel** — *Lessons in Computer Graphics*, https://www.scratchapixel.com/
  → Herleitungen der Strahl-Ebene- und Strahl-Box-Schnitttests.

- **Cornell University Program of Computer Graphics** — *The Cornell Box*,
  https://www.graphics.cornell.edu/online/box/
  → Originalmaße, Geometrie und Referenzbilder der Cornell Box.

---

## 5. Zuordnung: Quelle → Code

| Konzept im Code | Datei / Funktion | Quelle |
|---|---|---|
| Phong-Formel (diffus + spekular) | `shaders/raytrace.frag` → `shadePhong()`; `MeshPhongMaterial` in `scene.js` | Phong (1975) |
| Reflektanzvektor `R` | `shadePhong()` → `reflect(-L, N)` | Phong (1975) |
| Flat / Gouraud / Phong-Shading | `modes/phongMode.js` → `makeMaterial()` | Gouraud (1971), Phong (1975) |
| Harte Schatten via Shadow Map | `main.js` → `renderer.shadowMap` | Williams (1978) |
| Schattenstrahlen | `shaders/scene_common.glsl` → `occluded()` | Whitted (1980) |
| Rekursive Reflexion, Abbruch nach N | `shaders/raytrace.frag` → Schleife mit `uMaxBounces` | Whitted (1980) |
| Strahl-Ebene (Wände) | `scene_common.glsl` → `testWall()` | Scratchapixel; Standardgeometrie |
| Strahl-Kugel | `scene_common.glsl` → `testSphere()` | Shirley, *Ray Tracing in One Weekend* |
| Strahl-Box (Slab-Test, OBB) | `scene_common.glsl` → `testPillar()` | Kay & Kajiya (1986) |
| Rendering-Gleichung / Path Tracing | `shaders/pathtrace.frag` → `tracePath()` | Kajiya (1986) |
| Cosinus-gewichtetes Sampling | `pathtrace.frag` → `cosineSampleHemisphere()` | PBRT, Kap. 13 |
| Next Event Estimation (Flächenlicht) | `pathtrace.frag` → `sampleLight()` | Veach (1997); PBRT |
| Vermeidung der Doppelzählung (`prevSpecular`) | `pathtrace.frag` → `tracePath()` | Veach (1997) |
| Color Bleeding | `pathtrace.frag` → `throughput *= h.color` | Goral et al. (1984) |
| Weiche Schatten (Flächenlicht) | `pathtrace.frag` → `sampleLight()` | Cook et al. (1984) |
| Firefly-Clamp | `pathtrace.frag` → `min(sampleColor, vec3(3.5))` | PBRT (Varianzreduktion) |
| Progressive Akkumulation (Ping-Pong) | `modes/radiosityMode.js` | WebGL 2.0 Spec; PBRT (Monte-Carlo-Mittelung) |
| Szenenaufbau und Maße | `scene.js` → `SCENE` | Cornell Box (Cornell University); Projektanweisung |

---

## 6. Abgrenzung

Die Kernalgorithmen sind **selbst implementiert**. Es wurde bewusst **kein**
Rendering-Framework für Raytracing oder Global Illumination eingebunden
(z. B. kein `three-gpu-pathtracer`); Raytracer und Path Tracer sind eigene
GLSL-Fragment-Shader. Einzige Laufzeit-Abhängigkeit ist three.js, Vite dient
ausschließlich als Build-Werkzeug. Das Bedien-Panel ist reines HTML/CSS/JS ohne
UI-Bibliothek.

Die oben genannte Literatur lieferte die **theoretischen Grundlagen und
Herleitungen**; Code wurde daraus nicht übernommen.
