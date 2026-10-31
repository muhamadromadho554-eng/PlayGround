/* Gameplay simulation: movement, shooting, horde, drops, waves, death. */

import {
  TAU,
  clamp,
  lerp,
  rnd,
  angleLerp,
  segDist2,
  dist2,
  store,
} from "./util.js";
import {
  WORLD,
  CENTER,
  obstacles,
  resolveObstacles,
  pointBlocked,
} from "./world.js";
import {
  game,
  player,
  upgrades,
  view,
  camera,
  input,
  tilt,
  zombies,
  bullets,
  enemyProjectiles,
  pickups,
  particles,
  decals,
  damageNumbers,
  resetPlayer,
  resetUpgrades,
} from "./state.js";
import { applyPerk } from "./perks.js";

const H = {
  sound: { play() {}, startAmbient() {}, stopAmbient() {}, setIntensity() {} },
  toast: () => {},
  updateHUD: () => {},
  onWaveClear: () => {},
  onDeath: () => {},
  showWaveBanner: () => {},
  onRunStart: () => {},
};

export function initSim(hooks) {
  Object.assign(H, hooks);
}

const TYPES = {
  walker: { hp: 34, speed: 52, damage: 9, r: 15, score: 100 },
  runner: { hp: 22, speed: 102, damage: 6, r: 12, score: 150 },
  brute: { hp: 175, speed: 35, damage: 22, r: 26, score: 350 },
  spitter: { hp: 52, speed: 44, damage: 8, r: 16, score: 250 },
};

let nextId = 1;
let ambientTimer = 0;

/* ------------------------------------------------------------ lifecycle */

export function startRun() {
  resetPlayer();
  resetUpgrades();
  zombies.length = 0;
  bullets.length = 0;
  enemyProjectiles.length = 0;
  pickups.length = 0;
  particles.length = 0;
  decals.length = 0;
  damageNumbers.length = 0;

  Object.assign(game, {
    state: "playing",
    runTime: 0,
    wave: 1,
    score: 0,
    kills: 0,
    combo: 1,
    comboTimer: 0,
    spawnBudget: 0,
    spawnTimer: 0,
    waveClearTimer: 0,
    killsSinceDrop: 0,
    shake: 0,
    hitPulse: 0,
    newBest: false,
    demo: false,
  });
  camera.x = CENTER;
  camera.y = CENTER;
  beginWave(1);
  H.onRunStart();
}

export function startDemo() {
  resetPlayer();
  zombies.length = 0;
  bullets.length = 0;
  enemyProjectiles.length = 0;
  pickups.length = 0;
  particles.length = 0;
  decals.length = 0;
  damageNumbers.length = 0;
  Object.assign(game, {
    state: "menu",
    demo: true,
    shake: 0,
    hitPulse: 0,
    wave: 1,
    score: 0,
    kills: 0,
    combo: 1,
  });
  camera.x = CENTER;
  camera.y = CENTER;
  player.aim = -Math.PI / 2;

  const ring = [
    ["walker", 240, 0.4, 0.09],
    ["walker", 320, 2.3, -0.07],
    ["runner", 290, 4.1, 0.12],
    ["walker", 400, 5.2, -0.05],
    ["brute", 370, 3.4, 0.04],
    ["walker", 460, 1.1, -0.08],
    ["runner", 430, 5.9, 0.1],
    ["walker", 350, 0.1, 0.06],
    ["spitter", 480, 2.7, -0.06],
    ["walker", 300, 3.8, 0.08],
  ];
  for (const [type, radius, a, speed] of ring) {
    const base = TYPES[type];
    const z = {
      id: nextId++,
      type,
      x: CENTER + Math.cos(a) * radius,
      y: CENTER + Math.sin(a) * radius,
      r: base.r,
      hp: base.hp,
      maxHp: base.hp,
      speed: base.speed,
      damage: base.damage,
      score: base.score,
      angle: 0,
      anim: rnd(TAU),
      attackCd: 0,
      shootCd: 2,
      kx: 0,
      ky: 0,
      hitFlash: 0,
      lunge: 0,
      seed: rnd(100),
      orbitA: a,
      orbitR: radius,
      orbitSpeed: speed,
    };
    zombies.push(z);
  }
  addBlood(CENTER - 180, CENTER + 150, 7, 1.2);
  addBlood(CENTER + 240, CENTER - 110, 5, 0.9);
  addBlood(CENTER + 70, CENTER + 300, 6, 1);
  spawnPickup("medkit", CENTER - 250, CENTER - 120);
  spawnPickup("ammo", CENTER + 260, CENTER + 160);
}

