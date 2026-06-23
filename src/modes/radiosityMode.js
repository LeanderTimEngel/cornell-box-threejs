import * as THREE from 'three';
import sceneCommon from '../shaders/scene_common.glsl?raw';
import vertSrc from '../shaders/fullscreen.vert?raw';
import pathtraceSrc from '../shaders/pathtrace.frag?raw';
import { buildCommonUniforms, updateCommonUniforms } from './commonUniforms.js';
import { LIGHT_COLORS } from '../scene.js';

// ---------------------------------------------------------------------------
// radiosityMode.js — Modus 3 (Global Illumination, Variante A).
//
// Progressive Path-Tracing-Akkumulation:
//   - Zwei Float-Render-Targets (Ping-Pong) speichern die SUMME aller Samples.
//   - accumulate(): zieht pro Frame ein neues Sample und addiert es auf
//     (offscreen, OHNE Scissor — wichtig für den Split-Screen).
//   - render(): zeigt den Mittelwert (Summe / Frame-Zahl) an, kann gefahrlos
//     gescissort werden.
//   - reset(): startet die Akkumulation neu (Kamera/Parameter geändert).
// ---------------------------------------------------------------------------

export function createRadiosityMode(renderer, camera, params) {
  const uniforms = {
    ...buildCommonUniforms(),
    uLightEmission: { value: 6.0 },
    uFrame: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPrev: { value: null },
  };

  const traceMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertSrc,
    fragmentShader: sceneCommon + '\n' + pathtraceSrc,
  });

  // Display-Pass: Summe / Frame-Zahl -> Mittelwert, dann sRGB-Gamma.
  const displayMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: null },
      uInvFrames: { value: 1.0 },
    },
    vertexShader: vertSrc,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTex;
      uniform float uInvFrames;
      void main() {
        vec3 c = texture2D(uTex, vUv).rgb * uInvFrames; // Mittelwert
        c = clamp(c, 0.0, 1.0);
        c = pow(c, vec3(1.0 / 2.2));                    // Gamma / sRGB
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });

  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), traceMat);
  quadScene.add(quad);
  const quadCam = new THREE.Camera();

  // Float-Render-Targets für die Akkumulation (Ping-Pong).
  const rtOptions = {
    type: THREE.FloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
  };
  let rtA = new THREE.WebGLRenderTarget(1, 1, rtOptions);
  let rtB = new THREE.WebGLRenderTarget(1, 1, rtOptions);

  let frame = 0; // Anzahl bereits akkumulierter Samples (>=1 nach accumulate)

  function syncParams() {
    uniforms.uLightColor.value.copy(LIGHT_COLORS[params.lightColor]);
  }

  return {
    // Ein neues Sample akkumulieren (offscreen, ohne Scissor aufrufen!).
    accumulate() {
      updateCommonUniforms(uniforms, camera);
      syncParams();
      quad.material = traceMat;

      uniforms.uFrame.value = frame;
      uniforms.uPrev.value = rtA.texture; // bisherige Summe als Eingang

      renderer.setRenderTarget(rtB);
      renderer.render(quadScene, quadCam);
      renderer.setRenderTarget(null);

      frame += 1;
      // Ping-Pong: rtB (neue Summe) wird zur Quelle des nächsten Frames
      const tmp = rtA;
      rtA = rtB;
      rtB = tmp;
    },

    // Aktuellen Mittelwert auf den Bildschirm bringen (scissor-tauglich).
    render() {
      if (frame === 0) this.accumulate(); // Sicherheitsnetz
      displayMat.uniforms.uTex.value = rtA.texture; // rtA hält die letzte Summe
      displayMat.uniforms.uInvFrames.value = 1.0 / frame;
      quad.material = displayMat;
      renderer.render(quadScene, quadCam);
    },

    getFrame() {
      return frame;
    },

    setSize(w, h) {
      // interne Auflösung leicht reduziert, damit GI flüssig konvergiert
      const scale = 0.75;
      const rw = Math.max(1, Math.floor(w * scale));
      const rh = Math.max(1, Math.floor(h * scale));
      rtA.setSize(rw, rh);
      rtB.setSize(rw, rh);
      uniforms.uResolution.value.set(rw, rh);
      this.reset();
    },

    // Akkumulation neu starten (Kamera/Parameter haben sich geändert)
    reset() {
      frame = 0;
    },
  };
}
