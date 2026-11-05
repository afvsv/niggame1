import * as THREE from 'three';
import { FLOOR_STRAW_DENSITY, GRASS_DENSITY, Graphics, SHADOW_MAP } from '../core/settings';

/** Scene parts whose cost the graphics settings control. */
export interface QualityTargets {
  renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight;
  grass: THREE.InstancedMesh[];
  floorStraws: THREE.InstancedMesh;
  /** Material of the straws sticking out of the stack (a geometry group of the stack mesh). */
  stackStraws: THREE.Material;
  beams: THREE.Object3D;
}

const fullCount = new WeakMap<THREE.InstancedMesh, number>();

/** Draws only the first share of instances; they were placed in random order, so this thins evenly. */
function thin(meshes: THREE.InstancedMesh[], share: number): void {
  for (const m of meshes) {
    if (!fullCount.has(m)) fullCount.set(m, m.count);
    m.count = Math.round(fullCount.get(m)! * share);
    m.visible = m.count > 0;
  }
}

/** Applies everything except resolution and MSAA, which the main loop and the renderer own. */
export function applyGraphics(t: QualityTargets, g: Graphics): void {
  // Toggling castShadow changes the light setup, so three.js rebuilds the affected shaders itself.
  const size = SHADOW_MAP[g.shadows];
  t.sun.castShadow = size > 0;
  if (size > 0 && t.sun.shadow.mapSize.x !== size) {
    t.sun.shadow.mapSize.set(size, size);
    t.sun.shadow.map?.dispose();
    t.sun.shadow.map = null; // recreated at the new size on the next shadow pass
  }
  t.sun.shadow.radius = size <= 1024 ? 1.5 : 2.5;
  t.renderer.shadowMap.needsUpdate = true;
  thin(t.grass, GRASS_DENSITY[g.grass]);
  thin([t.floorStraws], FLOOR_STRAW_DENSITY[g.straw]);
  t.stackStraws.visible = g.straw !== 'low';
  t.beams.visible = g.beams;
}
