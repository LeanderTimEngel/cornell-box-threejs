# Technische Dokumentation

Kurzer Überblick über den Aufbau des Projekts: was die drei Render-Modi machen,
wie der Code organisiert ist und welche Umsetzungsentscheidungen dahinterstecken.

---

## 1. Überblick

Die Anwendung rendert **dieselbe Szene** — eine Cornell Box — mit drei
unterschiedlichen Beleuchtungsverfahren und macht sie direkt vergleichbar. Ziel
ist, die Unterschiede sichtbar zu machen, vor allem das **Color Bleeding**
(das Abfärben der farbigen Wände auf weiße Flächen).

Es ist eine reine Browser-Anwendung ohne Framework: ES-Module, three.js und
eigene GLSL-Shader. Vite dient nur als Build-Werkzeug.

---

## 2. Die drei Render-Modi

| Modus | Technik | Was man sieht |
|---|---|---|
| **1 — Phong** | three.js-Rasterisierung mit `MeshPhongMaterial` | Nur direkte Beleuchtung. Harte Schatten über Shadow Map, **kein** Color Bleeding, keine echten Spiegelungen. |
| **2 — Raytracing** | Eigener GLSL-Fragment-Shader auf einem Fullscreen-Quad | Pro Pixel ein Strahl in die Szene. Die Kugel **spiegelt** die farbigen Wände, harte Schatten über Schattenstrahlen, Abbruch nach `N` Reflexionen. Weiterhin **kein** Color Bleeding. |
| **3 — Radiosity / GI** | Eigener GLSL-Path-Tracer mit Frame-Akkumulation | Auch **indirektes** Licht: **Color Bleeding**, weiche Schatten, aufgehellte Schattenbereiche. |

Der Kern der Aussage: Phong beleuchtet jede Fläche unabhängig, Raytracing ergänzt
nur **spiegelnde** Sekundärstrahlen — erst das Path Tracing verfolgt auch
**diffus** gestreute Strahlen weiter, und genau dadurch entsteht Color Bleeding.

---

## 3. Die Szene

Geschlossener Würfelraum von `(-1,-1,-1)` bis `(1,1,1)`, Vorderwand offen:

- Linke Wand **grün**, rechte Wand **rot**, Boden/Decke/Rückwand **weiß**
- **Flächenlicht** mittig an der Decke (weiß / gelb / türkis umschaltbar)
- Eine **diffuse, leicht gedrehte Säule** und eine **spiegelnde Kugel**
- **Kein ambienter Term** — unbeleuchtete Bereiche sind wirklich schwarz

Alle Zahlen stehen **einmal** im Objekt `SCENE` in `src/scene.js`. Daraus werden
sowohl die three.js-Objekte gebaut als auch die Shader-Uniforms gefüllt — so ist
sichergestellt, dass alle drei Modi wirklich dieselbe Szene zeigen.

---

## 4. Aufbau des Codes

```
index.html                  UI-Markup + komplettes CSS
src/
├── main.js                 Setup, Zustand, Render-Loop, Modus-Auswahl
├── scene.js                Geometriewerte (SCENE) + Bau der three.js-Objekte
├── controls/
│   ├── gui.js              verbindet die Panel-Elemente mit den Callbacks
│   └── overlay.js          Info-Karte + GI-Konvergenz-Anzeige
├── modes/
│   ├── phongMode.js        Modus 1, Shading-Umschaltung, Normalen-Anzeige
│   ├── raytraceMode.js     Modus 2 (Shader-Material + Uniforms)
│   ├── radiosityMode.js    Modus 3 (Path-Tracer + Akkumulation)
│   └── commonUniforms.js   Uniforms, die Modus 2 und 3 teilen
├── shaders/
│   ├── fullscreen.vert     Vertexshader für den Fullscreen-Quad
│   ├── scene_common.glsl   Schnitttests + Schattentest (von 2 und 3 geteilt)
│   ├── raytrace.frag       Raytracer (Modus 2)
│   └── pathtrace.frag      Path-Tracer (Modus 3)
└── utils/
    ├── normalsHelper.js    Normalen ein-/ausblenden
    └── compare.js          Split-Screen-Vergleich
```

**Aufgabenteilung:**