/* ---------------------------------------------------------------- update */

export function updateSim(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * (10 + game.shake * 1.6));
  game.hitPulse = Math.max(0, game.hitPulse - dt * 2.5);

  if (game.state === "menu") {
    updateDemo(dt);
    updateParticles(dt);
    updateDecals(dt);
    updateAmbient(dt);
    updateMenuCamera(dt);
    return;
  }

  if (game.state === "playing") {
    game.runTime += dt;
    updatePlayer(dt);
    updateSpawning(dt);
    updateZombies(dt);
    updateBullets(dt);
    updateEnemyProjectiles(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateDecals(dt);
    updateDamageNumbers(dt);
    updateAmbient(dt);
    updateCamera(dt);
    updateCombo(dt);

    if (game.state === "playing" && game.spawnBudget === 0 && zombies.length === 0) {
      game.waveClearTimer += dt;
      if (game.waveClearTimer > 1.05) {
        game.state = "upgrade";
        player.hp = clamp(player.hp + 12, 0, player.maxHp);
        player.invuln = Math.max(player.invuln, 1);
        H.sound.play("reloadDone");
        H.onWaveClear(game.wave);
      }
    } else if (game.state === "playing") {
      game.waveClearTimer = 0;
    }
    return;
  }

  // Paused / upgrade / game over: keep the scene breathing a little.
  updateParticles(dt * 0.35);
  updateDecals(dt);
  if (game.state === "gameover") updateCamera(dt);
}

function updateDemo(dt) {
  const nearest = nearestZombie(player.x, player.y, 1200);
  if (nearest) {
    const a = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    player.aim = angleLerp(player.aim, a, 1 - Math.exp(-1.8 * dt));
  }
  for (const z of zombies) {
    z.orbitA += z.orbitSpeed * dt;
    z.x = player.x + Math.cos(z.orbitA) * z.orbitR;
    z.y = player.y + Math.sin(z.orbitA) * z.orbitR;
    const a = Math.atan2(player.y - z.y, player.x - z.x);
    z.angle = a + Math.sin(game.time * 0.7 + z.seed) * 0.22;
    z.anim += dt * (1.6 + z.speed / 60);
  }
  player.walk += dt * 0.6;
}

function updateMenuCamera(dt) {
  camera.x = CENTER + Math.sin(game.time * 0.07) * 90;
  camera.y = CENTER + Math.cos(game.time * 0.055) * 52;
}

/* ---------------------------------------------------------------- player */

