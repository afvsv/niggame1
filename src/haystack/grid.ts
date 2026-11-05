export const CHUNK = 16;

/**
 * Voxel grid of hay. Each cell stores how many strands are left in it (0 = empty).
 * Mesh only cares whether a cell is solid, so partial removal does not dirty chunks.
 */
export class HayGrid {
  readonly data: Uint8Array;
  readonly chunksX: number;
  readonly chunksY: number;
  readonly chunksZ: number;
  readonly dirtyChunks = new Set<number>();
  total = 0;

  constructor(
    readonly nx: number,
    readonly ny: number,
    readonly nz: number,
    readonly cellSize: number,
    readonly originX: number,
    readonly originY: number,
    readonly originZ: number,
    readonly cellMax: number,
  ) {
    this.data = new Uint8Array(nx * ny * nz);
    this.chunksX = Math.ceil(nx / CHUNK);
    this.chunksY = Math.ceil(ny / CHUNK);
    this.chunksZ = Math.ceil(nz / CHUNK);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz;
  }

  index(x: number, y: number, z: number): number {
    return (y * this.nz + z) * this.nx + x;
  }

  get(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)] : 0;
  }

  set(x: number, y: number, z: number, v: number): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    const old = this.data[i];
    if (old === v) return;
    this.data[i] = v;
    this.total += v - old;
    if ((old > 0) !== (v > 0)) this.markDirtyAround(x, y, z);
  }

  /** Removes up to `amount` strands from a cell, returns how many were removed. */
  remove(x: number, y: number, z: number, amount: number): number {
    const cur = this.get(x, y, z);
    const r = Math.min(cur, amount);
    if (r > 0) this.set(x, y, z, cur - r);
    return r;
  }

  chunkKey(cx: number, cy: number, cz: number): number {
    return (cy * this.chunksZ + cz) * this.chunksX + cx;
  }

  chunkCoords(key: number): [number, number, number] {
    const cx = key % this.chunksX;
    const rest = (key - cx) / this.chunksX;
    const cz = rest % this.chunksZ;
    const cy = (rest - cz) / this.chunksZ;
    return [cx, cy, cz];
  }

  /** A change can affect faces and AO of neighbouring chunks, so mark the 3x3x3 neighbourhood. */
  private markDirtyAround(x: number, y: number, z: number): void {
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = Math.floor((x + dx) / CHUNK);
          const cy = Math.floor((y + dy) / CHUNK);
          const cz = Math.floor((z + dz) / CHUNK);
          if (cx < 0 || cy < 0 || cz < 0 || cx >= this.chunksX || cy >= this.chunksY || cz >= this.chunksZ) continue;
          this.dirtyChunks.add(this.chunkKey(cx, cy, cz));
        }
  }

  markAllDirty(): void {
    for (let cy = 0; cy < this.chunksY; cy++)
      for (let cz = 0; cz < this.chunksZ; cz++)
        for (let cx = 0; cx < this.chunksX; cx++) this.dirtyChunks.add(this.chunkKey(cx, cy, cz));
  }

  recount(): void {
    let s = 0;
    for (let i = 0; i < this.data.length; i++) s += this.data[i];
    this.total = s;
  }

  worldToCell(wx: number, wy: number, wz: number): [number, number, number] {
    return [
      Math.floor((wx - this.originX) / this.cellSize),
      Math.floor((wy - this.originY) / this.cellSize),
      Math.floor((wz - this.originZ) / this.cellSize),
    ];
  }

  /** Run-length encoding: [value, varint run] pairs, then base64. */
  serialize(): string {
    const out: number[] = [];
    const d = this.data;
    let i = 0;
    while (i < d.length) {
      const v = d[i];
      let run = 1;
      while (i + run < d.length && d[i + run] === v) run++;
      out.push(v);
      let r = run;
      while (r >= 0x80) { out.push((r & 0x7f) | 0x80); r >>>= 7; }
      out.push(r);
      i += run;
    }
    let bin = '';
    for (let j = 0; j < out.length; j += 0x8000) bin += String.fromCharCode(...out.slice(j, j + 0x8000));
    return btoa(bin);
  }

  deserialize(s: string): boolean {
    const bin = atob(s);
    let p = 0;
    let i = 0;
    const d = this.data;
    while (p < bin.length && i <= d.length) {
      const v = bin.charCodeAt(p++);
      let run = 0;
      let shift = 0;
      let b: number;
      do { b = bin.charCodeAt(p++); run |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
      if (i + run > d.length) return false;
      d.fill(v, i, i + run);
      i += run;
    }
    if (i !== d.length) return false;
    this.recount();
    this.markAllDirty();
    return true;
  }
}
