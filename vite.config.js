import { defineConfig } from 'vite';

// Vite-Konfiguration. GLSL-Shader laden wir als reine Text-Imports (?raw),
// dafür ist keine zusätzliche Konfiguration nötig.
//
// base: Beim Production-Build (GitHub Pages) liegt die App unter dem Unterpfad
// /cornell-box-threejs/. Im Dev-Server bleibt der Pfad "/" für bequeme lokale
// Entwicklung.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/cornell-box-threejs/' : '/',
  server: {
    open: true,
  },
}));
