import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BuildingViews, generatorModel, makeGhost, rakeModel } from './buildings';
import type { BuildingRef } from '../game/factory';
import type { Mats } from './buildings';

const mat = (color: string): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color });
const m: Mats = {
  beam: mat('#857565'), boards: mat('#a08b74'), metal: mat('#9aa0a2'), iron: mat('#3b3a38'),
  steel: mat('#5d6d74'), rubber: mat('#1f1f1e'), hay: mat('#d0b070'), red: mat('#97302a'),
  black: mat('#1a1917'), yellow: mat('#d9a51c'), burlap: mat('#a08660'),
};

const meshCount = (root: THREE.Object3D): number => {
  let n = 0;
  root.traverse((o) => { if (o instanceof THREE.Mesh) n++; });
  return n;
};
const box3Of = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);
const size = (b: THREE.Box3): [number, number, number] => [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];

describe('machine bodies are fully built (defect 17)', () => {
  it('rakeModel: a mesh per kit material plus head and tines, the body is present', () => {
    const rake = rakeModel(m); // kit materials: beam, iron, steel
    expect(meshCount(rake)).toBeGreaterThanOrEqual(3);
    const [w, h, d] = size(box3Of(rake));
    expect(w).toBeGreaterThanOrEqual(0.9);
    expect(d).toBeGreaterThanOrEqual(0.9);
    expect(h).toBeGreaterThanOrEqual(0.8);
  });

  it('generatorModel: a mesh per kit material plus chimney, the body is present', () => {
    const gen = generatorModel(m); // kit materials: boards, iron, red
    expect(meshCount(gen)).toBeGreaterThanOrEqual(3);
    const [w, h, d] = size(box3Of(gen));
    expect(w).toBeGreaterThanOrEqual(0.9);
    expect(d).toBeGreaterThanOrEqual(0.9);
    expect(h).toBeGreaterThanOrEqual(0.8);
  });

  it('BuildingViews.raycast from above the centre hits the machine', () => {
    const views = new BuildingViews(m, m.hay);
    const refs: BuildingRef[] = [
      { id: 'rake', x: 0, z: 0, rot: 0, colliders: [] },
      { id: 'generator', x: 4, z: 0, rot: 0, colliders: [] },
    ];
    views.rebuild(refs);
    views.group.updateMatrixWorld(true); // in play the renderer keeps the matrices fresh
    const down = new THREE.Vector3(0, -1, 0);
    const rakeHit = views.raycast(new THREE.Raycaster(new THREE.Vector3(0, 3, 0), down, 0, 5));
    expect(rakeHit?.ref.id).toBe('rake');
    expect(rakeHit!.dist).toBeGreaterThan(0);
    const genHit = views.raycast(new THREE.Raycaster(new THREE.Vector3(4, 3, 0), down, 0, 5));
    expect(genHit?.ref.id).toBe('generator');
    expect(genHit!.dist).toBeGreaterThan(0);
  });

  it('ghosts carry the same mesh count as the built models', () => {
    expect(meshCount(makeGhost('rake').group)).toBe(meshCount(rakeModel(m)));
    expect(meshCount(makeGhost('generator').group)).toBe(meshCount(generatorModel(m)));
  });
});
