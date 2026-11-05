// All tunable numbers live here. Systems read from this file, never hardcode values.
export const BALANCE = {
  hay: {
    cellSize: 0.2, // metres per voxel cell
    cellMaxStrands: 10, // strands in a full cell
    pricePerStrand: 0.04, // $ per strand at the counter
  },
  stack: {
    gridX: 80,
    gridY: 56,
    gridZ: 80,
    radiusM: 7.4,
    heightM: 10,
    seed: 1337,
  },
  player: {
    walkSpeed: 4.2,
    sprintSpeed: 6.5,
    jumpSpeed: 6.2,
    gravity: 20,
    radius: 0.3,
    height: 1.75,
    eyeHeight: 1.6,
    stepHeight: 0.45,
    mouseSensitivity: 0.0022,
  },
  stamina: {
    max: 100,
    regen: 22, // per second, after a short pause
    regenDelay: 0.7, // seconds without spending before it refills
    sprintPerSec: 14,
    recoverAt: 0.3, // out of breath until this share is back
    tiredSlow: 1.8, // swing cooldown multiplier while out of breath
  },
  reachM: 2.8, // tools and containers live in data/tools.ts, needles in data/needles.ts
  gravity: 18, // dropped containers and needles
  autosaveSeconds: 15,
} as const;
