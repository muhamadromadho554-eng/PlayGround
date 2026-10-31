/* Mutable runtime state shared by the simulation and the renderer. */

export const view = {
  w: 0,
  h: 0,
  dpr: 1,
  zoom: 1,
  isTouchLayout: false,
};

export const camera = { x: 1300, y: 1300 };

export const game = {
  state: "menu",
  time: 0,
  runTime: 0,
  wave: 1,
  score: 0,
  kills: 0,
  combo: 1,
  comboTimer: 0,
  best: { score: 0, wave: 0 },
  spawnBudget: 0,
  spawnTimer: 0,
  waveClearTimer: 0,
  killsSinceDrop: 0,
  shake: 0,
  bannerTimer: 0,
  newBest: false,
  demo: true,
  hitPulse: 0,
};

export const upgrades = {
  damage: 15,
  fireRate: 4.3,
  bulletSpeed: 1350,
  pierce: 0,
  shots: 1,
  spread: 0.09,
  reloadTime: 1.15,
  speed: 215,
  dashCd: 2.6,
  lifesteal: 0,
  magnet: 130,
  dropBoost: 1,
  levels: {},
};

export const player = {
  x: 1300,
  y: 1300,
  vx: 0,
  vy: 0,
  r: 17,
  hp: 100,
  maxHp: 100,
  aim: -Math.PI / 2,
  walk: 0,
  fireTimer: 0,
  mag: 12,
  magSize: 12,
  reloading: false,
  reloadT: 0,
  dashT: 0,
  dashCd: 0,
  dashX: 0,
  dashY: 0,
  invuln: 0,
  muzzle: 0,
  hitFlash: 0,
  rapid: 0,
  stim: 0,
  dead: false,
  trail: [],
};

export const zombies = [];
export const bullets = [];
export const enemyProjectiles = [];
export const pickups = [];
export const particles = [];
export const decals = [];
export const damageNumbers = [];

export const input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, down: false, active: false, worldX: 0, worldY: 0 },
  sticks: {
    move: {
      active: false,
      id: null,
      baseX: 0,
      baseY: 0,
      defX: 0,
      defY: 0,
      dx: 0,
      dy: 0,
      mag: 0,
      angle: 0,
      radius: 56,
      knob: 22,
    },
    aim: {
      active: false,
      id: null,
      baseX: 0,
      baseY: 0,
      defX: 0,
      defY: 0,
      dx: 0,
      dy: 0,
      mag: 0,
      angle: 0,
      radius: 56,
      knob: 22,
    },
  },
  touchSeen: false,
};

export const tilt = {
  enabled: false,
  supported: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
  needsPermission:
    typeof window !== "undefined" &&
    typeof window.DeviceOrientationEvent !== "undefined" &&
    typeof window.DeviceOrientationEvent.requestPermission === "function",
  listening: false,
  permission: "unknown",
  rawBeta: 0,
  rawGamma: 0,
  baseBeta: null,
  baseGamma: null,
  x: 0,
  y: 0,
  gotData: false,
};

export function resetPlayer() {
  Object.assign(player, {
    x: 1300,
    y: 1300,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    aim: -Math.PI / 2,
    walk: 0,
    fireTimer: 0,
    mag: 12,
    magSize: 12,
    reloading: false,
    reloadT: 0,
    dashT: 0,
    dashCd: 0,
    dashX: 0,
    dashY: 0,
    invuln: 0,
    muzzle: 0,
    hitFlash: 0,
    rapid: 0,
    stim: 0,
    dead: false,
    trail: [],
  });
}

export function resetUpgrades() {
  Object.assign(upgrades, {
    damage: 15,
    fireRate: 4.3,
    bulletSpeed: 1350,
    pierce: 0,
    shots: 1,
    spread: 0.09,
    reloadTime: 1.15,
    speed: 215,
    dashCd: 2.6,
    lifesteal: 0,
    magnet: 130,
    dropBoost: 1,
    levels: {},
  });
}