function updatePlayer(dt) {
  const k = input.keys;
  let ix = 0;
  let iy = 0;
  if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
  if (k.has("KeyW") || k.has("ArrowUp")) iy -= 1;
  if (k.has("KeyS") || k.has("ArrowDown")) iy += 1;

  const move = input.sticks.move;
  if (move.active && move.mag > 0.12) {
    ix += move.dx * move.mag;
    iy += move.dy * move.mag;
  } else if (tilt.enabled) {
    ix += tilt.x;
    iy += tilt.y;
  }

  const mag = Math.hypot(ix, iy);
  if (mag > 1) {
    ix /= mag;
    iy /= mag;
  }

  const target = nearestZombie(player.x, player.y, 900);
  const aimStick = input.sticks.aim;
  const mouseAim = () => {
    const wx = camera.x + (input.mouse.x - view.w / 2) / view.zoom;
    const wy = camera.y + (input.mouse.y - view.h / 2) / view.zoom;
    player.aim = Math.atan2(wy - player.y, wx - player.x);
  };
  if (aimStick.active && aimStick.mag > 0.16) {
    player.aim = aimStick.angle;
  } else if (input.mouse.down) {
    mouseAim();
  } else if (target) {
    const a = Math.atan2(target.y - player.y, target.x - player.x);
    player.aim = angleLerp(player.aim, a, 1 - Math.exp(-13 * dt));
  } else if (input.mouse.active) {
    mouseAim();
  }

  const speedMul = (player.stim > 0 ? 1.24 : 1) * (player.rapid > 0 ? 1.03 : 1);
  if (player.dashT > 0) {
    player.dashT -= dt;
    player.vx = player.dashX * 760;
    player.vy = player.dashY * 760;
    player.invuln = Math.max(player.invuln, 0.12);
    player.trail.push({ x: player.x, y: player.y, aim: player.aim, life: 1 });
    player.walk += dt * 28;
  } else {
    const desiredX = ix * upgrades.speed * speedMul;
    const desiredY = iy * upgrades.speed * speedMul;
    const smooth = 1 - Math.exp(-15 * dt);
    player.vx = lerp(player.vx, desiredX, smooth);
    player.vy = lerp(player.vy, desiredY, smooth);
    if (Math.abs(player.vx) < 0.6) player.vx = 0;
    if (Math.abs(player.vy) < 0.6) player.vy = 0;
    player.walk += Math.hypot(player.vx, player.vy) * dt * 0.065;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  resolveObstacles(player);

  for (let i = player.trail.length - 1; i >= 0; i--) {
    player.trail[i].life -= dt * 4.5;
    if (player.trail[i].life <= 0) player.trail.splice(i, 1);
  }
  if (player.trail.length > 9) player.trail.splice(0, player.trail.length - 9);

  player.fireTimer -= dt;
  player.invuln = Math.max(0, player.invuln - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt * 3.2);
  player.muzzle = Math.max(0, player.muzzle - dt * 9);
  player.rapid = Math.max(0, player.rapid - dt);
  player.stim = Math.max(0, player.stim - dt);
  player.dashCd = Math.max(0, player.dashCd - dt);

  if (player.reloading) {
    player.reloadT += dt;
    if (player.reloadT >= upgrades.reloadTime) {
      player.reloading = false;
      player.reloadT = 0;
      player.mag = player.magSize;
      H.sound.play("reloadDone");
    }
  } else if (player.mag <= 0) {
    startReload();
  }

  const manual = (aimStick.active && aimStick.mag > 0.16) || (input.mouse.active && input.mouse.down);
  const autoTarget = target && dist2(player.x, player.y, target.x, target.y) < 760 * 760;
  if ((manual || autoTarget) && player.mag > 0 && !player.reloading && player.fireTimer <= 0) {
    fire();
  }
}

export function doDash() {
  if (game.state !== "playing" || player.dead || player.dashCd > 0) return false;
  const move = input.sticks.move;
  let dx = 0;
  let dy = 0;
  if (move.active && move.mag > 0.12) {
    dx = move.dx * move.mag;
    dy = move.dy * move.mag;
  } else if (tilt.enabled) {
    dx = tilt.x;
    dy = tilt.y;
  }
  if (Math.hypot(dx, dy) < 0.15) {
    dx = Math.cos(player.aim);
    dy = Math.sin(player.aim);
  }
  const len = Math.hypot(dx, dy) || 1;
  player.dashX = dx / len;
  player.dashY = dy / len;
  player.dashT = 0.17;
  player.dashCd = upgrades.dashCd;
  player.invuln = Math.max(player.invuln, 0.32);
  game.shake = Math.min(9, game.shake + 3);
  H.sound.play("dash");
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: player.x + rnd(14, -14),
      y: player.y + rnd(14, -14),
      vx: -player.dashX * rnd(140, 40) + rnd(40, -40),
      vy: -player.dashY * rnd(140, 40) + rnd(40, -40),
      life: rnd(0.5, 0.25),
      maxLife: 0.5,
      size: rnd(4, 1.5),
      color: "rgba(190,190,170,0.5)",
      type: "smoke",
      alpha: 0.6,
    });
  }
  return true;
}

export function reload() {
  if (game.state !== "playing" || player.reloading || player.mag >= player.magSize) return;
  startReload();
}

function startReload() {
  if (player.reloading || player.mag >= player.magSize || game.state !== "playing") return;
  player.reloading = true;
  player.reloadT = 0;
  H.sound.play("reload");
}

