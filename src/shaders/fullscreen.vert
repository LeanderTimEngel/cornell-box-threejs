// Vertex-Shader für den Fullscreen-Quad (Modus 2 & 3).
// Die PlaneGeometry(2,2) liegt bereits in Clip-Space-Koordinaten [-1,1];
// wir reichen sie unverändert durch und geben die UV ans Fragment weiter.
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
