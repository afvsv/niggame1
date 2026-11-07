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
import { ALL_ITEMS, ItemId, isContainer, itemById } from './data/tools';
import { NEEDLES } from './data/needles';
import { Game, GameEvents, World } from './game/Game';
import { Inventory } from './game/Inventory';
import { CONTAINER_WORLD, ContainerProps } from './game/containers';
import { NeedleField, placeNeedles } from './game/needles';
import { supportHeight } from './game/support';
import { STEPS, Tutorial } from './game/tutorial';
import { Factory } from './game/factory';
import { BuildMode } from './game/buildMode';
import { BuildingViews, Ghost, inForbiddenZone, makeGhost } from './world/buildings';
import { BuildScreen } from './ui/build';
import type { BuildingId } from './data/buildings';
import { BARN } from './world/nature';
import { EndingScreen } from './ui/ending';
import { needleName, needlePerk } from './ui/needleText';
import { generateStack } from './haystack/generate';
import { HayGrid } from './haystack/grid';
import { HaystackView } from './haystack/HaystackView';
import { raycastGrid } from './haystack/raycast';
import { PlayerController } from './player/PlayerController';
import { renderIcons, renderUpgradeIcons } from './tools/icons';
import { ViewModel } from './tools/ViewModel';
import { Hotbar } from './ui/hotbar';
import { Hud, WorldLabel } from './ui/hud';
import { ShopScreen } from './ui/shop';
import { TreeScreen } from './ui/tree';
import { Colliders } from './world/colliders';
import { buildShed } from './world/shed';
import { createLights, createSky } from './world/sky';
import { loadTextures } from './gfx/assets';
import { triplanarMaterial } from './gfx/triplanar';
import { applyGraphics } from './gfx/quality';
import { Graphics, PRESETS, RESOLUTION_SCALE, Settings, detectGpu, loadSettings, presetForGpu, saveSettings } from './core/settings';
import { BENCH_SECONDS, BenchPose, Benchmark, loadBench, pickPreset, saveBench } from './gfx/bench';
import { SettingsScreen } from './ui/settings';

const A = BALANCE.automation;
const params = new URLSearchParams(location.search);
if (params.has('reset')) clearSave();