function fire() {
  player.mag -= 1;
  const rapid = player.rapid > 0 ? 1.45 : 1;
  player.fireTimer = 1 / (upgrades.fireRate * rapid);
  const shots = upgrades.shots;
  const spread = upgrades.spread;
  for (let i = 0; i < shots; i++) {
    const offset = (i - (shots - 1) / 2) * spread + rnd(0.014, -0.014);
    const a = player.aim + offset;
    const mx = player.x + Math.cos(a) * 27 - Math.sin(a) * 1;
    const my = player.y + Math.sin(a) * 27 + Math.cos(a) * 1;
    bullets.push({
      x: mx,
      y: my,
      px: mx,
      py: my,
      vx: Math.cos(a) * upgrades.bulletSpeed,
      vy: Math.sin(a) * upgrades.bulletSpeed,
      life: 0.7,
      dmg: upgrades.damage,
      pierce: upgrades.pierce,
      hit: new Set(),
    });
  }
  player.muzzle = 1;
  player.vx -= Math.cos(player.aim) * 11;
  player.vy -= Math.sin(player.aim) * 11;
  game.shake = Math.min(10, game.shake + 1.1);
  H.sound.play("gun");

  const ca = Math.cos(player.aim);
  const sa = Math.sin(player.aim);
  const mx = player.x + ca * 30;
  const my = player.y + sa * 30;
  for (let i = 0; i < 4; i++) {
    particles.push({
      x: mx,
      y: my,
      vx: ca * rnd(120, 20) + rnd(40, -40),
      vy: sa * rnd(120, 20) + rnd(40, -40),
      life: rnd(0.28, 0.1),
      maxLife: 0.28,
      size: rnd(3, 1),
      color: "rgba(255,190,80,0.8)",
      type: "spark",
    });
  }
  for (let i = 0; i < 2; i++) {
    particles.push({
      x: mx,
      y: my,
      vx: ca * rnd(30, 5) + rnd(12, -12),
      vy: sa * rnd(30, 5) + rnd(12, -12),
      life: rnd(0.6, 0.3),
      maxLife: 0.6,
      size: rnd(5, 2),
      color: "rgba(130,130,120,0.28)",
      type: "smoke",
    });
  }
  // shell casing
  particles.push({
    x: player.x - sa * 4,
    y: player.y + ca * 4,
    vx: -sa * rnd(150, 60) + ca * rnd(-20, -50),
    vy: ca * rnd(150, 60) + sa * rnd(-20, -50),
    life: 0.9,
    maxLife: 0.9,
    size: 2,
    color: "#d8ae58",
    type: "casing",
    rot: rnd(TAU),
  });

  if (player.mag <= 0) startReload();
}

/* --------------------------------------------------------------- horde */

function pickType(wave) {
  const r = Math.random();
  if (wave < 2) return "walker";
  if (wave < 3) return r < 0.72 ? "walker" : "runner";
  if (wave < 4) return r < 0.58 ? "walker" : r < 0.86 ? "runner" : "brute";
  if (wave < 5) return r < 0.5 ? "walker" : r < 0.78 ? "runner" : r < 0.93 ? "brute" : "spitter";
  return r < 0.44 ? "walker" : r < 0.72 ? "runner" : r < 0.86 ? "brute" : "spitter";
}

function spawnZombie() {
  const type = pickType(game.wave);
  const base = TYPES[type];
  const minHalf = Math.min(view.w / (2 * view.zoom), view.h / (2 * view.zoom));
  const near = clamp(minHalf * 0.82, 195, 350);
  const far = near + 125;
  let x = player.x;
  let y = player.y;
  for (let tries = 0; tries < 40; tries++) {
    const a = rnd(TAU);
    const d = rnd(far, near);
    const tx = clamp(player.x + Math.cos(a) * d, 180, WORLD - 180);
    const ty = clamp(player.y + Math.sin(a) * d, 180, WORLD - 180);
    if (!pointBlocked(tx, ty, 28)) {
      x = tx;
      y = ty;
      break;
    }
  }
  const hpScale = 1 + (game.wave - 1) * 0.13;
  const speedScale = 1 + Math.min(0.45, (game.wave - 1) * 0.024);
  const z = {
    id: nextId++,
    type,
    x,
    y,
    r: base.r,
    hp: base.hp * hpScale,
    maxHp: base.hp * hpScale,
    speed: base.speed * speedScale,
    damage: base.damage,
    score: base.score,
    angle: Math.atan2(player.y - y, player.x - x),
    anim: rnd(TAU),
    attackCd: rnd(0.8, 0.2),
    shootCd: rnd(2.8, 1.4),
    kx: 0,
    ky: 0,
    hitFlash: 0,
    lunge: 0,
    seed: rnd(100),
  };
  zombies.push(z);
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: x + rnd(14, -14),
      y: y + rnd(14, -14),
      vx: rnd(20, -20),
      vy: rnd(20, -20),
      life: rnd(0.7, 0.3),
      maxLife: 0.7,
      size: rnd(6, 2),
      color: "rgba(100,110,100,0.18)",
      type: "smoke",
    });
  }
}

