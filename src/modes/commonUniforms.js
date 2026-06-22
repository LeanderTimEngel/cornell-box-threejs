import * as THREE from 'three';
import { SCENE } from '../scene.js';

// ---------------------------------------------------------------------------
// commonUniforms.js — baut und aktualisiert die Uniforms, die sowohl der
// Raytracer (Modus 2) als auch der Path-Tracer (Modus 3) brauchen.
// Quelle der Geometrie ist immer SCENE aus scene.js (siehe scene_common.glsl).
// ---------------------------------------------------------------------------

export function buildCommonUniforms() {
  return {
    // Kamera (wird pro Frame in updateCommonUniforms gesetzt)
    uCamPos: { value: new THREE.Vector3() },
    uCamWorld: { value: new THREE.Matrix4() },
    uProjInv: { value: new THREE.Matrix4() },
    // Licht
    uLightColor: { value: new THREE.Color(1, 1, 1) },
    uLightPos: { value: new THREE.Vector3(...SCENE.light.pointPos) },
    uLightHalf: { value: new THREE.Vector2(...SCENE.light.halfSize) },
    // Kugel
    uSphereCenter: { value: new THREE.Vector3(...SCENE.sphere.center) },
    uSphereRadius: { value: SCENE.sphere.radius },
    // Säule (orientierte Box)
    uPillarCenter: { value: new THREE.Vector3(...SCENE.pillar.center) },
    uPillarHalf: { value: new THREE.Vector3(...SCENE.pillar.halfSize) },
    uPillarRot: { value: THREE.MathUtils.degToRad(SCENE.pillar.rotYdeg) },
  };
}

// Kamera-Uniforms aus der aktuellen Kamera übernehmen.
export function updateCommonUniforms(uniforms, camera) {
  camera.updateMatrixWorld();
  uniforms.uCamPos.value.copy(camera.position);
  uniforms.uCamWorld.value.copy(camera.matrixWorld);
  uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
}
