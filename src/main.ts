import * as THREE from 'three';
import '@fontsource-variable/roboto-condensed';
import './style.css';
import { BALANCE } from './data/balance';
import { Audio } from './core/audio';
import { fmtMoney } from './core/format';
import { rich, setLang, t } from './core/i18n';
import { Input } from './core/input';
import { clearSave, loadSave, writeSave } from './core/save';
import { HayParticles } from './fx/particles';
import { CONTAINERS, ItemId, TOOLS, itemById } from './data/tools';
import { Game, GameEvents } from './game/Game';
import { Inventory } from './game/Inventory';
import { generateStack } from './haystack/generate';
import { HayGrid } from './haystack/grid';
import { HaystackView } from './haystack/HaystackView';
import { PlayerController } from './player/PlayerController';
import { renderIcons } from './tools/icons';
import { ViewModel } from './tools/ViewModel';
import { Hotbar } from './ui/hotbar';
import { Hud } from './ui/hud';
import { ShopScreen } from './ui/shop';
import { Colliders } from './world/colliders';
import { buildShed } from './world/shed';
import { createLights, createSky } from './world/sky';
import { loadTextures } from './gfx/assets';
import { triplanarMaterial } from './gfx/triplanar';
import { applyGraphics } from './gfx/quality';
import { RESOLUTION_SCALE, Settings, detectGpu, loadSettings, presetForGpu, saveSettings } from './core/settings';
import { SettingsScreen } from './ui/settings';

const params = new URLSearchParams(location.search);
if (params.has('reset')) clearSave();

// Settings come first: language and MSAA are fixed at start.
const recommended = presetForGpu(detectGpu(), matchMedia('(pointer: coarse)').matches);
const settings = loadSettings(recommended);
if (settings.lang !== 'auto') setLang(settings.lang);

// Canvas signs and the HUD use Roboto Condensed; wait briefly so the first frame does not flash a fallback font.
await Promise.race([
  Promise.all(['500 32px "Roboto Condensed Variable"', '700 32px "Roboto Condensed Variable"'].map((f) => document.fonts.load(f, 'Сено $0'))),
  new Promise((r) => setTimeout(r, 1500)),
]).catch(() => {});

// Renderer & camera
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: settings.graphics.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.autoClear = false; // world pass, then the held tool on top
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 600);

// Procedural PBR textures are generated in workers while the page shows a loading line.
const overlayText = document.getElementById('overlay-text')!;
document.getElementById('overlay-title')!.textContent = t('title');
overlayText.textContent = t('overlay.loading');
const tex = await loadTextures(renderer, (d, n) => { overlayText.textContent = `${t('overlay.loading')} ${Math.round((d / n) * 100)}%`; });
createSky(scene, renderer);
const sun = createLights(scene, renderer);

// Haystack
const H = BALANCE.hay, S = BALANCE.stack;
const grid = new HayGrid(S.gridX, S.gridY, S.gridZ, H.cellSize, (-S.gridX * H.cellSize) / 2, 0, (-S.gridZ * H.cellSize) / 2, H.cellMaxStrands);
const save = loadSave();
if (!save || !grid.deserialize(save.grid)) generateStack(grid, S);
const hayLook = { set: tex.hay, tile: 1.6, variation: tex.variation, variationTile: 7, brightness: 0.3, tint: '#d0b070', tintAmount: 0.3 };
const hayMat = triplanarMaterial({ ...hayLook, vertexColors: true });
const strawMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, envMapIntensity: 0.5 });
const stackView = new HaystackView(grid, [hayMat, strawMat]);
scene.add(stackView.group);
stackView.update(Infinity);

// World, player, systems
const colliders = new Colliders(grid);
const shed = buildShed(scene, colliders, tex, triplanarMaterial(hayLook));
const input = new Input(renderer.domElement);
const player = new PlayerController(colliders, camera);
if (save) {
  player.pos.set(save.player.x, save.player.y, save.player.z);
  player.yaw = save.player.yaw;
  player.pitch = save.player.pitch;
} else {
  player.pos.copy(shed.spawn);
  player.yaw = shed.spawnYaw;
}
const particles = new HayParticles();
scene.add(particles.object);
const audio = new Audio();
const hud = new Hud();
const inv = new Inventory();
inv.load(save?.inv);
const icons = renderIcons(renderer, [...TOOLS.map((x) => x.id), ...CONTAINERS.map((x) => x.id)] as ItemId[]);
const hotbar = new Hotbar(icons);
const vm = new ViewModel(inv.active, renderer);
vm.setAspect(window.innerWidth / window.innerHeight);