function updateSpawning(dt) {
  if (game.spawnBudget <= 0) return;
  game.spawnTimer -= dt;
  const maxAlive = Math.min(44, 14 + game.wave * 2);
  if (game.spawnTimer <= 0 && zombies.length < maxAlive) {
    spawnZombie();
    game.spawnBudget -= 1;
    game.spawnTimer = Math.max(0.26, 0.78 - game.wave * 0.04);
  }
}

function updateZombies(dt) {
  for (const z of zombies) {
    if (z.dead) continue;
    z.attackCd -= dt;
    z.shootCd -= dt;
    z.hitFlash = Math.max(0, z.hitFlash - dt * 4.2);
    z.lunge = Math.max(0, z.lunge - dt * 5);

    const dx = player.x - z.x;
    const dy = player.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    let ux = dx / d;
    let uy = dy / d;

    if (z.type === "spitter") {
      if (d < 230) {
        ux = -ux;
        uy = -uy;
      } else if (d < 360) {
        const s = Math.sin(game.time * 1.3 + z.seed) > 0 ? 1 : -1;
        const tx = ux;
        ux = -uy * s;
        uy = tx * s;
      }
      if (z.shootCd <= 0 && d < 620) {
        z.shootCd = rnd(3.2, 2.1);
        const a = Math.atan2(player.y - z.y, player.x - z.x) + rnd(0.07, -0.07);
        enemyProjectiles.push({
          x: z.x + Math.cos(a) * 18,
          y: z.y + Math.sin(a) * 18,
          vx: Math.cos(a) * 305,
          vy: Math.sin(a) * 305,
          life: 3.4,
          damage: 10,
        });
        H.sound.play("spit");
      }
    } else if (z.type === "runner") {
      const weave = Math.sin(game.time * 5.5 + z.seed) * 0.42;
      const tx = ux;
      ux += -uy * weave;
      uy += tx * weave;
      const l = Math.hypot(ux, uy) || 1;
      ux /= l;
      uy /= l;
    }

    // Separate from the rest of the horde so they don't stack into one blob.
    let sepX = 0;
    let sepY = 0;
    for (const o of zombies) {
      if (o === z || o.dead) continue;
      const ox = z.x - o.x;
      const oy = z.y - o.y;
      const min = z.r + o.r + 3;
      const dd = ox * ox + oy * oy;
      if (dd > 0.01 && dd < min * min) {
        const od = Math.sqrt(dd);
        sepX += (ox / od) * (min - od);
        sepY += (oy / od) * (min - od);
      }
    }

    z.kx *= Math.exp(-7 * dt);
    z.ky *= Math.exp(-7 * dt);
    z.x += (ux * z.speed + z.kx + sepX * 7) * dt;
    z.y += (uy * z.speed + z.ky + sepY * 7) * dt;
    resolveObstacles(z);

    const toPlayer = Math.atan2(player.y - z.y, player.x - z.x);
    z.angle = angleLerp(z.angle, toPlayer, 1 - Math.exp(-8 * dt));
    z.anim += dt * (2 + z.speed / 28);

    const hitDist = z.r + player.r + 4;
    if (d < hitDist && z.attackCd <= 0) {
      z.attackCd = z.type === "brute" ? 1.25 : 0.9;
      z.lunge = 1;
      damagePlayer(z.damage, z.x, z.y);
      if (z.type === "brute") H.sound.play("brute");
    }
  }

  for (let i = zombies.length - 1; i >= 0; i--) {
    if (zombies[i].dead) zombies.splice(i, 1);
  }
}

function damageZombie(z, amount, angle) {
  z.hp -= amount;
  z.hitFlash = 1;
  z.kx += Math.cos(angle) * 95;
  z.ky += Math.sin(angle) * 95;
  const hx = z.x - Math.cos(angle) * z.r * 0.5;
  const hy = z.y - Math.sin(angle) * z.r * 0.5;
  for (let i = 0; i < 4; i++) {
    particles.push({
      x: hx + rnd(6, -6),
      y: hy + rnd(6, -6),
      vx: Math.cos(angle) * rnd(150, 30) + rnd(60, -60),
      vy: Math.sin(angle) * rnd(150, 30) + rnd(60, -60),
      life: rnd(0.5, 0.22),
      maxLife: 0.5,
      size: rnd(3.4, 1.2),
      color: "rgba(120,16,12,0.85)",
      type: "blood",
    });
  }
  damageNumbers.push({
    x: z.x + rnd(8, -8),
    y: z.y - z.r - 6,
    text: String(Math.round(amount)),
    color: "#ffe0a4",
    size: 13,
    life: 0.65,
    maxLife: 0.65,
    vy: 34,
  });
  H.sound.play("hit");
  if (z.hp <= 0) killZombie(z, angle);
}

