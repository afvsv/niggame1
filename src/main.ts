import * as THREE from 'three';
import './style.css';
import { BALANCE } from './data/balance';
import { Audio } from './core/audio';
import { t } from './core/i18n';
import { Input } from './core/input';
import { clearSave, loadSave, writeSave } from './core/save';
import { HayParticles } from './fx/particles';
import { Game } from './game/Game';
import { generateStack } from './haystack/generate';
import { HayGrid } from './haystack/grid';
import { createHayTexture } from './haystack/hayTexture';
import { HaystackView } from './haystack/HaystackView';
import { PlayerController } from './player/PlayerController';
import { Hud } from './ui/hud';
import { Colliders } from './world/colliders';
import { buildShed } from './world/shed';

const params = new URLSearchParams(location.search);
if (params.has('reset')) clearSave();

// Renderer & camera
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);

// Haystack
const H = BALANCE.hay, S = BALANCE.stack;
const grid = new HayGrid(S.gridX, S.gridY, S.gridZ, H.cellSize, (-S.gridX * H.cellSize) / 2, 0, (-S.gridZ * H.cellSize) / 2, H.cellMaxStrands);
const save = loadSave();
if (!save || !grid.deserialize(save.grid)) generateStack(grid, S);
const hayMat = new THREE.MeshLambertMaterial({ map: createHayTexture(renderer), vertexColors: true });
const stackView = new HaystackView(grid, hayMat);
scene.add(stackView.group);
stackView.update(Infinity);

// World, player, systems
const colliders = new Colliders(grid);
const shed = buildShed(scene, colliders);
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
scene.add(particles.points);
const audio = new Audio();
const hud = new Hud();
const game = new Game(grid, camera, shed.counter, input, particles, audio, hud);
if (save) { game.money = save.money; game.carried = save.carried; }

// Overlay / pointer lock
const overlay = document.getElementById('overlay')!;
document.getElementById('overlay-title')!.textContent = t('title');
document.getElementById('overlay-text')!.textContent = t('overlay.start');
document.getElementById('overlay-controls')!.innerHTML = ['controls.move', 'controls.dig', 'controls.sell'].map((k) => `<li>${t(k)}</li>`).join('');
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
overlay.addEventListener('click', () => { audio.unlock(); input.requestLock(); });
input.onLockChange = (locked) => {
  overlay.classList.toggle('hidden', locked);
  if (!locked) { document.getElementById('overlay-text')!.textContent = t('overlay.paused'); persist(); }
};

// Saving
function persist(): void {
  if (saveDisabled) return;
  writeSave({ money: game.money, carried: game.carried, player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch } }, grid);
}
setInterval(persist, BALANCE.autosaveSeconds * 1000);
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main loop
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  player.update(dt, input);
  game.update(dt);
  stackView.update(6);
  particles.update(dt);
  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for tests and the browser console.
(window as unknown as { __game: unknown }).__game = { game, player, grid, renderer, camera, persist };
