import * as THREE from 'three';
import { PBRSet } from './pbr';

export interface TriplanarOptions {
  set: PBRSet;
  tile: number; // metres per texture repeat
  variation: THREE.Texture;
  variationTile?: number; // metres per variation repeat
  brightness?: number; // how much the variation brightens/darkens (0..1)
  tint?: THREE.ColorRepresentation; // colour mixed in by the variation's second channel
  tintAmount?: number;
  normalScale?: number;
  topOnly?: boolean; // planar projection from above, for floors
  vertexColors?: boolean;
  color?: THREE.ColorRepresentation;
}

/**
 * MeshStandardMaterial that samples albedo, normal and roughness in world space
 * (no UVs needed), blended over the three axes with whiteout normal blending.
 * A low-frequency variation texture hides the tiling.
 */
export function triplanarMaterial(o: TriplanarOptions): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: o.color ?? 0xffffff, roughness: 1, metalness: 0, vertexColors: o.vertexColors ?? false });
  const uniforms = {
    triMap: { value: o.set.map },
    triNormal: { value: o.set.normalMap },
    triRough: { value: o.set.roughnessMap },
    triVar: { value: o.variation },
    triScale: { value: 1 / o.tile },
    triVarScale: { value: 1 / (o.variationTile ?? 9) },
    triBright: { value: o.brightness ?? 0.5 },
    triTint: { value: new THREE.Color(o.tint ?? 0xffffff) },
    triTintAmt: { value: o.tintAmount ?? 0 },
    triNormalScale: { value: o.normalScale ?? 1 },
  };
  if (o.topOnly) mat.defines = { ...mat.defines, TRI_TOP: '' };
  mat.userData.tri = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNrm;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTriNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
uniform sampler2D triMap, triNormal, triRough, triVar;
uniform float triScale, triVarScale, triBright, triTintAmt, triNormalScale;
uniform vec3 triTint;
varying vec3 vTriPos;
varying vec3 vTriNrm;
vec3 triN, triW;
vec2 triUX, triUY, triUZ;
vec4 triSample(sampler2D t) {
#ifdef TRI_TOP
  return texture2D(t, triUY);
#else
  return texture2D(t, triUX) * triW.x + texture2D(t, triUY) * triW.y + texture2D(t, triUZ) * triW.z;
#endif
}`)
      .replace('#include <map_fragment>', /* glsl */ `
triN = normalize(vTriNrm);
#ifdef TRI_TOP
triW = vec3(0.0, 1.0, 0.0);
#else
triW = pow(abs(triN), vec3(4.0));
triW /= dot(triW, vec3(1.0));
#endif
vec3 triP = vTriPos * triScale;
triUX = triP.zy; triUY = triP.xz; triUZ = triP.xy;
diffuseColor *= triSample(triMap);
vec3 triV = vTriPos * triVarScale;
vec3 triVc = texture2D(triVar, triV.xz).rgb * (triW.y + 0.001) + texture2D(triVar, triV.zy + 0.31).rgb * triW.x + texture2D(triVar, triV.xy + 0.67).rgb * triW.z;
diffuseColor.rgb *= 1.0 + (triVc.r - 0.5) * 2.0 * triBright + (triVc.b - 0.5) * triBright;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * triTint, clamp((triVc.g - 0.45) * 2.5, 0.0, 1.0) * triTintAmt);
`)
      // Vertex colour carries baked occlusion: also dim indirect light, so tunnels do not glow with sky reflections.
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
#ifdef USE_COLOR
  float triAO = clamp(vColor.g * 1.1, 0.0, 1.0);
  reflectedLight.indirectDiffuse *= triAO;
  reflectedLight.indirectSpecular *= triAO * triAO;
#endif`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * triSample(triRough).g;')
      .replace('#include <normal_fragment_maps>', /* glsl */ `{
#ifdef TRI_TOP
  vec3 tnY = texture2D(triNormal, triUY).xyz * 2.0 - 1.0;
  tnY.xy *= triNormalScale;
  vec3 triNW = normalize(vec3(tnY.x, tnY.z, tnY.y));
#else
  vec3 tnX = texture2D(triNormal, triUX).xyz * 2.0 - 1.0;
  vec3 tnY = texture2D(triNormal, triUY).xyz * 2.0 - 1.0;
  vec3 tnZ = texture2D(triNormal, triUZ).xyz * 2.0 - 1.0;
  tnX.xy *= triNormalScale; tnY.xy *= triNormalScale; tnZ.xy *= triNormalScale;
  tnX = vec3(tnX.xy + triN.zy, abs(tnX.z) * triN.x);
  tnY = vec3(tnY.xy + triN.xz, abs(tnY.z) * triN.y);
  tnZ = vec3(tnZ.xy + triN.xy, abs(tnZ.z) * triN.z);
  vec3 triNW = normalize(tnX.zyx * triW.x + tnY.xzy * triW.y + tnZ.xyz * triW.z);
#endif
  normal = normalize((viewMatrix * vec4(triNW, 0.0)).xyz);
}`);
  };
  return mat;
}