function killZombie(z, angle) {
  z.dead = true;
  game.kills += 1;
  game.combo = Math.min(10, game.combo + 1);
  game.comboTimer = 2.7;
  game.score += Math.round(z.score * game.combo * (1 + game.wave * 0.03));
  game.killsSinceDrop += 1;
  if (upgrades.lifesteal > 0) {
    player.hp = clamp(player.hp + upgrades.lifesteal, 0, player.maxHp);
  }
  addBlood(z.x, z.y, z.type === "brute" ? 18 : 11, z.type === "brute" ? 1.8 : 1.1);
  decals.push({
    type: "corpse",
    x: z.x,
    y: z.y,
    rot: z.angle,
    size: z.type === "brute" ? 46 : 28,
    color: z.type === "runner" ? "#3b2a25" : "#30382d",
    life: 24,
  });
  capDecals();
  for (let i = 0; i < 16; i++) {
    const a = rnd(TAU);
    const sp = rnd(210, 40);
    particles.push({
      x: z.x + rnd(8, -8),
      y: z.y + rnd(8, -8),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rnd(0.75, 0.25),
      maxLife: 0.75,
      size: rnd(4.2, 1.2),
      color: i % 3 === 0 ? "rgba(160,28,20,0.85)" : "rgba(100,12,10,0.8)",
      type: "blood",
    });
  }
  game.shake = Math.min(14, game.shake + (z.type === "brute" ? 4 : 1.6));
  H.sound.play("kill");

  const boost = upgrades.dropBoost;
  const roll = Math.random();
  if (game.killsSinceDrop >= 16 || roll < 0.09 * boost) {
    spawnPickup("ammo", z.x, z.y);
    game.killsSinceDrop = 0;
  } else if (roll < 0.09 * boost + 0.12 * boost) {
    spawnPickup("medkit", z.x, z.y);
  } else if (roll < 0.09 * boost + 0.12 * boost + 0.055 * boost) {
    spawnPickup("adrenaline", z.x, z.y);
  }
}

/* -------------------------------------------------------------- bullets */

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;

    if (!dead && pointBlocked(b.x, b.y, 0)) {
      dead = true;
      for (let j = 0; j < 3; j++) {
        particles.push({
          x: b.x,
          y: b.y,
          vx: rnd(90, -90),
          vy: rnd(90, -90),
          life: rnd(0.22, 0.08),
          maxLife: 0.22,
          size: rnd(2.2, 1),
          color: "rgba(255,200,110,0.9)",
          type: "spark",
        });
      }
    }

    if (!dead) {
      for (const z of zombies) {
        if (z.dead || b.hit.has(z.id)) continue;
        const rr = z.r + 3;
        if (segDist2(z.x, z.y, b.px, b.py, b.x, b.y) < rr * rr) {
          b.hit.add(z.id);
          damageZombie(z, b.dmg, Math.atan2(b.vy, b.vx));
          b.pierce -= 1;
          if (b.pierce < 0) {
            dead = true;
            break;
          }
        }
      }
    }

    if (dead) bullets.splice(i, 1);
  }
}

/* ------------------------------------------------------------- projectiles */

function updateEnemyProjectiles(dt) {
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    let dead = p.life <= 0;
    if (!dead && Math.hypot(p.x - player.x, p.y - player.y) < player.r + 6) {
      damagePlayer(p.damage, p.x, p.y);
      dead = true;
    }
    if (!dead && pointBlocked(p.x, p.y, 0)) {
      dead = true;
      acidSplat(p.x, p.y);
    }
    if (dead) {
      for (let j = 0; j < 5; j++) {
        particles.push({
          x: p.x,
          y: p.y,
          vx: rnd(80, -80),
          vy: rnd(80, -80),
          life: rnd(0.35, 0.1),
          maxLife: 0.35,
          size: rnd(2.6, 1),
          color: "rgba(170,255,80,0.8)",
          type: "acid",
        });
      }
      enemyProjectiles.splice(i, 1);
    }
  }
}