- **`main.js`** hält Renderer, Kamera und OrbitControls, die sich alle drei Modi
  teilen. Es besitzt den zentralen Zustand `params` und die Render-Loop.
- **Jeder Modus** ist ein eigenes Modul mit einer `render()`-Methode. Der
  Radiosity-Modus hat zusätzlich `accumulate()`, `reset()` und `getFrame()`, weil
  er als einziger Zustand verwaltet.
- **`scene_common.glsl`** wird beim Laden vor `raytrace.frag` bzw.
  `pathtrace.frag` gehängt. Beide Shader nutzen also dieselben Schnitttests.
- **`controls/`** enthält alles, was DOM ist — die Render-Logik weiß davon nichts.

---

## 5. Zustand und Bedienung

Der gesamte Zustand steckt in **einem** Objekt `params` (Modus, Vergleich an/aus,
Lichtfarbe, Shininess, Reflexionstiefe, Shading, Normalen). Geändert wird er
ausschließlich über das `api`-Objekt in `main.js`: Jeder Setter schreibt den
neuen Wert nach `params` und löst die nötigen Seiteneffekte aus (Material
tauschen, GI-Akkumulation zurücksetzen, Info-Karte neu schreiben).

Die Render-Modi **lesen** nur aus `params`. Dadurch gibt es keine doppelte
Wahrheit. Das Bedien-Panel kennt nur das `api`, nicht die Render-Logik.

---

## 6. Umsetzungsdetails

**Fullscreen-Quad (Modus 2 & 3).** Ein Rechteck, das den ganzen Bildschirm
abdeckt. Der Fragment-Shader löst für jeden Pixel die komplette Szene; three.js
wird nur noch benutzt, um den Shader laufen zu lassen und die Uniforms zu füllen.

**Progressive Akkumulation (Modus 3).** Ein einzelner Path-Tracing-Durchlauf ist
stark verrauscht. Deshalb wird pro Frame ein neues Sample gezogen und in einem
**Float-Render-Target** aufaddiert; angezeigt wird die Summe geteilt durch die
Frame-Zahl. Da ein Shader nicht in die Textur schreiben kann, aus der er liest,
wechseln zwei Targets im **Ping-Pong** ab. Sobald sich Kamera oder ein Parameter
ändert, startet die Akkumulation neu.

**Split-Screen.** Der Vergleich rendert beide Modi in dasselbe Bild und begrenzt
sie per **Scissor-Test** auf je eine Hälfte. Die GI-Akkumulation läuft dabei
bewusst **vorher und ohne Scissor** ab — sonst würde nur eine Bildhälfte
akkumulieren.

**Farbe.** Beleuchtung wird linear gerechnet. In Modus 1 wandelt three.js
automatisch nach sRGB um; die eigenen Shader in Modus 2 und 3 tun das am Ende von
Hand, damit alle drei Modi gleich hell wirken.

**Shading-Umschaltung.** Für Flat/Gouraud/Phong tauscht `phongMode.js` die
Materialien aus (`flatShading` bzw. `MeshLambertMaterial` für die
Vertex-Beleuchtung). Die Ausgangswerte werden einmalig gesichert, damit beim
Wechsel keine Farben verloren gehen.

---

## 7. Performance

- Die Szene ist statisch, deshalb wird die **Shadow Map nur einmal gebacken**.
- Der Path Tracer rendert intern in **75 %** der Fenstergröße, damit er flüssig
  konvergiert.
- An jedem diffusen Treffer wird das Flächenlicht **direkt gesampelt**, statt auf
  zufällige Lichttreffer zu warten — das Bild ist dadurch viel früher brauchbar.
- Einzelne extrem helle Ausreißer-Pfade werden begrenzt, sonst entstehen grelle
  Pixel.
- DOM-Schreibvorgänge und Fenstermaße werden nicht pro Frame angefasst.

---

## 8. Starten und Bauen

```bash
npm install
npm run dev      # Dev-Server
npm run build    # erzeugt dist/
```

Voraussetzung ist ein Browser mit **WebGL2** (für die Float-Render-Targets der
Akkumulation). Einzige Laufzeit-Abhängigkeit ist three.js; Details dazu in
[QUELLEN.md](QUELLEN.md).
