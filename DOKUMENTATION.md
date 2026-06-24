# Technische Dokumentation — Cornell Box Rendering-Vergleich

> Ausführliche Erklärung des Projekts: die zugrunde liegenden Computergrafik-
> Konzepte, der genaue Code-Aufbau, die verwendete Mathematik und die
> Implementierungsentscheidungen.

Diese Dokumentation richtet sich an Leser, die **verstehen** wollen, *warum* die
drei Renderingverfahren so unterschiedliche Bilder erzeugen und *wie* das im Code
umgesetzt ist. Sie ist bewusst sehr detailliert.

---

## Inhaltsverzeichnis

1. [Was macht das Projekt?](#1-was-macht-das-projekt)
2. [Die theoretischen Grundlagen](#2-die-theoretischen-grundlagen)
   - 2.1 [Das lokale Phong-Beleuchtungsmodell](#21-das-lokale-phong-beleuchtungsmodell)
   - 2.2 [Schatten](#22-schatten)
   - 2.3 [Raytracing (Whitted-Style)](#23-raytracing-whitted-style)
   - 2.4 [Die Rendering-Gleichung & Global Illumination](#24-die-rendering-gleichung--global-illumination)
   - 2.5 [Color Bleeding — der zentrale Effekt](#25-color-bleeding--der-zentrale-effekt)
   - 2.6 [Flächen- vs. Eckpunktnormalen, Flat/Gouraud/Phong](#26-flächen--vs-eckpunktnormalen-flatgouraudphong)
3. [Architektur des Codes](#3-architektur-des-codes)
4. [Datei für Datei](#4-datei-für-datei)
5. [Die Mathematik der Schnitttests](#5-die-mathematik-der-schnitttests)
6. [Die drei Render-Modi im Code](#6-die-drei-render-modi-im-code)
7. [Die Progressive-Akkumulation (Ping-Pong)](#7-die-progressive-akkumulation-ping-pong)
8. [Farbe, Gamma und Tone-Mapping](#8-farbe-gamma-und-tone-mapping)
9. [Bedienoberfläche & Zustandsverwaltung](#9-bedienoberfläche--zustandsverwaltung)
10. [Performance-Entscheidungen](#10-performance-entscheidungen)
11. [Build, Deployment & Abhängigkeiten](#11-build-deployment--abhängigkeiten)
12. [Bezug zur Klausuraufgabe](#12-bezug-zur-klausuraufgabe)

---

## 1. Was macht das Projekt?

Das Projekt rendert **dieselbe Szene** — eine *Cornell Box* — mit drei völlig
unterschiedlichen Beleuchtungs-/Renderingverfahren und stellt sie direkt
gegenüber. Die Cornell Box ist ein klassisches Referenzmodell der
Computergrafik: ein geschlossener Würfelraum mit einer **grünen** und einer
**roten** Wand, weißem Boden/Decke/Rückwand, einem Flächenlicht an der Decke und
ein paar Objekten darin. Sie ist deshalb so beliebt, weil man an ihr die
Unterschiede zwischen Beleuchtungsmodellen *sofort sieht* — besonders das
**Color Bleeding** (das Abfärben der farbigen Wände auf weiße Flächen).

Die drei Modi:

| Modus | Verfahren | Kernaussage |
|-------|-----------|-------------|
| **1 — Phong** | Lokale Beleuchtung (Rasterisierung) | Jede Fläche wird nur direkt beleuchtet. Kein Lichtaustausch zwischen Flächen. |
| **2 — Raytracing** | Whitted-Raytracing im Shader | Zusätzlich *spiegelnde* Reflexionen und exakte harte Schatten — aber kein diffuser Lichtaustausch. |
| **3 — Radiosity/GI** | Monte-Carlo-Path-Tracing | Voller diffuser Lichtaustausch → **Color Bleeding**, weiche Schatten. |

Bedienbar über ein Panel: Modus-Umschalter, Split-Screen-Vergleich, Lichtfarbe,
Shininess, Reflexionstiefe, Shading-Modus und Normalen-Anzeige.

---

## 2. Die theoretischen Grundlagen

### 2.1 Das lokale Phong-Beleuchtungsmodell

Das **lokale** Beleuchtungsmodell heißt „lokal", weil die Helligkeit eines
Punktes **nur** von seiner eigenen Position, seiner Normalen, dem Material und
den **Lichtquellen** abhängt — *nicht* von anderen Objekten in der Szene.
Andere Objekte können höchstens Schatten werfen (wenn man Schatten separat
hinzufügt), aber sie können **kein Licht zurückwerfen**. Das ist der
entscheidende Unterschied zur globalen Beleuchtung.

Die in diesem Projekt verwendete Phong-Formel (entsprechend der Klausurvorgabe)
für die Farbe an einem Punkt mit Materialfarbe `M`:

```
Farbe = Lichtfarbe ⊙ M ⊙ ( max(0, L·N)  +  (R·V)^shininess )
                            └── diffus ──┘   └─── spekular ───┘
```

Dabei ist:

- `⊙` die **komponentenweise** Multiplikation (Rot mit Rot, Grün mit Grün,
  Blau mit Blau). Eine grüne Wand `(0,1,0)` unter weißem Licht `(1,1,1)` bleibt
  grün; unter gelbem Licht `(1,1,0)` ebenfalls grün, weil `(1,1,0)⊙(0,1,0) =
  (0,1,0)`.
- **`N`** die Flächennormale (Einheitsvektor senkrecht zur Oberfläche).
- **`L`** der normierte Vektor vom Oberflächenpunkt **zur Lichtquelle**.
- **Diffuser Term `max(0, L·N)`**: Das Skalarprodukt `L·N` ist der Cosinus des
  Winkels zwischen Licht und Normale (Lambertsches Gesetz). Steht das Licht
  senkrecht über der Fläche (`L = N`), ist `L·N = 1` (volle Helligkeit). Steht
  es flach, geht es gegen 0. Das `max(0,…)` verhindert negative Beleuchtung auf
  abgewandten Flächen.
- **`R`** der **Reflektanzvektor**: `L` an der Normalen `N` gespiegelt, also die
  Richtung, in die ein perfekter Spiegel das Licht werfen würde:
  `R = 2·(N·L)·N − L`.
- **`V`** der Vektor vom Punkt **zum Auge** (Kamera).
- **Spekularer Term `(R·V)^shininess`**: groß, wenn der Blick fast genau in die
  Spiegelrichtung schaut → erzeugt das **Glanzlicht**. Der Exponent `shininess`
  steuert die Schärfe: kleine Werte = breiter, matter Glanz; große Werte =
  kleiner, scharfer Glanzpunkt.

**Wichtig — kein ambienter Term:** Üblicherweise enthält Phong noch einen
konstanten *ambienten* Summanden, der abgewandte/unbeleuchtete Bereiche
aufhellt (eine grobe Näherung für indirektes Licht). Die Aufgabenstellung
verlangt **ambienter Term = 0**. Dadurch werden Bereiche im Schatten oder ohne
direkte Beleuchtung **komplett schwarz** — das macht den Unterschied zur GI
besonders deutlich.

Im Projekt steckt diese Formel an zwei Stellen:
- **Modus 1** überlässt sie three.js: `MeshPhongMaterial` rechnet genau diese
  Formel pro Fragment (ohne `AmbientLight` → kein ambienter Term).
- **Modus 2** rechnet sie selbst im Shader — siehe `shadePhong()` in
  `raytrace.frag`.

### 2.2 Schatten

Ein Punkt liegt im **Schatten**, wenn zwischen ihm und der Lichtquelle ein
anderes Objekt liegt. Es gibt zwei grundverschiedene Techniken:

- **Shadow Mapping (Modus 1):** Die Szene wird zuerst **aus Sicht der
  Lichtquelle** in eine Tiefenkarte gerendert. Beim eigentlichen Rendern prüft
  man pro Pixel, ob der Punkt weiter vom Licht entfernt ist als der in der
  Tiefenkarte gespeicherte nächste Punkt — wenn ja, liegt er im Schatten. Das
  ist eine **Rasterisierungs-Technik**, schnell, aber mit Auflösungsartefakten.
  three.js erledigt das über `renderer.shadowMap`.
- **Schattenstrahlen / Shadow Rays (Modus 2 & 3):** Vom Oberflächenpunkt wird
  ein Strahl **direkt zur Lichtquelle** geschossen. Trifft er unterwegs ein
  Objekt, ist der Punkt im Schatten. Das ist **exakt** (keine
  Auflösungsartefakte) und fällt im Raytracer praktisch „gratis" ab — siehe
  `occluded()` in `scene_common.glsl`.

Harte Schatten (scharfe Kante) entstehen bei einer **punktförmigen**
Lichtquelle. Weiche Schatten (mit Halbschatten) entstehen bei einer
**Flächenlichtquelle**, weil der Rand teilweise verdeckt ist — das passiert im
Path Tracer automatisch, weil dort über die Lichtfläche gesampelt wird.

### 2.3 Raytracing (Whitted-Style)

Beim **Raytracing** wird der Sehstrahl *umgekehrt* verfolgt: Statt Licht von der
Quelle zu simulieren, schießt man pro Pixel einen **Primärstrahl** von der
Kamera in die Szene und fragt: „Was sieht dieser Strahl?"

Der klassische **Whitted-Algorithmus** (1980) macht an jedem Treffer:

1. **Lokale Beleuchtung** mit der Phong-Formel (direkter Lichtanteil).
2. **Schattenstrahl** zum Licht → bestimmt, ob der diffuse/spekulare Anteil
   überhaupt gilt (harte Schatten).
3. Ist die Oberfläche **spiegelnd**, wird ein **Reflexionsstrahl** in
   Spiegelrichtung `R = D − 2(D·N)N` weiterverfolgt (rekursiv).
4. **Abbruch** nach einer maximalen Rekursionstiefe `N` (sonst würde ein Strahl
   zwischen zwei Spiegeln unendlich hin- und herspringen). Standard hier: `N=3`.

Bei jeder Reflexion wird die **Materialfarbe der getroffenen Fläche
einmultipliziert** — eine leicht getönte Spiegelkugel färbt das Spiegelbild
entsprechend ein. Dieses „Einmultiplizieren" entspricht im Code dem
`throughput *= Materialfarbe`.

Was Whitted-Raytracing **nicht** kann: diffuses Licht zwischen Flächen
austauschen. Eine matte rote Wand wirft zwar diffuses Licht ab, aber der
klassische Raytracer verfolgt von matten Flächen *keine* weiteren Strahlen.
Deshalb: **Spiegelungen ja, Color Bleeding nein.**

### 2.4 Die Rendering-Gleichung & Global Illumination

Alles Licht in einer Szene beschreibt die **Rendering-Gleichung** (Kajiya 1986).
Das von einem Punkt `x` in Richtung `ω_o` ausgehende Licht ist:

```
L_o(x, ω_o) = L_e(x, ω_o)  +  ∫  f_r(x, ω_i, ω_o) · L_i(x, ω_i) · (ω_i · n) dω_i
              └ Eigenleucht. ┘   └──────────── Integral über alle Einfallsrichtungen ─────────┘
```

In Worten: Das ausgehende Licht ist das **Eigenleuchten** `L_e` (nur bei
Lichtquellen ≠ 0) plus die Summe **allen einfallenden Lichts** `L_i` aus der
Hemisphäre über `x`, jeweils gewichtet mit der Materialreflexion `f_r` (BRDF)
und dem Cosinus `(ω_i·n)`.

Der Knackpunkt: `L_i(x, ω_i)` ist selbst wieder ein `L_o` einer **anderen**
Fläche — die Gleichung ist **rekursiv** und steckt das gesamte indirekte Licht
in sich. Genau dieser indirekte Anteil fehlt im lokalen Modell und im
Whitted-Raytracer.

**Global Illumination (GI)** löst diese Gleichung näherungsweise. Dieses Projekt
nutzt **Monte-Carlo-Path-Tracing** (Variante A der Aufgabenstellung):

- Statt das Integral analytisch zu lösen, wird es **statistisch geschätzt**: An
  jedem diffusen Treffer wird **eine zufällige** Weiterrichtung gewürfelt (nicht
  alle), der Pfad weiterverfolgt und das Ergebnis gemittelt.
- Die Richtungen werden **cosinus-gewichtet** über der Hemisphäre gezogen
  (häufiger nahe der Normalen, wo das `(ω_i·n)` groß ist). Das ist
  *Importance Sampling* und reduziert das Rauschen.
- Ein einzelner Pfad liefert ein extrem verrauschtes Bild. Erst die **Mittelung
  über viele Frames** (progressive Akkumulation) lässt das Bild **konvergieren**
  — das Rauschen sinkt mit `1/√(Anzahl Samples)`.

### 2.5 Color Bleeding — der zentrale Effekt

**Color Bleeding** heißt: Eine farbige Fläche **färbt benachbarte Flächen ein**.
In der Cornell Box färbt die rote Wand den Boden und die Säule rötlich, die
grüne Wand grünlich.

Warum passiert das physikalisch? Licht trifft die rote Wand, wird dort diffus
gestreut und trägt dabei die **rote Materialfarbe** mit. Trifft dieses bereits
rot gefärbte Licht danach den weißen Boden, hellt es ihn **rot** auf.

Im Code passiert das in `pathtrace.frag` in genau **einer Zeile**:

```glsl
throughput *= h.color;   // <-- hier entsteht das Color Bleeding
```

`throughput` ist die akkumulierte Farbe entlang des Pfades. Jedes Mal, wenn der
Pfad eine diffuse Fläche trifft, wird deren Materialfarbe einmultipliziert. Ein
Pfad, der über die rote Wand zum Boden läuft, hat dort `throughput` mit einem
roten Faktor — der Boden bekommt also einen roten Beitrag.

**Warum fehlt das in Modus 1 & 2?**
- Modus 1 (Phong) verfolgt **gar keine** Strahlen von Flächen weiter — `L_i`
  kommt ausschließlich direkt von der Lichtquelle.
- Modus 2 (Whitted) verfolgt nur **spiegelnde** Strahlen weiter, **keine
  diffusen**. Der rote Boden-Beitrag käme aber von einer *diffusen*
  Weiterstreuung an der Wand — die findet nicht statt.

Genau diese Gegenüberstellung ist der didaktische Kern des Projekts und lässt
sich im Split-Screen direkt zeigen.

### 2.6 Flächen- vs. Eckpunktnormalen, Flat/Gouraud/Phong

Normalen bestimmen, wie eine Fläche beleuchtet wird. Man unterscheidet:

- **Flächennormalen (Face Normals):** eine Normale pro Dreieck/Fläche. Eine
  Box hat pro Seite genau eine Normale → die Box wirkt facettiert.
- **Eckpunktnormalen (Vertex Normals):** eine Normale pro Eckpunkt, über die
  Fläche **interpoliert**. Eine Kugel aus vielen Dreiecken wirkt damit **glatt**,
  obwohl sie geometrisch eckig ist.

Davon hängen die drei **Shading-Verfahren** ab, die das Projekt im Phong-Modus
demonstriert:

- **Flat-Shading:** eine Normale pro Dreieck, Beleuchtung einmal pro Dreieck →
  sichtbare Facetten. (`material.flatShading = true`.)
- **Gouraud-Shading:** Beleuchtung wird **pro Eckpunkt** berechnet und die
  *Farbe* über das Dreieck interpoliert. Glatt, aber Glanzlichter können
  „verschluckt" werden. Im Projekt über `MeshLambertMaterial` (rein diffus,
  vertex-basiert).
- **Phong-Shading:** die *Normale* wird pro Fragment interpoliert und die
  Beleuchtung **pro Pixel** berechnet → glatte, korrekte Glanzlichter.
  (`MeshPhongMaterial`.)

> Achtung Begriffsverwirrung: **Phong-*Beleuchtungsmodell*** (die Formel aus 2.1)
> und **Phong-*Shading*** (Normaleninterpolation pro Fragment) sind zwei
> verschiedene Dinge, die beide von Bui Tuong Phong stammen.

Der Normalen-Toggle (`VertexNormalsHelper`) zeichnet die tatsächlich von
three.js verwendeten Normalen als gelbe Pfeile — an der Kugel als radialer
Fächer (Eckpunktnormalen), an Box/Wänden als wenige, senkrechte Pfeile
(Flächennormalen).

---

## 3. Architektur des Codes

Die Anwendung ist eine **Single-Page-App** ohne Framework: reines ES-Modul-
JavaScript + three.js + GLSL-Shader. Vite ist nur Build-Tool/Dev-Server.

**Leitidee:** Alle drei Modi teilen sich **einen** Renderer, **eine** Kamera und
**eine** OrbitControls-Instanz. Sie unterscheiden sich nur darin, *wie* sie ein
Bild erzeugen:

```
                         ┌──────────────────────────────────────────┐
                         │                main.js                    │
                         │  Renderer · Kamera · OrbitControls        │
                         │  zentraler Zustand `params`               │
                         │  Render-Loop + Modus-Auswahl              │
                         └───────┬───────────┬───────────┬───────────┘
                                 │           │           │
                  ┌──────────────┘           │           └──────────────┐
                  ▼                          ▼                          ▼
          ┌──────────────┐         ┌──────────────────┐       ┌──────────────────┐
          │ phongMode.js │         │ raytraceMode.js  │       │ radiosityMode.js │
          │ three.js-    │         │ GLSL-Shader auf  │       │ GLSL-Path-Tracer │
          │ Rasterisierung│        │ Fullscreen-Quad  │       │ + Akkumulation   │
          └──────┬───────┘         └────────┬─────────┘       └────────┬─────────┘
                 │                          │                          │
                 │                          ▼                          ▼
                 │                 ┌───────────────────────────────────────────┐
                 │                 │ shaders/scene_common.glsl (geteilt)        │
                 │                 │ Schnitttests · Schattentest · Kamerastrahl │
                 │                 └───────────────────────────────────────────┘
                 ▼                                   ▲
          ┌─────────────────────────────────────────┴───┐
          │ scene.js — SCENE (numerische Geometriewerte) │
          │ "Single Source of Truth" für ALLE Modi       │
          └──────────────────────────────────────────────┘
```

**Die wichtigste Architektur-Entscheidung:** Die Geometrie (Box, Säule, Kugel,
Licht) ist als **ein** Objekt `SCENE` in `scene.js` definiert. Sowohl die
three.js-Meshes (für Modus 1) als auch die Shader-Uniforms (für Modus 2/3) lesen
aus diesen exakt gleichen Zahlen. Dadurch rendern alle drei Modi garantiert
**dieselbe** Szene — es kann keine Abweichung „einschleichen".

**Mode-Interface:** Jeder Modus stellt eine Methode `render()` bereit. Der
Radiosity-Modus hat zusätzlich `accumulate()`, `reset()`, `setSize()` und
`getFrame()`, weil er Zustand (akkumulierte Frames) verwaltet. Der generische
Aufruf in der Render-Loop ist immer `modes[params.modus].render()`.

---

## 4. Datei für Datei

```
cornell-box/
├── index.html              UI-Markup + komplettes CSS (Panel, Info-Karten)
├── package.json            Abhängigkeiten (nur three + vite)
├── vite.config.js          Build-Konfiguration (base-Pfad für GitHub Pages)
├── README.md               Kurzüberblick & Schnellstart
├── DOKUMENTATION.md        (diese Datei)
└── src/
    ├── main.js             Einstiegspunkt, Setup, Render-Loop, Zustand, Modus-Auswahl
    ├── scene.js            SCENE-Werte + Bau der three.js-Cornell-Box
    ├── controls/
    │   └── gui.js          Verdrahtung der Panel-Elemente mit den Callbacks
    ├── modes/
    │   ├── phongMode.js    Modus 1 + Shading-Umschaltung + Normalen-Toggle
    │   ├── raytraceMode.js Modus 2 (Shader-Material + Uniforms)
    │   ├── radiosityMode.js Modus 3 (Path-Tracer + Ping-Pong-Akkumulation)
    │   └── commonUniforms.js  Uniforms, die Modus 2 & 3 teilen
    ├── shaders/
    │   ├── fullscreen.vert  Vertexshader für den Fullscreen-Quad
    │   ├── scene_common.glsl  Schnitttests, Schattentest, Kamerastrahl (geteilt)
    │   ├── raytrace.frag    Whitted-Raytracer (Modus 2)
    │   └── pathtrace.frag   Path-Tracer mit NEE & Akkumulation (Modus 3)
    └── utils/
        ├── normalsHelper.js  erzeugt die VertexNormalsHelper
        └── compare.js        Split-Screen-Vergleich (Scissor-Test + Wischer)
```

### `scene.js` — die Szene als Single Source of Truth

Exportiert drei Dinge:

- **`COLORS`** und **`LIGHT_COLORS`** — die exakten Farbwerte (grün `(0,1,0)`,
  rot `(1,0,0)`, weiß/gelb/türkis für das Licht).
- **`SCENE`** — ein Objekt mit den **numerischen** Geometrieparametern:
  Box-Grenzen `[-1,1]³`, Lichtgröße/-position, Säulen-Zentrum/-Größe/-Drehung,
  Kugel-Zentrum/-Radius. **Diese Zahlen sind die Wahrheit für alle Modi.**
- **`buildCornellBox()`** — baut aus `SCENE` die three.js-Objekte: fünf Wände
  (als `PlaneGeometry` so rotiert, dass die Normale **nach innen** zeigt), das
  Lichtpaneel (`MeshBasicMaterial`, leuchtet unabhängig von Beleuchtung), ein
  `PointLight` in der Mitte des Flächenlichts (für Schatten), die diffuse Säule
  und die spiegelnde Kugel. Gibt Referenzen auf die veränderlichen Teile zurück
  (Licht, Paneel, Säule, Kugel), damit GUI/Modi sie live anpassen können.

Bewusst: **kein `AmbientLight`** → kein ambienter Term.

### `main.js` — der Dirigent

- Erstellt **Renderer** (mit ShadowMap), **Szene**, **Kamera**, **OrbitControls**.
- Backt die Shadow-Map **einmal** (die Szene ist statisch → `autoUpdate=false`).
- Hält den zentralen Zustand **`params`** (aktueller Modus, Vergleich an/aus,
  Lichtfarbe, Shininess, Reflexionstiefe, Shading, Normalen).
- Instanziiert die drei Modi und die Vergleichs-Hilfe.
- Definiert das **`api`-Objekt**: für jedes Bedienelement eine Setter-Funktion,
  die `params` aktualisiert **und** die nötigen Seiteneffekte auslöst (z. B.
  „GI-Akkumulation zurücksetzen", „Annotation neu schreiben").
- Verwaltet die **Info-Karte** (`updateAnnotation`) und den
  **GI-Konvergenz-Indikator** (`updateGiStatus`).
- Die **Render-Loop** `animate()`:
  1. `controls.update()` — liefert `true`, wenn sich die Kamera bewegt hat →
     dann GI-Akkumulation zurücksetzen.
  2. Wenn Radiosity sichtbar ist: `radiosity.accumulate()` (offscreen, **vor**
     dem Scissor-Block — wichtig, siehe Abschnitt 7).
  3. Entweder Split-Screen (`compare.renderSplit`) oder Einzelbild
     (`modes[params.modus].render()`).

### `controls/gui.js` — Verdrahtung des Panels

Das Panel selbst ist statisches HTML in `index.html`. `gui.js` enthält nur drei
kleine Helfer — `bindSelect`, `bindToggle`, `bindSlider` — die ein
Standard-Formularelement mit dem passenden `api`-Callback verbinden und (bei
Slidern) den Zahlenwert daneben aktualisieren. **Keine UI-Bibliothek.**

### `modes/commonUniforms.js`

`buildCommonUniforms()` legt alle Uniforms an, die **beide** Shader-Modi
brauchen (Kameramatrizen, Lichtfarbe/-position, Kugel- und Säulen-Parameter aus
`SCENE`). `updateCommonUniforms()` kopiert pro Frame die aktuellen
Kameramatrizen hinein. So bleibt die Geometrie in den Shadern automatisch mit
`SCENE` synchron.

(Die einzelnen Modus-Dateien und Shader sind in den Abschnitten 5–7 ausführlich
erklärt.)

### `utils/normalsHelper.js` & `utils/compare.js`

- `normalsHelper.js`: erzeugt pro relevantem Mesh einen `VertexNormalsHelper`
  (gelbe Pfeile), anfangs unsichtbar.
- `compare.js`: erzeugt den verschiebbaren Trenner (DOM-Element mit
  Pointer-Drag) und die `renderSplit()`-Funktion, die per **Scissor-Test** die
  linke und rechte Bildhälfte mit je einem Modus rendert.

---

## 5. Die Mathematik der Schnitttests

Der Kern von Modus 2 & 3 sind **analytische Strahl-Objekt-Schnitttests** in
`scene_common.glsl`. Ein Strahl ist `P(t) = O + t·D` (Ursprung `O`, Richtung
`D`, Parameter `t ≥ 0`). Gesucht ist immer das **kleinste** `t > 0`.

### Strahl ↔ achsenparallele Wand

Eine Wand liegt auf einer konstanten Koordinate, z. B. `x = k`. Einsetzen:

```
O_x + t·D_x = k   →   t = (k − O_x) / D_x
```

Danach prüft man, ob der Trefferpunkt **innerhalb** der Wandgrenzen liegt
(z. B. `y,z ∈ [−1,1]`). Bei der Decke wird zusätzlich getestet, ob der Punkt im
mittigen Licht-Rechteck liegt — dann ist das Material **emissiv** (die
Lichtquelle selbst).

### Strahl ↔ Kugel

Einsetzen in die Kugelgleichung `|P − C|² = r²` mit `oc = O − C` ergibt eine
**quadratische Gleichung** in `t` (für normiertes `D`, also `D·D = 1`):

```
t² + 2·(oc·D)·t + (oc·oc − r²) = 0
```

Mit `b = oc·D` und `c = oc·oc − r²` ist die Diskriminante `disc = b² − c`:

- `disc < 0` → kein Treffer.
- sonst `t = −b − √disc` (der **nähere** Schnittpunkt); liegt der hinter dem
  Ursprung, nimmt man `−b + √disc`.

Die Kugelnormale am Trefferpunkt ist einfach `normalize(P − C)`.

### Strahl ↔ Box (Slab-Methode)

Eine achsenparallele Box ist der Schnitt dreier „Schläuche" (Slabs). Pro Achse
berechnet man die beiden Eintritts-/Austrittsparameter und kombiniert:

```
t1 = (min − O) / D      t2 = (max − O) / D     (komponentenweise)
tmin = max( min(t1,t2) über alle Achsen )
tmax = min( max(t1,t2) über alle Achsen )
Treffer, falls tmin ≤ tmax und tmax > 0
```

Die Box ist getroffen zwischen `tmin` (Eintritt) und `tmax` (Austritt).

### Strahl ↔ gedrehte Box (OBB)

Die Säule ist um 20° gedreht (eine *Oriented Bounding Box*). Trick: Statt die
Box zu drehen, transformiert man **den Strahl** in das lokale,
achsenparallele Koordinatensystem der Box:

1. Ursprung und Richtung um den negativen Drehwinkel zurückdrehen und um das
   Box-Zentrum verschieben (`Rinv · (O − Zentrum)` bzw. `Rinv · D`).
2. Im lokalen System normaler **Slab-Test** gegen die Halb-Maße `±half`.
3. Die lokale Normale ist die Achse mit dem **betragsgrößten** lokalen
   Koordinatenanteil des Trefferpunkts (z. B. `(±1,0,0)`).
4. Die Normale zurück ins Weltsystem drehen (`R · n_lokal`).

Die Rotationsmatrix um die Y-Achse ist:

```
        | cos a   0   sin a |
R(a) =  |   0     1     0   |          Rinv = R(−a)
        |−sin a   0   cos a |
```

### Reflexionsvektor

Beide Shader nutzen für die Spiegelung die GLSL-Funktion `reflect(D, N)`, die
`D − 2·(D·N)·N` berechnet — die Richtung, in der ein perfekter Spiegel den
einfallenden Strahl `D` an der Normalen `N` weiterwirft.

### Cosinus-gewichtetes Hemisphären-Sampling

Für den diffusen Bounce im Path Tracer (`cosineSampleHemisphere`) wird eine
Zufallsrichtung gezogen, deren Wahrscheinlichkeit **proportional zu `cos θ`**
ist (θ = Winkel zur Normalen). Aus zwei Zufallszahlen `u1, u2 ∈ [0,1)`:

```
r = √u1 ,   φ = 2π·u2
lokale Richtung d = ( r·cos φ ,  r·sin φ ,  √(1 − u1) )
```

Diese lokale Richtung wird dann in ein orthonormales System um die Normale
gedreht. Der Clou: Mit dieser Verteilung (PDF = `cos θ / π`) und der diffusen
Lambert-BRDF (`Albedo/π`) **kürzen sich** `cos θ` und `π` weg — übrig bleibt
schlicht `throughput *= Albedo`. Deshalb ist der diffuse Bounce im Code so kurz.

### Flächenlicht-Schätzer (Next Event Estimation)

Statt zu hoffen, dass ein zufälliger Bounce das kleine Deckenlicht zufällig
trifft, sampelt der Path Tracer an jedem diffusen Treffer **direkt** einen Punkt
auf der Lichtfläche (`sampleLight`). Der Monte-Carlo-Schätzer für ein
Flächenlicht (Umrechnung des Raumwinkel-Integrals auf ein Flächenintegral)
lautet:

```
Beitrag = (Albedo/π) · L_e · (cosθ_Fläche · cosθ_Licht) · A / d²
```

mit `A` = Lichtfläche, `d` = Abstand, `θ_Fläche`/`θ_Licht` = Winkel an
Oberfläche bzw. Licht. Vorher wird per Schattenstrahl `occluded()` geprüft, ob
das Licht überhaupt sichtbar ist. Diese **Next Event Estimation** reduziert das
Rauschen drastisch und macht die weichen Schatten und das Color Bleeding schon
nach wenigen Frames erkennbar.

---

## 6. Die drei Render-Modi im Code

### Modus 1 — `phongMode.js`

Nutzt die normale three.js-Pipeline: `renderer.render(scene, camera)`. Die
Beleuchtung macht `MeshPhongMaterial` (Phong-Formel pro Fragment), Schatten die
ShadowMap. Zusätzlich kapselt das Modul:

- **`applyShading(mode)`** — tauscht für **Flat/Gouraud/Phong** die Materialien
  aller Meshes aus. Damit dabei keine Farben verloren gehen, werden die
  Ausgangswerte einmalig in `mesh.userData.base` gesichert (`captureBase`).
  `makeMaterial` baut dann das passende Material: `MeshLambertMaterial` für
  Gouraud (Beleuchtung pro Vertex), sonst `MeshPhongMaterial` mit `flatShading`
  für Flat.
- **`setShininess(v)`** — aktualisiert live die Shininess der Kugel.
- **`setNormalsVisible(v)`** — schaltet die gelben Normalen-Pfeile um.

### Modus 2 — `raytraceMode.js` + `raytrace.frag`

Idee: Ein **Fullscreen-Quad** (eine `PlaneGeometry(2,2)`, die direkt im
Clip-Space liegt) deckt den ganzen Bildschirm ab. Der **Fragment-Shader** löst
für **jeden Pixel** die komplette Szene per Raytracing. three.js wird hier nur
noch benutzt, um den Shader laufen zu lassen (`ShaderMaterial`) und die Uniforms
zu füllen.

Das Fragment-Programm `raytrace.frag` ist die direkte Umsetzung von Abschnitt
2.3:

```glsl
for (int b = 0; b <= HARD_MAX; b++) {
  if (b > uMaxBounces) break;          // Abbruch nach N Reflexionen
  Hit h = intersectScene(ro, rd);      // nächsten Treffer suchen
  if (h.t >= INF) break;               // Strahl verlässt die Box -> schwarz
  if (h.mat == MAT_EMISSIVE) {         // direkt ins Licht geschaut
    radiance += throughput * uLightColor * uLightIntensity; break;
  }
  if (h.mat == MAT_MIRROR && b < uMaxBounces) {
    throughput *= h.color;             // Materialfarbe der Spiegelfläche
    ro = h.pos + h.normal * EPS;       // Reflexionsstrahl starten
    rd = reflect(rd, h.normal); continue;
  }
  radiance += throughput * shadePhong(h, rd);  // diffus: lokal beleuchten + Stop
  break;
}
gl_FragColor = vec4(pow(clamp(radiance,0.,1.), vec3(1./2.2)), 1.0);
```

`shadePhong()` enthält die Phong-Formel inklusive Schattenstrahl
(`occluded`) und einer milden Abstandsabschwächung `1/(1 + 0.35·d²)`, damit die
Box wie bei einem Punktlicht zu den Ecken hin abdunkelt. Glanzlichter bekommt
nur die spiegelnde Kugel.

Der Loop läuft mit einer **konstanten** Obergrenze `HARD_MAX` (WebGL verlangt
konstante Schleifengrenzen) und bricht per `break` ab, sobald die einstellbare
Tiefe `uMaxBounces` erreicht ist.

### Modus 3 — `radiosityMode.js` + `pathtrace.frag`

Derselbe Fullscreen-Quad-Aufbau, aber der Fragment-Shader ist ein **Path
Tracer**. Pro Pixel und Frame wird **ein** zufälliger Pfad verfolgt:

```glsl
for (int depth = 0; depth < MAX_DEPTH; depth++) {
  Hit h = intersectScene(ro, rd);
  if (h.t >= INF) break;
  if (h.mat == MAT_EMISSIVE) {                 // Licht getroffen
    if (prevSpecular) radiance += throughput * uLightColor * uLightEmission;
    break;                                     // (sonst via sampleLight doppelt)
  }
  if (h.mat == MAT_MIRROR) {                    // perfekte Spiegelung
    throughput *= h.color; ro = h.pos + h.normal*EPS;
    rd = reflect(rd, h.normal); prevSpecular = true; continue;
  }
  // diffuse Fläche:
  radiance += throughput * h.color * sampleLight(h.pos, h.normal);  // direktes Licht (NEE)
  throughput *= h.color;                        // <-- COLOR BLEEDING
  rd = cosineSampleHemisphere(h.normal);        // diffus weiterstreuen (indirekt)
  ro = h.pos + h.normal*EPS; prevSpecular = false;
}
```

Wichtige Details:

- **`prevSpecular`** verhindert Doppelzählung: Das Licht wird über `sampleLight`
  (NEE) **und** könnte zufällig direkt getroffen werden. Deshalb zählt der
  Treffer auf die Lichtfläche das Eigenleuchten nur, wenn der letzte Bounce
  **spiegelnd** (oder der Kamerastrahl) war — der diffuse Direktanteil ist
  bereits über `sampleLight` abgedeckt.
- **Firefly-Clamp:** Einzelne extrem helle Pfade (diffus → Spiegelkugel → direkt
  ins Licht) erzeugen grelle Ausreißer-Pixel. `sampleColor = min(sampleColor,
  vec3(3.5))` begrenzt sie (minimaler Bias, deutlich ruhigeres Bild).
- **Sub-Pixel-Jitter:** Der Primärstrahl wird pro Frame leicht versetzt → über
  die Akkumulation entsteht gratis **Anti-Aliasing**.

Das Ergebnis eines Frames ist nur **ein** Sample und stark verrauscht. Die
Glättung erledigt die Akkumulation (nächster Abschnitt).

---

## 7. Die Progressive-Akkumulation (Ping-Pong)

Damit das Path-Tracing-Bild konvergiert, müssen die Samples **vieler Frames
gemittelt** werden. Das Problem: Ein Shader kann nicht in dieselbe Textur
schreiben, aus der er liest. Lösung: **Ping-Pong** zwischen zwei
**Float-Render-Targets** (`rtA`, `rtB`), die die **Summe** aller bisherigen
Samples speichern.

Ablauf in `radiosityMode.js`:

```
accumulate():                          // pro Frame, offscreen
  uPrev = rtA.texture                   // bisherige Summe als Eingang
  render( Pfad-Shader  →  rtB )         // rtB = rtA + neues Sample
  frame += 1
  swap(rtA, rtB)                        // rtA hält jetzt die neue Summe

render():                              // auf den Bildschirm
  zeige rtA · (1 / frame)               // Summe / Anzahl = Mittelwert
                                        // + Gamma im Display-Shader
```

Warum **Float**-Targets (`THREE.FloatType`)? Weil über hunderte Frames eine
große Summe entsteht, die in 8-Bit-Farbkanälen längst übergelaufen/abgeschnitten
wäre. Erst beim Anzeigen wird durch die Frame-Zahl geteilt und mit Gamma
ausgegeben.

**Reset:** Sobald sich Kamera oder ein Parameter ändert (`controls.update()`
liefert `true`, oder ein `api`-Setter ruft `radiosity.reset()`), wird `frame =
0` gesetzt. Sonst würde ein „Nachziehen" alter Frames entstehen.

**Warum `accumulate()` getrennt von `render()` und vor dem Scissor-Block?**
Im Split-Screen begrenzt ein **Scissor-Test** die Ausgabe auf eine Bildhälfte.
Würde die Offscreen-Akkumulation innerhalb dieses Scissor-Bereichs laufen, würde
nur eine Hälfte des Akkumulations-Targets aktualisiert. Deshalb akkumuliert
`main.js` **immer offscreen und ohne Scissor**, bevor die (scissor-begrenzte)
Anzeige gerendert wird.

Der GI-Indikator unten zeigt die aktuelle Sample-Zahl (`getFrame()`); ab ~800
Samples gilt das Bild als praktisch konvergiert.

---

## 8. Farbe, Gamma und Tone-Mapping

Beleuchtung wird **linear** gerechnet (Summen/Produkte von Lichtintensitäten).
Bildschirme erwarten aber **sRGB**-codierte Werte. Wird linear berechnetes Licht
ungewandelt ausgegeben, wirkt das Bild zu dunkel/falsch.

- In **Modus 1** übernimmt three.js die Umwandlung automatisch
  (`renderer.outputColorSpace`).
- In **Modus 2 & 3** geben die selbstgeschriebenen Shader rohe Werte aus —
  deshalb wird dort am Ende von Hand **Gamma** angewandt: `pow(farbe, 1/2.2)`.
  Außerdem werden Werte `> 1` auf `1` geclampt (das Display kann nicht heller als
  Weiß).

So sind alle drei Modi in der Helligkeit vergleichbar.

---

## 9. Bedienoberfläche & Zustandsverwaltung

Der gesamte Zustand steckt in **einem** Objekt `params` in `main.js`. Es gibt
genau **einen** Weg, ihn zu ändern: über das **`api`-Objekt**. Jeder Setter:

1. schreibt den neuen Wert nach `params`,
2. löst Seiteneffekte aus (z. B. Material tauschen, GI zurücksetzen, Annotation
   neu schreiben).

Die Render-Modi **lesen** nur aus `params` (z. B. liest der Raytracer
`params.shininess`/`params.maxBounces` pro Frame in `syncParams`). Dadurch gibt
es keine doppelte Wahrheit und keine Synchronisationsprobleme.

Das **Panel** (`controls/gui.js`) kennt nur das `api` — es ruft bei jeder
Bedienung den passenden Setter auf. Die Logik weiß nichts vom Panel, das Panel
nichts von der Render-Logik. Diese **Entkopplung** macht beides unabhängig
austausch- und testbar.

Zur **UI gehören** außerdem: die Info-Karte oben links (erklärt den aktuellen
Modus, Akzentfarbe je Modus), der Steuerungs-Hinweis unten links und der
GI-Konvergenz-Indikator unten — alle als einfache, mit CSS gestaltete
DOM-Elemente.

---

## 10. Performance-Entscheidungen

- **Shadow-Map nur einmal backen:** Die Szene ist statisch, daher
  `renderer.shadowMap.autoUpdate = false` und einmaliges `needsUpdate = true`.
  Spart pro Frame das Neu-Rendern der Tiefenkarte und vermeidet Scissor-Probleme
  im Split-Screen.
- **GI in reduzierter Auflösung:** Der Path Tracer rendert intern in **75 %**
  der Fenstergröße (`scale = 0.75`), damit die Akkumulation flüssig konvergiert.
- **Firefly-Clamp:** begrenzt Ausreißer-Pfade (siehe Abschnitt 6) — weniger
  Rauschen bei minimalem Bias.
- **Next Event Estimation:** lässt das GI-Bild schon nach wenigen Frames
  brauchbar aussehen, statt auf zufällige Lichttreffer zu warten.
- **Konstante Schleifengrenzen** in den Shadern (`HARD_MAX`, `MAX_DEPTH`), weil
  WebGL keine variablen Schleifenobergrenzen erlaubt; die tatsächliche Tiefe
  steuert ein `break` gegen das Uniform.

---

## 11. Build, Deployment & Abhängigkeiten

- **Entwicklung:** `npm install && npm run dev` startet den Vite-Dev-Server.
- **Build:** `npm run build` erzeugt ein statisches `dist/`. Die GLSL-Dateien
  werden über Vites `?raw`-Import als Strings eingebunden und vor dem Build mit
  dem jeweiligen Main-Shader zusammengehängt (`scene_common.glsl` +
  `raytrace.frag` bzw. `pathtrace.frag`).
- **Hosting:** GitHub Pages aus dem `gh-pages`-Branch. `vite.config.js` setzt
  beim Build den `base`-Pfad `/cornell-box-threejs/`, damit die Asset-Pfade unter
  dem Projekt-Unterpfad stimmen.
- **Laufzeit-Abhängigkeiten:** **nur `three`**. Die Kernalgorithmen (Raytracer,
  Path Tracer, alle Schnitttests) sind selbst in GLSL geschrieben — **kein**
  Pathtracer-Framework. `vite` ist reine Dev-Abhängigkeit. Das Bedien-Panel ist
  pures HTML/CSS/JS.
- **Voraussetzung:** Browser mit **WebGL2** (für die Float-Render-Targets der
  Akkumulation).

---

## 12. Bezug zur Klausuraufgabe

Die kommentierten Code-Stellen decken die typischen Prüfungsfragen ab:

| Frage / Konzept | Wo im Code |
|-----------------|------------|
| Phong-Formel (diffus + spekular, ⊙ Lichtfarbe) | `shadePhong()` in `raytrace.frag`; Modus 1 über `MeshPhongMaterial` |
| Reflektanzvektor `R` | `reflect(-L, N)` in `shadePhong()` |
| Reflexionsstrahl & Abbruch nach `N` | Schleife in `raytrace.frag` (`b > uMaxBounces`) |
| Schattenstrahl / harte Schatten | `occluded()` in `scene_common.glsl` |
| Color Bleeding (indirekte diffuse Reflexion) | `throughput *= h.color` + `cosineSampleHemisphere` in `pathtrace.frag` |
| Flächenlicht & weiche Schatten | `sampleLight()` (NEE) in `pathtrace.frag` |
| Flächen- vs. Eckpunktnormalen | `normalsHelper.js`, Shading-Umschaltung in `phongMode.js` |
| Kein ambienter Term | kein `AmbientLight` in `scene.js`/`main.js` |
| analytische Schnitttests (Ebene/Box/Kugel) | `scene_common.glsl` |

**Kernaussage des Projekts:** Phong und Raytracing zeigen **kein** Color
Bleeding, weil sie kein diffuses Licht zwischen Flächen austauschen; erst die
Global Illumination (Path Tracing) löst die Rendering-Gleichung näherungsweise
vollständig und erzeugt damit das Color Bleeding und die weichen Schatten. Genau
dieser Unterschied lässt sich im Split-Screen-Vergleich unmittelbar zeigen.
