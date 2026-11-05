import * as THREE from 'three';
import { PBRData, PBRSet, linearTex, toPBRSet } from './pbr';
import { TEXTURE_JOBS, TextureJobs, genVariation } from './textures';

export type Textures = { [K in keyof TextureJobs]: PBRSet } & { variation: THREE.DataTexture };

/**
 * Generates every procedural material in parallel workers (about a second of
 * CPU on one thread), falling back to the main thread if workers are unavailable.
 */
export async function loadTextures(renderer: THREE.WebGLRenderer, onProgress?: (done: number, total: number) => void): Promise<Textures> {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const names = Object.keys(TEXTURE_JOBS) as (keyof TextureJobs)[];
  const out: Partial<Record<keyof TextureJobs, PBRData>> = {};
  let done = 0;
  const finish = (name: keyof TextureJobs, d: PBRData) => { out[name] = d; onProgress?.(++done, names.length); };
  const viaWorker = (name: keyof TextureJobs) => new Promise<void>((resolve, reject) => {
    const w = new Worker(new URL('./textures.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ name: keyof TextureJobs; d: PBRData }>) => { finish(e.data.name, e.data.d); w.terminate(); resolve(); };
    w.onerror = (e) => { w.terminate(); reject(e); };
    w.postMessage(name);
  });
  try {
    await Promise.all(names.map(viaWorker));
  } catch {
    for (const n of names) if (!out[n]) finish(n, TEXTURE_JOBS[n]());
  }
  const sets = Object.fromEntries(names.map((n) => [n, toPBRSet(out[n]!, aniso)])) as { [K in keyof TextureJobs]: PBRSet };
  return { ...sets, variation: linearTex(genVariation(256), 256) };
}