const counterTop = new THREE.Vector3(4.5, 1.12, 8.6);
const events: GameEvents = {
  grab: (got, tool) => { audio.rustle(0.5 + Math.min(1, got / 20)); vm.swing(tool.cooldown); },
  full: () => { audio.thud(); hud.shakeCarry(); },
  sell: (value, n) => {
    audio.sale(n / Math.max(1, game.capacity));
    hud.pop(`+${fmtMoney(value)}`, 'good');
    hud.bumpMoney();
    particles.burst(counterTop.x, counterTop.y, counterTop.z, 0, 1, 0, Math.min(60, 10 + n / 2));
  },
  buy: (id) => {
    audio.purchase();
    hud.pop(`−${fmtMoney(itemById(id).price)}`, 'spend');
    hud.bumpMoney();
    hotbar.flash(id);
  },
  toolChange: () => audio.tick(),
  openShop: () => openShop(),
};
const game = new Game(grid, camera, { counter: shed.counter, shop: shed.shop }, input, particles, inv, events);
if (save) { game.money = save.money; game.carried = Math.min(save.carried, inv.capacity); }

let lastActive = inv.active;
inv.onChange = () => {
  hotbar.render(inv);
  vm.setTool(inv.active);
  if (inv.active !== lastActive) hotbar.showName(t(`item.${inv.active}`));
  lastActive = inv.active;
};
hotbar.render(inv);

// Overlay / pointer lock / screens
const overlay = document.getElementById('overlay')!;
overlayText.textContent = t('overlay.start');
document.getElementById('overlay-controls')!.innerHTML = ['controls.move', 'controls.dig', 'controls.sell', 'controls.tools'].map((k) => `<li>${rich(t(k))}</li>`).join('');
const resetBtn = document.getElementById('overlay-reset')!;
resetBtn.textContent = t('overlay.reset');
let saveDisabled = false;
resetBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!confirm(t('overlay.resetConfirm'))) return;
  saveDisabled = true;
  clearSave();
  location.reload();
});
const showPause = () => { overlayText.textContent = t('overlay.paused'); if (!settingsScreen.isOpen) overlay.classList.remove('hidden'); };

// Settings
const fpsEl = document.getElementById('fps')!;
const quality = { renderer, sun, ...shed.quality, stackStraws: strawMat };
function applySettings(s: Settings): void {
  applyGraphics(quality, s.graphics);
  setResolution(s.graphics.resolution);
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  player.sensitivity = s.sensitivity;
  audio.volume = s.volume;
  fpsEl.classList.toggle('hidden', !s.showFps);
}
const settingsScreen = new SettingsScreen(settings, recommended);
settingsScreen.onChange = (s) => { saveSettings(s); applySettings(s); };
settingsScreen.onClose = () => overlay.classList.remove('hidden');
const settingsBtn = document.getElementById('overlay-settings')!;
settingsBtn.textContent = t('settings.open');
settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  overlay.classList.add('hidden');
  settingsScreen.open();
});
document.getElementById('overlay-actions')!.classList.remove('hidden');
window.addEventListener('keydown', (e) => {
  if (e.code !== 'F3') return;
  e.preventDefault(); // browsers bind F3 to "find next"
  settings.showFps = !settings.showFps;
  saveSettings(settings);
  fpsEl.classList.toggle('hidden', !settings.showFps);
  settingsScreen.refresh();
});
overlay.addEventListener('click', () => { audio.unlock(); input.requestLock(); });