// Settings come first: language and MSAA are fixed at start.
// The last performance test on this GPU beats a guess from its name.
const gpu = detectGpu();
const benchRecord = loadBench(gpu);
const recommended = benchRecord?.preset ?? presetForGpu(gpu, matchMedia('(pointer: coarse)').matches);
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
// A save from a different stack size cannot be loaded: the stack (and its needles) start over.
const gridOk = !!save && grid.deserialize(save.grid);
if (!gridOk) generateStack(grid, S);
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
if (save && gridOk) {
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
if (!gridOk) for (const st of inv.containers.values()) st.placed = null; // they stood by the old stack
const icons = renderIcons(renderer, ALL_ITEMS.map((x) => x.id));
const upIcons = renderUpgradeIcons(renderer);
const hotbar = new Hotbar(icons);
const vm = new ViewModel(inv.active, renderer);
vm.setAspect(window.innerWidth / window.innerHeight);

// Needles and placed containers.
const needles = new NeedleField(gridOk && save?.needles?.length === NEEDLES.length ? save.needles : placeNeedles(grid, S.seed + 11));
scene.add(needles.group);
const containers = new ContainerProps(inv);
scene.add(containers.group);
const support = (x: number, z: number, maxY: number, r: number) => supportHeight(grid, colliders.boxes, x, z, maxY, r);
const clampTo = (v: number, h: number) => Math.max(-h + 0.5, Math.min(h - 0.5, v));
let factory: Factory;
const world: World = {
  counter: shed.counter, shop: shed.shop, door: shed.door, board: shed.board, containers, needles, support,
  belt: shed.belt, counterTop: shed.counterTop,
  buildingTarget: (ray) => views.raycast(ray),
  fuelCapOf: () => game.d.fuelCap,
  clamp: (x, z, from) => (shed.inside(from.x, from.z) ? [clampTo(x, BARN.hx), clampTo(z, BARN.hz)] : [x, z]),
  exited: shed.exited,
};

const events: GameEvents = {
  grab: (got, tool) => { audio.rustle(0.5 + Math.min(1, got / 20)); vm.swing(tool.cooldown); },
  full: () => { audio.thud(); hud.shakeHeld(); },
  dump: (n) => { audio.pour(n); vm.swing(0.3); },
  sell: (value, n) => {
    audio.sale(n / Math.max(1, game.capacity));
    hud.pop(`+${fmtMoney(value)}`, 'good');
    hud.bumpMoney();
    const c = shed.counterTop;
    particles.burst(c.x, c.y, c.z, 0, 1, 0, Math.min(60, 10 + n / 2));
  },
  buy: (id) => {
    audio.purchase();
    hud.pop(`−${fmtMoney(itemById(id).price)}`, 'spend');
    hud.bumpMoney();
    hotbar.render(inv, capOf);
    hotbar.flash(id);
  },
  upgrade: (_id, price) => {
    audio.purchase();
    hud.pop(`−${fmtMoney(price)}`, 'spend');
    hud.bumpMoney();
    hotbar.render(inv, capOf);
    persist();
  },
  tired: () => hud.flashStamina(),
  toolChange: () => audio.tick(),
  openShop: () => openShop(),
  pour: (n) => { audio.pour(n); vm.swing(0.3); },
  place: () => audio.place(),
  pickUp: () => audio.place(),
  notice: () => audio.thud(),
  needle: (i) => {
    audio.needle();
    const id = needles.id(i);
    hud.toast(t('toast.needle', { n: needles.found.length, total: needles.total }), needleName(id), needlePerk(id));
    shed.setNeedles(needles.found);
    persist();
  },
  unlocked: () => setTimeout(() => {
    audio.doorOpen();
    shed.unlock();
    hud.toast(t('toast.open'), t('toast.openTitle'), t('toast.openText'), 'open', 6);
  }, 1800),
  escaped: () => {
    persist();
    ending.open(game.stats, needles.found.length);
    document.exitPointerLock();
  },
  beep: (s) => audio.beep(s),
};
const game = new Game(grid, camera, world, input, particles, inv, events);
const capOf = (id: ItemId) => (isContainer(id) ? game.containerCapacity(id) : 0);
// Automation: rules first, then the world layer rebuilt from the (possibly saved) building list.
factory = new Factory(grid, colliders, game.up, { x: shed.beltLow.x, z: shed.beltLow.z }, (n) => world.belt.dump(n), () => game.d.fuelCap);
const views = new BuildingViews(shed.mats, hayMat);
scene.add(views.group);
const buildMode = new BuildMode({
  factory,
  inside: (x, z) => shed.inside(x, z),
  forbidden: (x, z) => inForbiddenZone(x, z, shed.beltLow),
  money: () => game.money,
  spend: (n) => { if (game.money + 1e-9 < n) return false; game.money -= n; audio.purchase(); hud.bumpMoney(); return true; },
  refund: (n) => { game.money += n; audio.coin(); hud.bumpMoney(); },
  wadCount: () => factory.wadCount(),
});
// Upgrades change capacities and gate the plans, so they load before the buildings do.
game.up.load(save?.upgrades);
game.refreshPerks();
if (save) {
  game.money = save.money;
  game.carried = Math.min(save.carried, game.capacity);
  if (save.stats) game.stats = { ...game.stats, ...save.stats };
  game.escaped = !!save.escaped && game.unlocked;
  if (save.belt?.length) shed.belt.restore(save.belt); // hay that was still riding the conveyor
}
if (save?.build?.length) factory.load(save.build); // after the plans are loaded
views.rebuild(factory.buildings);
factory.buildings.filter((b) => b.id === 'belt').forEach((b) => b.path && views.syncWads(b.conveyor!, b.path));
shed.setNeedles(needles.found);
if (game.unlocked) shed.unlock(true);
const tutorial = new Tutorial();
tutorial.step = Math.max(0, Math.min(STEPS.length, save?.tutorial ?? 0));

inv.onChange = () => {
  hotbar.render(inv, capOf);
  vm.setTool(inv.active);
};
hotbar.render(inv, capOf);

// Overlay / pointer lock / screens
const overlay = document.getElementById('overlay')!;
overlayText.textContent = t('overlay.start');
document.getElementById('overlay-controls')!.innerHTML = `<li class="story">${rich(t('overlay.story'))}</li>` + ['controls.move', 'controls.dig', 'controls.sell', 'controls.tools', 'controls.tree'].map((k) => `<li>${rich(t(k))}</li>`).join('');
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
const settingsScreen = new SettingsScreen(settings, recommended, benchRecord?.scores ?? null);
settingsScreen.benchSeconds = BENCH_SECONDS;
settingsScreen.onBench = () => startBench();
settingsScreen.onChange = (s) => { saveSettings(s); applySettings(s); };
settingsScreen.onClose = () => { if (!bench) overlay.classList.remove('hidden'); };
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

const ending = new EndingScreen();
ending.onStay = () => {
  input.requestLock();
  setTimeout(() => { if (!input.locked && !screenOpen()) showPause(); }, 400);
};
ending.onNewGame = () => {
  if (!confirm(t('ending.confirm'))) return;
  saveDisabled = true;
  clearSave();
  location.reload();
};
const shop = new ShopScreen(game, icons);
shop.onBuyFail = () => audio.thud();
const tree = new TreeScreen(game, icons, upIcons);
tree.onBuyFail = () => audio.thud();
const buildScreen = new BuildScreen(game, factory);
const ghosts = new Map<BuildingId, Ghost>();
function openBuild(): void {
  if (screenOpen()) return;
  audio.tick();
  buildScreen.open();
  document.exitPointerLock();
}
const screenOpen = () => shop.isOpen || tree.isOpen || buildScreen.isOpen || ending.isOpen;
function openShop(): void {
  if (screenOpen()) return;
  audio.tick();
  shop.open();
  document.exitPointerLock();
}
function openTree(): void {
  if (screenOpen()) return;
  audio.tick();
  tree.open();
  document.exitPointerLock();
}
const onScreenClose = (relock: boolean) => {
  audio.tick();
  hotbar.render(inv, capOf);
  if (!relock) { showPause(); return; }
  input.requestLock();
  // The browser may refuse the lock (e.g. right after Esc); fall back to the pause card.
  setTimeout(() => { if (!input.locked && !screenOpen()) showPause(); }, 400);
};
shop.onClose = onScreenClose;
tree.onClose = onScreenClose;
buildScreen.onClose = onScreenClose;
buildScreen.onPick = (id) => {
  buildMode.choose(id);
  const ghost = ghosts.get(id) ?? (ghosts.set(id, makeGhost(id)), ghosts.get(id)!);
  ghost.show();
  input.requestLock();
};
input.onLockChange = (locked) => {
  if (locked) { overlay.classList.add('hidden'); return; }
  persist();
  if (!screenOpen()) showPause();
};

// Saving
function persist(): void {
  if (saveDisabled || bench) return; // mid-test the player stands at a test spot
  writeSave({
    money: game.money, carried: game.carried, inv: inv.serialize(),
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch },
    needles: needles.saves, tutorial: tutorial.step, stats: game.stats, escaped: game.escaped,
    upgrades: game.up.serialize(), belt: shed.belt.riding(), build: factory.serialize(),
  }, grid);
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

// Performance test (Settings → "Performance test", or ?bench): every preset from the same spots,
// then the best smooth one is applied and remembered for this GPU.
const BENCH_POSES: BenchPose[] = [
  { x: -2, z: 18.6, yaw: -0.35, pitch: 0 }, // spawn: the stack and most of the hangar
  { x: -2, z: 8, yaw: 0, pitch: 0 }, // up close to the hay, where the player digs
  { x: -1, z: -20.5, yaw: 3.0, pitch: 0.05 }, // along the hangar from the sell corner
  { x: 3, z: 0, yaw: -Math.PI / 2, pitch: 0 }, // towards the door and the grass outside
];
const benchEl = document.getElementById('bench')!;
const [benchKicker, benchTitle, benchText] = ['bench-kicker', 'bench-title', 'bench-text'].map((id) => document.getElementById(id)!);
const benchBar = benchEl.querySelector<HTMLElement>('.bar i')!;
let bench: Benchmark | null = null, benchBack: { g: Graphics; x: number; y: number; z: number; yaw: number; pitch: number } | null = null;
let benchUi = 0, benchShadow = 0;
function startBench(): void {
  if (bench) return;
  benchBack = { g: { ...settings.graphics }, x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch };
  bench = new Benchmark((p) => {
    // MSAA is fixed when the page loads, so every preset runs with the current setting.
    Object.assign(settings.graphics, PRESETS[p], { antialias: settings.graphics.antialias });
    applySettings(settings);
  }, BENCH_POSES);
  settingsScreen.close(); // the pause card stays hidden while `bench` is set
  overlay.classList.add('hidden'); // when started from ?bench, the pause card is still up
  document.body.classList.add('benchmarking');
  benchEl.classList.remove('hidden');
  benchUi = benchShadow = 0;
}
function finishBench(ok: boolean): void {
  if (!bench || !benchBack) return;
  const b = bench, back = benchBack;
  bench = benchBack = null;
  if (ok && b.scores.length) {
    const preset = pickPreset(b.scores);
    Object.assign(settings.graphics, PRESETS[preset]);
    saveBench({ gpu, preset, scores: b.scores });
    settingsScreen.setBench(b.scores, preset);
    console.info('[bench]', gpu, JSON.stringify(b.scores), '→', preset);
  } else Object.assign(settings.graphics, back.g);
  saveSettings(settings);
  applySettings(settings);
  player.pos.set(back.x, back.y, back.z);
  player.vel.set(0, 0, 0);
  player.yaw = back.yaw;
  player.pitch = back.pitch;
  renderer.shadowMap.needsUpdate = true;
  document.body.classList.remove('benchmarking');
  benchEl.classList.add('hidden');
  settingsScreen.open();
}
/** Drives the camera during the test. `raw` is the unclamped frame interval. */
function benchFrame(raw: number): void {
  const b = bench!;
  // A multi-second frame means the tab was hidden or the computer slept; such a run says nothing.
  if (raw > 3) { console.info('[bench] cancelled: a frame took', raw.toFixed(1), 's'); finishBench(false); return; }
  const p = b.tick(raw);
  if (b.done) { finishBench(true); return; }
  player.pos.set(p.x, 0, p.z);
  player.vel.set(0, 0, 0);
  player.yaw = p.yaw;
  player.pitch = p.pitch;
  // Digging refreshes the shadow map a few times a second; do the same so shadows cost what they do in play.
  if ((benchShadow -= raw) <= 0) { benchShadow = 0.25; shadowDirty = true; }
  if ((benchUi -= raw) <= 0) {
    benchUi = 0.25;
    benchKicker.textContent = t('bench.kicker', { n: b.step, total: b.steps });
    benchTitle.textContent = t(`q.${b.preset}`);
    benchText.textContent = t('bench.text', { fps: lastFps || '…' });
    benchBar.style.width = `${Math.round(b.progress * 100)}%`;
  }
}
window.addEventListener('keydown', (e) => { if (bench && e.code === 'Escape') finishBench(false); });
document.addEventListener('visibilitychange', () => { if (document.hidden) finishBench(false); });
if (params.has('bench')) setTimeout(startBench, 1500);

// Main loop
let last = performance.now(), fpsFrames = 0, fpsTime = 0, lastFps = 0, laggy = 0, perfHinted = false;
let tickAcc = 0, noRoomShown = false;
/** Where the crosshair ray meets the build plane (y = 0). */
function aimOnFloor(): { x: number; z: number } {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const t = dir.y < -1e-4 ? -camera.position.y / dir.y : 6;
  const p = camera.position.clone().addScaledVector(dir, Math.max(0.8, Math.min(8, t)));
  return { x: p.x, z: p.z };
}
let shadowDirty = false, shadowAt = 0;
function countFps(elapsed: number): void {
  fpsFrames++;
  fpsTime += elapsed;
  if (fpsTime < 0.5) return;
  const fps = lastFps = Math.round(fpsFrames / fpsTime);
  if (settings.showFps) {
    fpsEl.textContent = `${fps} FPS · ${renderer.domElement.width}×${renderer.domElement.height}`;
    fpsEl.className = fps < 30 ? 'bad' : fps < 50 ? 'slow' : '';
  }
  // A long stutter in play after the auto resolution has done what it could: point to the test once.
  if (input.locked && !bench && !perfHinted) {
    const stuck = fps < 30 && (settings.graphics.resolution !== 'auto' || ratio <= 0.6 + 1e-6);
    laggy = stuck ? laggy + fpsTime : Math.max(0, laggy - fpsTime);
    if (laggy > 10) { perfHinted = true; hud.toast(t('perf.kicker'), t('perf.title'), t('perf.text'), 'needle', 7); }
  }
  fpsFrames = 0;
  fpsTime = 0;
}
const labelDir = new THREE.Vector3();
function frame(now: number): void {
  const elapsed = Math.max(0, now - last) / 1000;
  countFps(elapsed);
  if (bench) benchFrame(elapsed);
  // rAF timestamps can precede `last` after a long first task, so clamp to [0, 50 ms].
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (!document.hidden && input.locked && !bench && settings.graphics.resolution === 'auto' && !params.has('fixedres')) adaptResolution(dt);
  player.speedMul = game.d.speedMul;
  player.jumpSpeed = game.d.jumpSpeed;
  player.canSprint = !game.stamina.exhausted;
  vm.steady = game.d.sway;
  player.update(dt, input);
  // Fixed 20 Hz factory tick, independent of the render rate.
  tickAcc += dt;
  while (tickAcc >= 0.05) { factory.tick(0.05, { rakeRate: game.d.rakeRate, rakeWidth: game.d.rakeWidth }); tickAcc -= 0.05; }
  if (factory.noRoom && !noRoomShown) { noRoomShown = true; hud.pop(t('notice.noRoom'), 'spend'); }
  if (!factory.noRoom) noRoomShown = false;
  factory.update(dt, game.d.beltSpeed);
  game.update(dt, input.locked && player.sprinting);
  if (input.locked && input.wasPressed('Tab')) openTree();
  if (input.locked && input.wasPressed('KeyB')) openBuild();
  // Build mode: the ghost or the belt chain follows the aim; the rules layer is suppressed.
  game.suppressed = buildMode.busy;
  if (buildMode.busy) {
    const aim = aimOnFloor();
    if (buildMode.activity.kind === 'ghost') {
      const id = buildMode.activity.id;
      const ghost = ghosts.get(id)!;
      ghost.move(aim.x, aim.z, buildMode.activity.rot);
      ghost.setValid(buildMode.canPlaceMachine(id, aim.x, aim.z));
      if (input.lmbPressed) {
        const ref = buildMode.placeMachine(id, aim.x, aim.z, buildMode.activity.rot);
        if (ref) { audio.place(); views.rebuild(factory.buildings); buildMode.cancel(); ghost.hide(); }
        else audio.thud();
      } else if (input.rmbPressed) { buildMode.cancel(); ghost.hide(); }
    } else if (buildMode.activity.kind === 'belt') {
      const end = buildMode.chainEnd ?? aim;
      const dx = aim.x - end.x, dz = aim.z - end.z;
      const len = Math.max(A.segmentMinM, Math.min(A.segmentMaxM, Math.hypot(dx, dz)));
      const dir = Math.hypot(dx, dz) > 1e-6 ? { x: dx / Math.hypot(dx, dz), z: dz / Math.hypot(dx, dz) } : { x: 0, z: 1 };
      const ghost = ghosts.get('belt')!;
      ghost.move(end.x + dir.x * len / 2, end.z + dir.z * len / 2, Math.atan2(dir.x, dir.z));
      ghost.setValid(buildMode.canBeltSegment(aim.x, aim.z));
      if (input.lmbPressed) {
        if (buildMode.placeBeltSegment(aim.x, aim.z)) { audio.place(); views.rebuild(factory.buildings); }
        else audio.thud();
      } else if (input.rmbPressed) {
        if (buildMode.undoLastSegment()) { audio.tick(); views.rebuild(factory.buildings); }
        else { buildMode.cancel(); ghosts.get('belt')!.hide(); }
      }
      if (!buildMode.busy) ghost.hide();
    }
  } else {
    // Demolition: hold [X] on the aimed building.
    const target = game.target?.kind === 'building' ? game.target.ref : null;
    if (buildMode.demolishStep(dt, target, input.down('KeyX'))) { audio.thud(); views.rebuild(factory.buildings); }
  }
  vm.update(dt, { speed: Math.hypot(player.vel.x, player.vel.z), onGround: player.onGround, mouseDX: input.mouseDX, mouseDY: input.mouseDY });
  const load = game.load();
  vm.setLoad(load ? load[0] / load[1] : 0);
  vm.setSignal(game.detector.strength, game.detector.blink);
  camera.rotation.x -= vm.kick * 0.008; // visual-only nod on each swing; the player resets rotation next frame
  stackView.update(5);
  containers.update(dt, (id, x, z, maxY) => support(x, z, maxY, CONTAINER_WORLD[id].radius), capOf);
  needles.update(dt, grid, (x, z, maxY) => support(x, z, maxY, 0.04));
  const doorMoving = shed.update(dt);
  if (stackView.changed || containers.moved || doorMoving) { shadowDirty = true; stackView.changed = containers.moved = false; }
  // Each refresh draws the scene once more into the shadow map; 30 a second is plenty for digging and the door.
  if (shadowDirty && now - shadowAt >= 33) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowAt = now; }
  particles.update(dt);
  const placed = inv.placed();
  tutorial.update({
    carried: game.carried, sold: game.stats.sold, has: (id) => inv.has(id), placedAny: placed.length > 0,
    fillAny: Math.max(0, ...[...inv.containers.values()].map((c) => c.fill)), containerSold: game.stats.containerSold,
    found: needles.found.length, unlocked: game.unlocked, escaped: game.escaped, upgrades: game.up.bought(),
  });
  hotbar.render(inv, capOf);
  hud.update({
    money: game.money,
    hayLeft: grid.total,
    hint: game.hint,
    aimActive: game.target !== null,
    heldName: t(`item.${inv.active}`),
    load,
    found: needles.found.length,
    total: needles.total,
    unlocked: game.unlocked,
    step: tutorial.done ? null : { n: tutorial.step + 1, total: STEPS.length, text: t(`step.${tutorial.key}`, { n: needles.found.length, total: needles.total }) },
    signal: inv.active === 'detector' ? game.detector.strength : null,
    stamina: { frac: game.stamina.frac, tired: game.stamina.exhausted },
    treeNew: game.stats.sold > 0 && game.upgradesAffordable() > 0, // not during the first steps of the tutorial
  }, dt);
  const labels: WorldLabel[] = [];
  for (const { def, state } of placed) {
    const cap = game.containerCapacity(def.id);
    const pos = containers.labelAnchor(def.id, new THREE.Vector3());
    if (!pos) continue;
    // Behind the stack the label fades instead of floating over the hay.
    const d = pos.distanceTo(camera.position);
    const dir = labelDir.copy(pos).sub(camera.position).divideScalar(d || 1);
    const hit = d < 40 ? raycastGrid(grid, camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z, d) : null;
    labels.push({ key: def.id, pos, title: t(`item.${def.id}`), value: `${state.fill} / ${cap}`, full: state.fill >= cap, occluded: !!hit && hit.dist < d - 0.3 });
  }
  hud.updateLabels(labels, camera);
  renderer.clear();
  renderer.render(scene, camera);
  vm.render(renderer);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for tests and the browser console.
(window as unknown as { __game: unknown }).__game = { game, player, grid, renderer, camera, scene, persist, inv, shop, icons, vm, settings, settingsScreen, applySettings, sun, needles, containers, shed, tutorial, ending, hud, tree, factory, buildMode, views, buildScreen };
