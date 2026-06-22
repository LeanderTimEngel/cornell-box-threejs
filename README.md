# Cornell Box — Interaktiver Rendering-Vergleich (three.js)

Eine Web-Anwendung, die **dieselbe Cornell Box** unter drei verschiedenen
Beleuchtungs-/Rendering-Verfahren zeigt und direkt vergleichbar macht:

1. **Lokales Phong-Beleuchtungsmodell** (Standard-Rasterisierung wie in OpenGL)
2. **Raytracing** (eigener GLSL-Fragment-Shader: Schatten- und Reflexionsstrahlen)
3. **Global Illumination / Radiosity-Effekt** (Path-Tracing mit **Color Bleeding**)

Der didaktische Kern ist, die **Unterschiede zwischen den Verfahren sichtbar zu
machen** — insbesondere das Color Bleeding, das nur die globale Beleuchtung erzeugt.

---

## Schnellstart

```bash
npm install
npm run dev      # startet den Vite-Dev-Server und öffnet den Browser
```

Build für die Abgabe / statisches Hosting:

```bash
npm run build    # erzeugt dist/
npm run preview  # dient dist/ lokal aus
```

Voraussetzung: ein Browser mit **WebGL2** (für die Float-Render-Targets der
GI-Akkumulation).

---

## Was zeigt welcher Modus?

| Modus | Technik | Charakteristische Effekte |
|-------|---------|---------------------------|
| **Phong** | three.js-Rasterisierung, `MeshPhongMaterial`, kein ambienter Term | Direkte Beleuchtung pro Fläche, **harte Schatten** (ShadowMap), **kein** Color Bleeding, keine echten Spiegelungen |
| **Raytracing** | GLSL-Shader auf Fullscreen-Quad, Whitted-Style | **Spiegelung** der farbigen Wände auf der Kugel, **harte Schatten** durch Schattenstrahlen, Abbruch nach `N` Reflexionen, **kein** Color Bleeding |
| **Radiosity** | GLSL-Path-Tracer mit progressiver Akkumulation | **Color Bleeding** (rote/grüne Wand färben weiße Flächen), **weiche Schatten**, indirekte diffuse Beleuchtung |

Der entscheidende Vergleich für die Klausuraufgabe c): **Color Bleeding ist im
Radiosity-Modus deutlich sichtbar und in Phong/Raytracing nachweislich abwesend.**
Über die **Vergleichsansicht** (Split-Screen-Wischer) lassen sich z. B.
Raytracing und Radiosity direkt nebeneinander stellen.

---

## Die Szene (Cornell Box)

Geschlossener Würfelraum von `(-1,-1,-1)` bis `(1,1,1)`, Vorderwand offen:

- **Linke Wand:** grün `(0,1,0)` · **Rechte Wand:** rot `(1,0,0)`
- **Decke / Boden / Rückwand:** weiß `(1,1,1)`
- **Flächenlicht** mittig an der Decke, Farbe umschaltbar **weiß / gelb / türkis**
- **Diffuse Säule** (leicht gedreht) — zeigt Schatten und Color Bleeding
- **Spiegelnde Kugel** — zeigt im Raytracing die Reflexionen der Wände

Alle drei Modi lesen die Geometrie aus **derselben Quelle** (`SCENE` in
[`src/scene.js`](src/scene.js)) — die three.js-Meshes und die Shader-Uniforms
stammen aus identischen Zahlen, damit alle Verfahren garantiert dieselbe Szene
rendern.

---

## Bedienung (lil-gui-Panel)

- **Render-Modus:** Phong / Raytracing / Radiosity
- **Vergleich (Split):** zwei Modi nebeneinander; der Trenner wird mit der Maus
  gezogen. „… rechte Hälfte" wählt den zweiten Modus.
- **Lichtfarbe:** weiß / gelb / türkis
- **Shininess (Kugel):** spekularer Exponent
- **Reflexionstiefe N:** Rekursionsabbruch des Raytracers (Default **3**)
- **Shading:** Flat / Gouraud / Phong (Demonstration der Normalen-Interpolation)
- **Normalen anzeigen:** blendet die Flächen-/Eckpunktnormalen als gelbe Pfeile ein
- **Kamera:** Maus zum Drehen/Zoomen (OrbitControls)

Bei Kamera- oder Parameteränderung startet die GI-Akkumulation neu; für ein
rauschfreies Radiosity-Bild die Kamera kurz ruhig halten.

---

## Bezug zu den Computergrafik-Konzepten (wo steht was im Code?)

Die theoretisch relevanten Stellen sind im Code ausführlich kommentiert:

