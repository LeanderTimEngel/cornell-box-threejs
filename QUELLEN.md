# Quellen und Referenzen

Übersicht der Vorgaben, Bibliotheken und Dokumentation, die bei der Umsetzung
dieses Projekts verwendet wurden.

---

## 1. Aufgabenstellung

Primäre Vorgabe ist die Projektanweisung des Fachs Computergrafik. Daraus stammen
die verbindlichen Festlegungen, die im Code unverändert umgesetzt sind:

- Aufbau und Farbgebung der Cornell Box (linke Wand grün, rechte Wand rot, übrige
  Flächen weiß, Vorderwand offen)
- **Ambienter Term = 0**
- Lichtfarben weiß `(1,1,1)`, gelb `(1,1,0)`, türkis `(0,1,1)`
- Reflexionstiefe des Raytracers, Standardwert **N = 3**
- Die drei zu vergleichenden Verfahren (lokales Phong-Modell, Raytracing,
  Global Illumination / Radiosity)
- Technologie-Stack: three.js, Vite, Vanilla JavaScript (ES-Module), GLSL

---

## 2. Verwendete Bibliotheken

| Paket | Version | Rolle |
|---|---|---|
| **three.js** | `^0.165.0` | Einzige **Laufzeit**-Abhängigkeit |
| **Vite** | `^5.3.1` | Nur **Build-Werkzeug** und Dev-Server (wird nicht mitausgeliefert) |

Weitere Laufzeit-Abhängigkeiten gibt es nicht. Insbesondere wurde **keine
UI-Bibliothek** und **kein Rendering-/Pathtracer-Framework** eingebunden.

### Genutzter Funktionsumfang von three.js

| Bereich | Verwendete Klassen / APIs |
|---|---|
| Grundgerüst | `WebGLRenderer`, `Scene`, `PerspectiveCamera`, `Camera`, `Color`, `Vector2/3`, `Matrix4`, `MathUtils` |
| Geometrie | `PlaneGeometry`, `BoxGeometry`, `SphereGeometry`, `Mesh`, `Group` |
| Materialien (Modus 1) | `MeshPhongMaterial`, `MeshLambertMaterial`, `MeshBasicMaterial` |
| Licht & Schatten | `PointLight`, `renderer.shadowMap` (`PCFShadowMap`) |
| Eigene Shader (Modus 2 & 3) | `ShaderMaterial`, `WebGLRenderTarget` (`FloatType`), `setRenderTarget` |
| Split-Screen | `setScissor`, `setScissorTest`, `setViewport` |
| Addons (`examples/jsm`) | `OrbitControls`, `VertexNormalsHelper` |

---

## 3. Technische Dokumentation

| Quelle | Wofür herangezogen |
|---|---|
| **three.js — Dokumentation**<br>https://threejs.org/docs/ | API der oben genannten Klassen; Konfiguration von Shadow Map, Render-Targets und `ShaderMaterial`-Uniforms |
| **three.js — Beispiele / Addons**<br>https://threejs.org/examples/ | Einbindung von `OrbitControls` und `VertexNormalsHelper` |
| **Vite — Dokumentation**<br>https://vite.dev/ | Dev-Server, Produktions-Build, `?raw`-Import der GLSL-Dateien, `base`-Pfad für das Hosting |
| **OpenGL ES Shading Language 1.00 Specification** (Khronos)<br>https://registry.khronos.org/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf | Sprachumfang der Fragment-Shader; u. a. die Vorgabe **konstanter Schleifenobergrenzen** und verfügbare Built-ins (`reflect`, `any`, `greaterThan`, `mix`) |
| **WebGL 2.0 Specification** (Khronos)<br>https://registry.khronos.org/webgl/specs/latest/2.0/ | Float-Render-Targets für die progressive Akkumulation |
| **MDN Web Docs**<br>https://developer.mozilla.org/ | `requestAnimationFrame`, Pointer Events (Trenner im Split-Screen), Formularelemente und CSS des Bedien-Panels |

---

## 4. Referenzen für die Schnitttest-Mathematik

Die analytischen Strahl-Objekt-Schnitttests in `src/shaders/scene_common.glsl`
folgen den Standardherleitungen aus:

- **Scratchapixel** — *Lessons in Computer Graphics*, https://www.scratchapixel.com/
  → Strahl-Ebene und Strahl-Box (Slab-Methode)
- **Peter Shirley** — *Ray Tracing in One Weekend*, https://raytracing.github.io/
  → Strahl-Kugel (quadratische Gleichung), Aufbau der Pfadverfolgung
- **Cornell University, Program of Computer Graphics** — *The Cornell Box*,
  https://www.graphics.cornell.edu/online/box/
  → Originalmaße und Aufbau der Referenzszene

---

## 5. Zuordnung: Technik → Code-Stelle

| Umsetzung | Datei / Funktion | Grundlage |
|---|---|---|
| Phong-Beleuchtung (Modus 1) | `scene.js` → `MeshPhongMaterial` | three.js-Dokumentation |
| Flat / Gouraud / Phong-Shading | `modes/phongMode.js` → `makeMaterial()` | three.js (`flatShading`, `MeshLambertMaterial`) |
| Harte Schatten via Shadow Map | `main.js` → `renderer.shadowMap` | three.js-Dokumentation |
| Normalen-Anzeige | `utils/normalsHelper.js` | three.js-Addon `VertexNormalsHelper` |
| Kamerasteuerung | `main.js` → `OrbitControls` | three.js-Addon |
| Phong-Formel im Shader | `shaders/raytrace.frag` → `shadePhong()` | Aufgabenstellung (Formel), GLSL-Spezifikation |
| Strahl-Ebene (Wände) | `shaders/scene_common.glsl` → `testWall()` | Scratchapixel |
| Strahl-Kugel | `shaders/scene_common.glsl` → `testSphere()` | Shirley, *Ray Tracing in One Weekend* |
| Strahl-Box, Slab-Test (OBB) | `shaders/scene_common.glsl` → `testPillar()` | Scratchapixel |
| Schattenstrahlen | `shaders/scene_common.glsl` → `occluded()` | eigene Umsetzung |
| Reflexion + Abbruch nach N | `shaders/raytrace.frag` → Schleife mit `uMaxBounces` | Aufgabenstellung (N = 3), GLSL-Spezifikation |
| Path Tracing / Color Bleeding | `shaders/pathtrace.frag` → `tracePath()` | eigene Umsetzung |
| Progressive Akkumulation | `modes/radiosityMode.js` (Ping-Pong) | three.js `WebGLRenderTarget`, WebGL-2.0-Spezifikation |
| Split-Screen-Vergleich | `utils/compare.js` | three.js Scissor-API, MDN Pointer Events |
| Bedien-Panel | `index.html` + `controls/gui.js` | MDN (Formularelemente, CSS) |

---

## 6. Abgrenzung

Die Kernalgorithmen sind **selbst implementiert**. Raytracer und Path Tracer sind
eigene GLSL-Fragment-Shader; es wurde bewusst **kein** Rendering-Framework für
Raytracing oder Global Illumination eingebunden (z. B. kein
`three-gpu-pathtracer`). Das Bedien-Panel ist reines HTML/CSS/JavaScript ohne
UI-Bibliothek.

Aus den oben genannten Referenzen wurden **Herleitungen und API-Verwendung**
übernommen, **kein Quellcode**.
