import * as THREE from 'three';
import sceneCommon from '../shaders/scene_common.glsl?raw';
import vertSrc from '../shaders/fullscreen.vert?raw';
import raytraceSrc from '../shaders/raytrace.frag?raw';
import { buildCommonUniforms, updateCommonUniforms } from './commonUniforms.js';
import { LIGHT_COLORS } from '../scene.js';

// ---------------------------------------------------------------------------
// raytraceMode.js — Modus 2. Rendert einen Fullscreen-Quad, dessen
// Fragment-Shader die komplette Szene per Raytracing löst.
// ---------------------------------------------------------------------------

export function createRaytraceMode(renderer, camera, params) {
  // gemeinsame Szene-Uniforms + raytrace-spezifische
  const uniforms = {
    ...buildCommonUniforms(),
    uShininess: { value: params.shininess },
    uLightIntensity: { value: 1.6 },
    uMaxBounces: { value: params.maxBounces },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertSrc,
    // scene_common.glsl liefert Uniforms + Schnitttests, raytrace.frag die
    // main(). Reihenfolge ist wichtig.
    fragmentShader: sceneCommon + '\n' + raytraceSrc,
  });

  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quadScene.add(quad);
  const quadCam = new THREE.Camera(); // Kamera-Inhalt egal, Shader schreibt Clip-Space direkt

  function syncParams() {
    uniforms.uShininess.value = params.shininess;
    uniforms.uMaxBounces.value = params.maxBounces;
    uniforms.uLightColor.value.copy(LIGHT_COLORS[params.lightColor]);
  }

  return {
    name: 'Raytracing',
    render() {
      updateCommonUniforms(uniforms, camera);
      syncParams();
      renderer.render(quadScene, quadCam);
    },
    setSize() {
      /* Fullscreen-Quad braucht keine Größenanpassung */
    },
    reset() {
      /* zustandslos */
    },
    dispose() {
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