| Konzept | Datei / Stelle |
|---------|----------------|
| **Phong-Formel** `Lichtfarbe ⊙ M ⊙ (max(0,L·N) + (R·V)^shininess)` | [`src/shaders/raytrace.frag`](src/shaders/raytrace.frag) → `shadePhong()`; im Modus 1 über `MeshPhongMaterial` |
| **Kein ambienter Term** | [`src/scene.js`](src/scene.js) (keine `AmbientLight`), [`src/main.js`](src/main.js) |
| **Reflektanzvektor R** | `reflect(-L, N)` in `shadePhong()` bzw. `reflect(rd, normal)` für den Sekundärstrahl |
| **Schattenstrahl / harte Schatten** | [`src/shaders/scene_common.glsl`](src/shaders/scene_common.glsl) → `occluded()` |
| **Reflexion + Abbruch nach N** | [`src/shaders/raytrace.frag`](src/shaders/raytrace.frag) → Schleife mit `b > uMaxBounces` |
| **Color Bleeding (indirekte diffuse Reflexion)** | [`src/shaders/pathtrace.frag`](src/shaders/pathtrace.frag) → `cosineSampleHemisphere()` + `throughput *= h.color` |
| **Direktlicht-Sampling (Flächenlicht)** | [`src/shaders/pathtrace.frag`](src/shaders/pathtrace.frag) → `sampleLight()` (Next Event Estimation) |
| **Flächen- vs. Eckpunktnormalen** | [`src/utils/normalsHelper.js`](src/utils/normalsHelper.js) |
| **Analytische Schnitttests** (Ebene/Box/Kugel) | [`src/shaders/scene_common.glsl`](src/shaders/scene_common.glsl) |

### Modus 3 — gewählte Variante

Umgesetzt ist **Variante A** der Aufgabenstellung: *Progressive
Path-Tracing-Akkumulation* (Monte-Carlo, cosinus-gewichtetes Hemisphären-
Sampling, Mittelung mehrerer Frames in einem Float-Render-Target). Der
Color-Bleeding-Effekt entsteht physikalisch korrekt dadurch, dass diffus
gestreute Strahlen die Farbe der zuvor getroffenen Wand mittragen
(`throughput *= Materialfarbe`). Zur Beschleunigung und für sauberere weiche
Schatten wird an jedem diffusen Treffer zusätzlich direkt ein Punkt auf dem
Flächenlicht gesampelt (Next Event Estimation).

---

## Projektstruktur

```
cornell-box/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.js                 # Setup, Render-Loop, Modus-/Vergleichs-Verwaltung
    ├── scene.js                # Cornell-Box-Geometrie, Materialien, Licht (Single Source of Truth)
    ├── controls/
    │   └── gui.js              # lil-gui-Panel (alle Parameter)
    ├── modes/
    │   ├── phongMode.js        # Modus 1 + Shading-Umschaltung + Normalen-Toggle
    │   ├── raytraceMode.js     # Modus 2 (Shader-Setup, Uniforms)
    │   ├── radiosityMode.js    # Modus 3 (Path-Tracer + Akkumulation)
    │   └── commonUniforms.js   # geteilte Uniforms beider Shader-Modi
    ├── shaders/
    │   ├── fullscreen.vert     # Fullscreen-Quad-Vertexshader
    │   ├── scene_common.glsl   # geteilte Schnitttests, Schattentest, Kamerastrahl
    │   ├── raytrace.frag       # GLSL-Raytracer (Modus 2)
    │   └── pathtrace.frag      # GLSL-GI/Path-Tracer (Modus 3, Variante A)
    └── utils/
        ├── normalsHelper.js    # Normalen ein-/ausblenden
        └── compare.js          # Split-Screen-Vergleich (Wischer)
```

---

## Bewusste Vereinfachungen

- **Harte Schatten im Phong-Modus** über three.js-`ShadowMap` (statt physikalisch
  korrekter Flächenlicht-Schatten) — klar als Vereinfachung gekennzeichnet.
- Im Phong-/Raytracing-Modus wird das Flächenlicht als **Punktlicht** in seiner
  Mitte behandelt (laut Aufgabenstellung zulässig); nur der Path-Tracer nutzt das
  echte Flächenlicht.
- **Gouraud-Shading** wird über `MeshLambertMaterial` (Beleuchtung pro Vertex)
  demonstriert; es enthält daher kein spekulares Glanzlicht.
- Die GI-Akkumulation rendert intern in **75 % Auflösung**, damit das Bild
  flüssig konvergiert.
