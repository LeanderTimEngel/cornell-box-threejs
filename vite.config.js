import { defineConfig } from 'vite';

// Vite-Konfiguration. GLSL-Shader laden wir später als reine Text-Imports
// (?raw), dafür ist keine zusätzliche Konfiguration nötig.
export default defineConfig({
  server: {
    open: true,
  },
});
