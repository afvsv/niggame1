import * as THREE from 'three';
import { HayGrid } from './grid';
import { buildChunkGeometry } from './mesher';

/** Owns chunk meshes and rebuilds the dirty ones a few per frame. */
export class HaystackView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.Mesh>();

  constructor(private readonly grid: HayGrid, private readonly material: THREE.Material) {
    this.group.name = 'haystack';
  }

  /** Rebuild up to `budget` dirty chunks. Pass Infinity to rebuild everything. */
  update(budget = 6): void {
    let done = 0;
    for (const key of this.grid.dirtyChunks) {
      if (done >= budget) break;
      this.grid.dirtyChunks.delete(key);
      this.rebuild(key);
      done++;
    }
  }

  private rebuild(key: number): void {
    const [cx, cy, cz] = this.grid.chunkCoords(key);
    const geo = buildChunkGeometry(this.grid, cx, cy, cz);
    const old = this.meshes.get(key);
    if (old) {
      old.geometry.dispose();
      if (!geo) { this.group.remove(old); this.meshes.delete(key); return; }
      old.geometry = geo;
      return;
    }
    if (!geo) return;
    const m = new THREE.Mesh(geo, this.material);
    m.matrixAutoUpdate = false;
    this.group.add(m);
    this.meshes.set(key, m);
  }
}
