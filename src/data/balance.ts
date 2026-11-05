// All tunable numbers live here. Systems read from this file, never hardcode values.
export const BALANCE = {
  hay: {
    cellSize: 0.2, // metres per voxel cell
    cellMaxStrands: 10, // strands in a full cell
    pricePerStrand: 0.04, // $ per strand at the counter
  },
  stack: {
    gridX: 64,
    gridY: 48,
    gridZ: 64,
    radiusM: 6.2,
    heightM: 8.5,
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
  reachM: 2.8, // tools and containers live in data/tools.ts
  autosaveSeconds: 15,
} as const;
