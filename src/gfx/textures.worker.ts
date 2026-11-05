import { TEXTURE_JOBS, TextureJobs } from './textures';

// One generator per message; buffers are transferred back without copying.
self.onmessage = (e: MessageEvent<keyof TextureJobs>) => {
  const d = TEXTURE_JOBS[e.data]();
  (self as unknown as Worker).postMessage({ name: e.data, d }, [d.albedo.buffer, d.normal.buffer, d.rough.buffer]);
};
