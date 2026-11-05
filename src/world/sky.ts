import * as THREE from 'three';

/** Direction towards the sun: over the far long wall, so the open middle and the exit wall get the light. */
export const SUN_DIR = new THREE.Vector3(-0.5, 0.62, 0.6).normalize();

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;

const frag = /* glsl */ `
uniform vec3 sunDir, zenith, horizon, ground, sunColor;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, ground, smoothstep(0.0, -0.1, h));
  float sd = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(sd, 6.0) * 0.18 + pow(sd, 60.0) * 0.5);
  col += sunColor * smoothstep(0.9993, 0.9997, sd) * 24.0;
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.1) * 0.9;
    float c = fbm(uv * 1.6 + 3.0);
    c = smoothstep(0.52, 0.82, c) * smoothstep(0.0, 0.2, h);
    float shade = fbm(uv * 1.6 + 3.25 + sunDir.xz * 0.1);
    vec3 cloud = mix(vec3(0.78, 0.8, 0.86), vec3(1.08, 1.04, 0.98), smoothstep(0.75, 0.45, shade)) * (1.0 + pow(sd, 8.0) * 0.6);
    col = mix(col, cloud, c * 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Gradient sky with sun and soft clouds, plus a matching PMREM environment. */
export function createSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      zenith: { value: new THREE.Color(0.16, 0.36, 0.78) },
      horizon: { value: new THREE.Color(0.62, 0.76, 0.9) },
      ground: { value: new THREE.Color(0.32, 0.36, 0.28) },
      sunColor: { value: new THREE.Color(1.0, 0.86, 0.62) },
    },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  // Image-based lighting from the same sky (rendered before the sky joins the main scene).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(sky);
  scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 1000).texture;
  pmrem.dispose();
  scene.add(sky);
  scene.fog = new THREE.Fog(new THREE.Color(0.62, 0.76, 0.9), 70, 480);
  return sky;
}

/** Sun with a static shadow map over the hangar and a hemisphere fill. */
export function createLights(scene: THREE.Scene, renderer: THREE.WebGLRenderer): THREE.DirectionalLight {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // nothing that casts shadows moves; refresh when the stack changes
  renderer.shadowMap.needsUpdate = true;
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.5);
  sun.position.copy(SUN_DIR).multiplyScalar(50).add(new THREE.Vector3(0, 2, 0));
  sun.target.position.set(0, 2, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 5; sc.far = 100;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#e6dcc8', '#8a6c48', 1.25));
  scene.environmentIntensity = 0.4;
  return sun;
}
