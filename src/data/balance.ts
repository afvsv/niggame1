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
  automation: {
    // Belts. Segments are placed from a free chain end to the aim point, snapped to the grid.
    beltSpeedMps: 0.7, // base; × belt.speed upgrades
    beltPricePerM: 8,
    segmentMinM: 1,
    segmentMaxM: 2.5,
    joinTolM: 0.35, // a new segment may start at an existing free end within this distance
    kioskJoinM: 2.5, // a belt ending this close to the kiosk belt hands its load over
    snapM: 0.5, // build grid
    gapM: 0.9, // minimum space between wads on a belt
    wadMaxStrands: 100, // a rake wad merges up to this, then a new wad starts
    yardItemCap: 400, // wads across all belts; the final number is Ivan's call after ?bench
    // Rake: pulls strands from the stack onto an adjacent belt start.
    rakeStrandsPerSec: 12, // final value after the playtest (candidate 40–60)
    rakeKw: 0.8,
    rakePrice: 120,
    rakeWidthM: 1.0, // base intake width; × rake.width upgrades (add)
    rakeReachM: 2.2, // intake box depth towards the stack
    rakePickM: 1.5, // a belt start within this of the output gets the wads
    // Generator: burns hay fuel, powers machines within a radius.
    generatorKw: 6,
    generatorPrice: 150,
    burnPerSec: 0.83, // at full 6 kW load; scales with the draw
    fuelCap: 100, // strands in the firebox
    powerRadiusM: 8,
    // Building mode.
    demolishHoldS: 0.5, // hold [X] to demolish; refund is 100%
    refundPct: 1,
  },
} as const;
