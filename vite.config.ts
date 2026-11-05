import { defineConfig } from 'vite';

// base './' so the build works from any folder (CrazyGames hosts games in a subpath)
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