function acidSplat(x, y) {
  const blobs = [];
  for (let i = 0; i < 5; i++) {
    const a = rnd(TAU);
    const d = Math.sqrt(Math.random()) * 14;
    blobs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rnd(5, 1.5) });
  }
  decals.push({
    type: "blood",
    x,
    y,
    blobs,
    color: "rgba(96,140,30,0.5)",
    alpha: 0.55,
    life: 18,
  });
  capDecals();
}

/* --------------------------------------------------------------- player damage */

export function damagePlayer(amount, sx, sy) {
  if (game.state !== "playing" || player.dead || player.invuln > 0 || player.dashT > 0) return;
  player.hp -= amount;
  player.invuln = 0.66;
  player.hitFlash = 1;
  game.hitPulse = 1;
  game.shake = Math.min(24, game.shake + amount * 0.55);
  game.combo = 1;
  game.comboTimer = 0;
  const a = Math.atan2(player.y - sy, player.x - sx);
  player.vx += Math.cos(a) * 150;
  player.vy += Math.sin(a) * 150;
  addBlood(player.x, player.y, 5, 0.7);
  for (let i = 0; i < 8; i++) {
    const ang = rnd(TAU);
    particles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(ang) * rnd(160, 30),
      vy: Math.sin(ang) * rnd(160, 30),
      life: rnd(0.5, 0.2),
      maxLife: 0.5,
      size: rnd(3.6, 1),
      color: "rgba(170,20,14,0.85)",
      type: "blood",
    });
  }
  H.sound.play("hurt");
  if (player.hp <= 0) die();
}

function die() {
  player.hp = 0;
  player.dead = true;
  game.state = "gameover";
  game.shake = 30;
  addBlood(player.x, player.y, 26, 2.1);
  decals.push({ type: "corpse", x: player.x, y: player.y, rot: player.aim, size: 40, color: "#2a3a30", life: 30 });
  capDecals();
  for (let i = 0; i < 30; i++) {
    const a = rnd(TAU);
    particles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(a) * rnd(260, 40),
      vy: Math.sin(a) * rnd(260, 40),
      life: rnd(0.9, 0.3),
      maxLife: 0.9,
      size: rnd(4.6, 1.4),
      color: "rgba(150,18,12,0.9)",
      type: "blood",
    });
  }
  H.sound.play("gameover");
  H.sound.stopAmbient();
  const newBest = game.score > game.best.score;
  if (newBest) {
    game.best = { score: game.score, wave: game.wave };
    store("lastlight.best", JSON.stringify(game.best));
  }
  game.newBest = newBest;
  H.onDeath({
    wave: game.wave,
    score: game.score,
    kills: game.kills,
    time: game.runTime,
    newBest,
  });
}

/* -------------------------------------------------------------- pickups */

function spawnPickup(type, x, y) {
  const a = rnd(TAU);
  const d = rnd(18, 2);
  pickups.push({
    type,
    x: x + Math.cos(a) * d,
    y: y + Math.sin(a) * d,
    seed: rnd(TAU),
    life: 28,
    bob: rnd(TAU),
  });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < upgrades.magnet) {
      const pull = (1 - d / upgrades.magnet) * 420 + 60;
      p.x += (dx / d) * pull * dt;
      p.y += (dy / d) * pull * dt;
    }
    if (d < 28) {
      collectPickup(p);
      pickups.splice(i, 1);
      continue;
    }
    if (p.life <= 0) pickups.splice(i, 1);
  }
}

function collectPickup(p) {
  H.sound.play("pickup");
  for (let i = 0; i < 10; i++) {
    const a = rnd(TAU);
    particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * rnd(120, 20),
      vy: Math.sin(a) * rnd(120, 20) - 30,
      life: rnd(0.55, 0.2),
      maxLife: 0.55,
      size: rnd(3, 1),
      color: p.type === "medkit" ? "rgba(255,100,80,0.9)" : p.type === "ammo" ? "rgba(255,200,100,0.9)" : "rgba(120,230,255,0.9)",
      type: "spark",
    });
  }
  if (p.type === "medkit") {
    player.hp = clamp(player.hp + 35, 0, player.maxHp);
    H.toast("MEDKIT  +35 HP");
  } else if (p.type === "ammo") {
    player.mag = player.magSize;
    player.reloading = false;
    player.reloadT = 0;
    player.rapid = Math.max(player.rapid, 5);
    H.toast("AMMO CRATE  ·  RAPID FIRE");
  } else {
    player.stim = 6;
    player.rapid = Math.max(player.rapid, 4);
    player.hp = clamp(player.hp + 8, 0, player.maxHp);
    H.toast("STIM  ·  SPEED + FIRE RATE");
  }
}

