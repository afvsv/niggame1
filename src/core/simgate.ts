/**
 * The simulation runs only while the player is in play: pointer locked and no screen open.
 * The kiosk belt, the hay trucks and anything else automatic uses this gate; while it is
 * false the world holds still (no belts, no trucks, no sim ticking).
 */
export const simActive = (locked: boolean, screenOpen: boolean): boolean => locked && !screenOpen;