const shop = new ShopScreen(game, icons);
shop.onBuyFail = () => audio.thud();
function openShop(): void {
  if (shop.isOpen) return;
  audio.tick();
  shop.open();
  document.exitPointerLock();
}
shop.onClose = (relock) => {
  audio.tick();
  if (!relock) { showPause(); return; }
  input.requestLock();
  // The browser may refuse the lock (e.g. right after Esc); fall back to the pause card.
  setTimeout(() => { if (!input.locked && !shop.isOpen) showPause(); }, 400);
};
input.onLockChange = (locked) => {
  if (locked) { overlay.classList.add('hidden'); return; }
  persist();
  if (!shop.isOpen) showPause();
};

// Saving
function persist(): void {
  if (saveDisabled) return;
  writeSave({ money: game.money, carried: game.carried, inv: inv.serialize(), player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch } }, grid);
}
setInterval(persist, BALANCE.autosaveSeconds * 1000);
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  vm.setAspect(camera.aspect);
});

// Resolution: fixed scale of the screen, or adaptive — drop the pixel ratio on slow GPUs and
// never climb back to a level that was too slow.
let ratioCap = Math.min(window.devicePixelRatio, 1.5), ratio = ratioCap, slowT = 0, fastT = 0;
function setResolution(r: Settings['graphics']['resolution']): void {
  if (r === 'auto') ratioCap = ratio = Math.min(window.devicePixelRatio, 1.5);
  else ratio = RESOLUTION_SCALE[r] * Math.min(window.devicePixelRatio, 2);
  slowT = fastT = 0;
  renderer.setPixelRatio(ratio);
}
function adaptResolution(dt: number): void {
  slowT = dt > 1 / 40 ? slowT + dt : Math.max(0, slowT - dt * 0.5);
  fastT = dt < 1 / 55 ? fastT + dt : 0;
  if (slowT > 1.5 && ratio > 0.6) {
    ratioCap = ratio;
    ratio = Math.max(0.6, ratio - 0.15);
    renderer.setPixelRatio(ratio);
    slowT = 0;
  } else if (fastT > 6 && ratio + 0.1 < ratioCap) {
    ratio += 0.1;
    renderer.setPixelRatio(ratio);
    fastT = 0;
  }
}

applySettings(settings);

// Main loop
let last = performance.now(), fpsFrames = 0, fpsTime = 0;
function countFps(elapsed: number): void {
  fpsFrames++;
  fpsTime += elapsed;
  if (fpsTime < 0.5) return;
  const fps = Math.round(fpsFrames / fpsTime);
  if (settings.showFps) {
    fpsEl.textContent = `${fps} FPS · ${renderer.domElement.width}×${renderer.domElement.height}`;
    fpsEl.className = fps < 30 ? 'bad' : fps < 50 ? 'slow' : '';
  }
  fpsFrames = 0;
  fpsTime = 0;
}
function frame(now: number): void {
  countFps(Math.max(0, now - last) / 1000);
  // rAF timestamps can precede `last` after a long first task, so clamp to [0, 50 ms].
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (!document.hidden && input.locked && settings.graphics.resolution === 'auto' && !params.has('fixedres')) adaptResolution(dt);
  player.update(dt, input);
  game.update(dt);
  vm.update(dt, { speed: Math.hypot(player.vel.x, player.vel.z), onGround: player.onGround, mouseDX: input.mouseDX, mouseDY: input.mouseDY });
  vm.setLoad(game.carried / game.capacity);
  camera.rotation.x -= vm.kick * 0.008; // visual-only nod on each swing; the player resets rotation next frame
  stackView.update(5);
  if (stackView.changed) { renderer.shadowMap.needsUpdate = true; stackView.changed = false; }
  shed.update(dt);
  particles.update(dt);
  hud.update({
    money: game.money,
    hayLeft: grid.total,
    carried: game.carried,
    capacity: game.capacity,
    carrierName: inv.container ? t(`item.${inv.container.id}`) : t('hud.hands'),
    hint: game.hint,
    aimActive: game.target !== null,
  }, dt);
  renderer.clear();
  renderer.render(scene, camera);
  vm.render(renderer);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for tests and the browser console.
(window as unknown as { __game: unknown }).__game = { game, player, grid, renderer, camera, scene, persist, inv, shop, icons, vm, settings, settingsScreen, applySettings, sun };
