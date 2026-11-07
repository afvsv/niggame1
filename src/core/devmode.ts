/**
 * Developer mode gate. On only with `?dev` in the URL AND a dev environment:
 * the dev server (`env.DEV`) or a build made with `VITE_DEV_TOOLS=1`. A production
 * build without that variable never enables it, so the shipped CrazyGames build stays clean.
 */
export function devModeEnabled(params: URLSearchParams, env: { DEV: boolean; VITE_DEV_TOOLS?: string }): boolean {
  return params.has('dev') && (env.DEV === true || env.VITE_DEV_TOOLS === '1');
}
