// Shared constants for Solmar Heat: the city grid, the player, the cars, the
// wanted ladder and the save key. One place for every number the systems agree on.
export const SAVE_KEY = 'solmar-heat-save-v1';

// The city is a square grid of blocks. Roads run on the grid lines; blocks sit
// between them. Coordinates are in metres, the city centre is (0, 0).
export const CITY = {
  blocks: 9,            // blocks across (and down)
  block: 34,            // block side, edge to edge
  road: 10,             // road width
  get pitch() { return this.block + this.road; },
  get half() { return (this.blocks * this.pitch - this.road) / 2; },
  get bound() { return this.half + 60; },   // drivable limit incl. beach strip
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.6,
  maxHealth: 100,
};

export const CAR = {
  maxSpeed: 38,         // m/s, about 85 mph
  accel: 16,
  brake: 30,
  reverseSpeed: 12,
  steerRate: 1.9,
  grip: 6.5,
};

export const WANTED = {
  decayDelay: 25,       // seconds without a crime before stars start falling
  decayStep: 10,        // seconds per star once decaying
  bustSeconds: 1.6,     // police contact time on foot that ends in BUSTED
  maxStars: 5,
};

// Cash the player starts with, and what each pickup is worth.
export const START_CASH = 150;
export const START_AMMO = 24;
export const PICKUP_VALUE = 150;
export const PICKUP_COUNT = 12;

// Palette: warm late-afternoon Solmar Bay. Building glass and paint stay
// saturated so the city reads at a glance on the minimap and in screenshots.
export const PALETTE = {
  sky: 0x87b5e0,
  fog: 0xa8c6e0,
  sun: 0xffe3b3,
  ground: 0x8a9a7b,
  sand: 0xe8d29a,
  water: 0x2e7fa8,
  road: 0x2c2f36,
  sidewalk: 0x9aa0a8,
  buildings: [0xd8a06a, 0x7fa8c9, 0xc97f7f, 0x9db98a, 0xb8a8d8, 0xe0c98a, 0x8fb8b0, 0xd98a9a],
  glass: 0x9fd0e8,
  carPaint: [0xc22e2e, 0x2e6fc2, 0xe0a52e, 0x3aa655, 0xe8e8e8, 0x222831, 0x8a5fc2, 0xd96a1e],
  police: 0x1c2733,
  taxi: 0xf2c200,
};