/* --------------------------------------------------------------- waves */

export function beginWave(n) {
  game.wave = n;
  game.spawnBudget = 6 + n * 3;
  game.spawnTimer = 0.55;
  game.waveClearTimer = 0;
  player.invuln = Math.max(player.invuln, 0.8);
  const burst = Math.min(3, game.spawnBudget);
  for (let i = 0; i < burst; i++) {
    spawnZombie();
    game.spawnBudget -= 1;
  }
  H.sound.play("wave");
  H.showWaveBanner(n);
}

export function choosePerk(id) {
  const perk = applyPerk(id);
  if (!perk) return null;
  game.state = "playing";
  player.invuln = Math.max(player.invuln, 1);
  beginWave(game.wave + 1);
  return perk;
}

/* -------------------------------------------------------------- particles */

function addBlood(x, y, amount, size) {
  const blobs = [];
  for (let i = 0; i < amount; i++) {
    const a = rnd(TAU);
    const d = Math.sqrt(Math.random()) * 26 * size;
    blobs.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d,
      r: rnd(5, 1.2) * size,
    });
  }
  decals.push({
    type: "blood",
    x,
    y,
    blobs,
    color: "rgba(78,10,8,0.72)",
    alpha: 0.75,
    life: 30,
  });
  capDecals();
}

function capDecals() {
  if (decals.length > 130) decals.splice(0, decals.length - 130);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    if (p.type === "casing") {
      p.vy += 480 * dt;
      p.rot += dt * 10;
      p.vx *= 0.99;
    } else if (p.type === "smoke") {
      p.vy -= 12 * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    } else if (p.type === "spark" || p.type === "ember" || p.type === "acid") {
      p.vx *= 0.96;
      p.vy *= 0.96;
    } else {
      p.vy += 55 * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  if (particles.length > 420) particles.splice(0, particles.length - 420);
}

function updateDecals(dt) {
  for (let i = decals.length - 1; i >= 0; i--) {
    decals[i].life -= dt;
    if (decals[i].life <= 0) decals.splice(i, 1);
  }
}

function updateDamageNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const n = damageNumbers[i];
    n.life -= dt;
    n.y -= (n.vy || 30) * dt;
    if (n.life <= 0) damageNumbers.splice(i, 1);
  }
}

function updateAmbient(dt) {
  ambientTimer -= dt;
  if (ambientTimer > 0) return;
  ambientTimer = 0.08;
  for (const o of obstacles) {
    if (o.type !== "firebarrel") continue;
    if (Math.random() > 0.75) {
      particles.push({
        x: o.x + rnd(10, -10),
        y: o.y + rnd(4, -4),
        vx: rnd(20, -20),
        vy: rnd(-20, -50),
        life: rnd(1.2, 0.4),
        maxLife: 1.2,
        size: rnd(2.2, 0.8),
        color: "rgba(255,170,60,0.9)",
        type: "ember",
      });
    }
  }
}

/* ---------------------------------------------------------------- camera */

function updateCamera(dt) {
  const lead = 24;
  const tx = player.x + Math.cos(player.aim) * lead;
  const ty = player.y + Math.sin(player.aim) * lead;
  const halfW = view.w / (2 * view.zoom);
  const halfH = view.h / (2 * view.zoom);
  const minX = Math.min(halfW, CENTER);
  const maxX = Math.max(WORLD - halfW, CENTER);
  const minY = Math.min(halfH, CENTER);
  const maxY = Math.max(WORLD - halfH, CENTER);
  const smooth = 1 - Math.exp(-7.5 * dt);
  camera.x = lerp(camera.x, clamp(tx, minX, maxX), smooth);
  camera.y = lerp(camera.y, clamp(ty, minY, maxY), smooth);
}

function updateCombo(dt) {
  if (game.combo > 1) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 1;
      game.comboTimer = 0;
    }
  }
}

function nearestZombie(x, y, maxDist) {
  let best = null;
  let bd = maxDist * maxDist;
  for (const z of zombies) {
    if (z.dead) continue;
    const d = dist2(x, y, z.x, z.y);
    if (d < bd) {
      bd = d;
      best = z;
    }
  }
  return best;
}

/* ---------------------------------------------------------------- extras */

export function setTiltVector(x, y) {
  tilt.x = x;
  tilt.y = y;
}
