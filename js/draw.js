/* All in-world drawing: props, gore, pickups, survivors and the horde. */

import { TAU, clamp, rr, circle } from "./util.js";
import { WORLD, bgCanvas, obstacles as obstaclesForDraw } from "./world.js";
import {
  game,
  player,
  zombies,
  bullets,
  enemyProjectiles,
  pickups,
  particles,
  decals,
  damageNumbers,
} from "./state.js";

/* --------------------------------------------------------------- ground */

export function drawGround(ctx) {
  ctx.drawImage(bgCanvas, 0, 0, WORLD, WORLD);
}

/* --------------------------------------------------------------- props */

function drawCar(ctx, o) {
  const { w, h } = o;
  const body = o.color || "#4b4c48";
  const trim = o.trim || "#24251f";

  // wheels
  ctx.fillStyle = "#0b0d0d";
  const wheelW = w * 0.17;
  const wheelH = h * 0.16;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      rr(ctx, sx * (w * 0.3) - wheelW / 2, sy * (h * 0.46) - wheelH / 2, wheelW, wheelH, 4);
      ctx.fill();
    }
  }

  rr(ctx, -w / 2, -h / 2, w, h, 13);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // body shading
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "rgba(255,255,255,0.13)");
  g.addColorStop(0.42, "rgba(255,255,255,0.02)");
  g.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = g;
  rr(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 11);
  ctx.fill();

  // cabin / windscreen
  const cabW = w * 0.42;
  const cabH = h * 0.66;
  rr(ctx, -w * 0.1 - cabW / 2, -cabH / 2, cabW, cabH, 7);
  ctx.fillStyle = o.type === "police" ? "#1c2933" : trim;
  ctx.fill();
  ctx.strokeStyle = "rgba(190,210,208,0.18)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // glass
  ctx.fillStyle = "rgba(84,118,124,0.24)";
  rr(ctx, -w * 0.1 - cabW / 2 + 3, -cabH / 2 + 4, cabW - 6, cabH - 8, 4);
  ctx.fill();

  // broken windscreen crack
  ctx.strokeStyle = "rgba(220,240,238,0.22)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, -cabH * 0.3);
  ctx.lineTo(-w * 0.06, -cabH * 0.06);
  ctx.lineTo(-w * 0.14, cabH * 0.16);
  ctx.lineTo(-w * 0.01, cabH * 0.34);
  ctx.stroke();

  // hood + trunk seams
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, -h * 0.34);
  ctx.lineTo(w * 0.28, h * 0.34);
  ctx.moveTo(-w * 0.42, -h * 0.34);
  ctx.lineTo(-w * 0.42, h * 0.34);
  ctx.stroke();

  // headlights
  ctx.fillStyle = "rgba(226,218,176,0.5)";
  rr(ctx, w / 2 - 6, -h * 0.34, 4, h * 0.16, 2);
  ctx.fill();
  rr(ctx, w / 2 - 6, h * 0.18, 4, h * 0.16, 2);
  ctx.fill();
  ctx.fillStyle = "rgba(168,42,30,0.65)";
  rr(ctx, -w / 2 + 2, -h * 0.34, 4, h * 0.15, 2);
  ctx.fill();
  rr(ctx, -w / 2 + 2, h * 0.19, 4, h * 0.15, 2);
  ctx.fill();

  // rust and grime
  ctx.fillStyle = "rgba(96,58,34,0.32)";
  for (const [rx, ry, rs] of [
    [-w * 0.36, -h * 0.3, 7],
    [w * 0.4, h * 0.31, 5],
    [-w * 0.05, h * 0.36, 6],
  ]) {
    circle(ctx, rx, ry, rs);
    ctx.fill();
  }

  if (o.type === "police") {
    ctx.fillStyle = "rgba(225,230,220,0.5)";
    rr(ctx, -w * 0.05, -h * 0.5, w * 0.34, h * 0.13, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(60,120,210,0.8)";
    rr(ctx, -w * 0.06, -h * 0.5, 7, h * 0.13, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220,40,30,0.8)";
    rr(ctx, 4, -h * 0.5, 7, h * 0.13, 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.font = "700 9px Rajdhani, Arial, sans-serif";
    ctx.fillStyle = "rgba(235,240,232,0.42)";
    ctx.textAlign = "center";
    ctx.fillText("POLICE", 0, 4);
    ctx.restore();
  }

  if (o.type === "van") {
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -h * 0.34);
    ctx.lineTo(-w * 0.28, h * 0.34);
    ctx.moveTo(-w * 0.02, -h * 0.3);
    ctx.lineTo(-w * 0.02, h * 0.3);
    ctx.stroke();
    ctx.fillStyle = "rgba(198,190,160,0.16)";
    rr(ctx, -w * 0.4, -h * 0.4, w * 0.2, h * 0.8, 2);
    ctx.fill();
  }
}

function drawBarricade(ctx, o) {
  const { w, h } = o;
  rr(ctx, -w / 2, -h / 2, w, h, 4);
  ctx.fillStyle = "#6b6a60";
  ctx.fill();
  ctx.strokeStyle = "#31322e";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  rr(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 2);
  ctx.clip();
  ctx.fillStyle = "rgba(218,208,186,0.2)";
  for (let i = -w; i < w; i += 26) {
    ctx.save();
    ctx.translate(i, 0);
    ctx.rotate(-0.6);
    ctx.fillRect(0, -h, 10, h * 2);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(216,114,34,0.4)";
  ctx.fillRect(-w / 2, -h / 2, w, 4);
  ctx.fillRect(-w / 2, h / 2 - 4, w, 4);
  ctx.restore();

  // legs
  ctx.fillStyle = "#2d2f2b";
  rr(ctx, -w * 0.4, h / 2 - 2, 10, 8, 2);
  ctx.fill();
  rr(ctx, w * 0.4 - 10, h / 2 - 2, 10, 8, 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, -h * 0.2);
  ctx.lineTo(-w * 0.05, h * 0.1);
  ctx.lineTo(w * 0.16, h * 0.25);
  ctx.stroke();
}

function drawDumpster(ctx, o) {
  const { w, h } = o;
  rr(ctx, -w / 2, -h / 2, w, h, 5);
  ctx.fillStyle = o.color || "#3d4a3d";
  ctx.fill();
  ctx.strokeStyle = "rgba(10,14,12,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  rr(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h * 0.4, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(170,180,168,0.16)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 5, 0);
  ctx.lineTo(w / 2 - 5, 0);
  ctx.moveTo(-w / 2 + 5, h * 0.22);
  ctx.lineTo(w / 2 - 5, h * 0.22);
  ctx.stroke();
  ctx.fillStyle = "rgba(106,58,34,0.32)";
  circle(ctx, -w * 0.26, h * 0.2, 7);
  ctx.fill();
  circle(ctx, w * 0.33, -h * 0.1, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(214,216,204,0.18)";
  rr(ctx, -w * 0.2, -h * 0.1, w * 0.4, h * 0.2, 2);
  ctx.fill();
}

function drawCrate(ctx, o) {
  const { w, h } = o;
  rr(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.fillStyle = "#5b4a32";
  ctx.fill();
  ctx.strokeStyle = "#2c2417";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(210,184,134,0.18)";
  ctx.lineWidth = 1.2;
  for (let i = -w / 2 + 6; i < w / 2; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, -h / 2 + 3);
    ctx.lineTo(i, h / 2 - 3);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(20,15,8,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 4, -h / 2 + 4);
  ctx.lineTo(w / 2 - 4, h / 2 - 4);
  ctx.moveTo(w / 2 - 4, -h / 2 + 4);
  ctx.lineTo(-w / 2 + 4, h / 2 - 4);
  ctx.stroke();
}

function drawBarrel(ctx, o, fire) {
  const r = o.r;
  ctx.fillStyle = fire ? "#3c3028" : "#39433f";
  circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(8,10,9,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(190,196,182,0.18)";
  ctx.lineWidth = 1.3;
  circle(ctx, 0, 0, r * 0.7);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.fillStyle = fire ? "rgba(255,140,40,0.25)" : "rgba(180,180,150,0.12)";
  circle(ctx, 0, 0, r * 0.42);
  ctx.fill();
  if (fire) {
    const flick = 0.7 + Math.sin(game.time * 9 + o.x) * 0.2;
    ctx.fillStyle = `rgba(255,${120 + Math.sin(game.time * 13) * 30},40,${0.5 * flick})`;
    circle(ctx, 0, 0, r * 0.58);
    ctx.fill();
  }
}

export function drawObstacle(ctx, o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.type !== "barrel" && o.type !== "firebarrel") ctx.rotate(o.angle || 0);
  switch (o.type) {
    case "car":
    case "van":
    case "police":
      drawCar(ctx, o);
      break;
    case "barricade":
      drawBarricade(ctx, o);
      break;
    case "dumpster":
      drawDumpster(ctx, o);
      break;
    case "crate":
      drawCrate(ctx, o);
      break;
    case "barrel":
      drawBarrel(ctx, o, false);
      break;
    case "firebarrel":
      drawBarrel(ctx, o, true);
      break;
    default:
      break;
  }
  ctx.restore();
}

export function drawObstacles(ctx) {
  for (const o of obstaclesForDraw) drawObstacle(ctx, o);
}

/* --------------------------------------------------------------- gore */

export function drawDecals(ctx) {
  for (const d of decals) {
    const fade = clamp(d.life / 6, 0, 1);
    if (d.type === "corpse") {
      ctx.save();
      ctx.globalAlpha = 0.7 * fade;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color || "#2e352d";
      ctx.beginPath();
      ctx.ellipse(0, 0, d.size * 0.6, d.size * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#6f6350";
      circle(ctx, d.size * 0.5, 0, d.size * 0.24);
      ctx.fill();
      ctx.strokeStyle = "#262c25";
      ctx.lineWidth = d.size * 0.16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-d.size * 0.3, -d.size * 0.2);
      ctx.lineTo(-d.size * 0.68, -d.size * 0.42);
      ctx.moveTo(-d.size * 0.3, d.size * 0.2);
      ctx.lineTo(-d.size * 0.62, d.size * 0.46);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = d.alpha * fade;
      ctx.fillStyle = d.color;
      for (const b of d.blobs) {
        circle(ctx, d.x + b.x, d.y + b.y, b.r);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------- pickups */

export function drawPickups(ctx) {
  for (const p of pickups) {
    const bob = Math.sin(game.time * 3 + p.seed) * 4;
    const pulse = 0.75 + Math.sin(game.time * 4 + p.seed) * 0.25;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(3, 12, 13, 6, 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.16 * pulse;
    ctx.fillStyle = p.type === "medkit" ? "#ff5a48" : p.type === "ammo" ? "#ffc45e" : "#6fe8ff";
    circle(ctx, 0, 0, 25);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = p.type === "medkit" ? "rgba(255,90,72,0.7)" : p.type === "ammo" ? "rgba(255,196,94,0.7)" : "rgba(111,232,255,0.7)";
    ctx.lineWidth = 1.4;
    circle(ctx, 0, 0, 15 + Math.sin(game.time * 4 + p.seed) * 1.5);
    ctx.stroke();

    if (p.type === "medkit") {
      rr(ctx, -11, -9, 22, 18, 3);
      ctx.fillStyle = "#e7e2d5";
      ctx.fill();
      ctx.fillStyle = "#b5281d";
      ctx.fillRect(-2.5, -6, 5, 12);
      ctx.fillRect(-6, -2.5, 12, 5);
    } else if (p.type === "ammo") {
      rr(ctx, -11, -8, 22, 16, 2);
      ctx.fillStyle = "#8b6a2e";
      ctx.fill();
      ctx.strokeStyle = "#e5b95d";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#f4cf7e";
      for (let i = -1; i <= 1; i++) {
        rr(ctx, i * 6 - 2, -5, 4, 10, 1);
        ctx.fill();
      }
    } else {
      ctx.save();
      ctx.rotate(-0.5);
      ctx.fillStyle = "#d8f6ff";
      rr(ctx, -10, -2, 20, 4, 2);
      ctx.fill();
      ctx.fillStyle = "#54d6ef";
      rr(ctx, -3, -3.5, 6, 7, 2);
      ctx.fill();
      ctx.strokeStyle = "#8ce9ff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(-10, 0);
      ctx.moveTo(10, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

/* -------------------------------------------------------------- horde */

const ZSTYLE = {
  walker: { skin: "#82936a", shirt: "#4a5b47", pants: "#303a2e", eye: "#d9f06a", scale: 1 },
  runner: { skin: "#a47c65", shirt: "#6c3d32", pants: "#352a26", eye: "#ff7a4f", scale: 0.9 },
  brute: { skin: "#788066", shirt: "#4b5142", pants: "#2e332b", eye: "#ffb347", scale: 1.55 },
  spitter: { skin: "#98a86c", shirt: "#5a6a45", pants: "#323a29", eye: "#a6ff5b", scale: 1.04 },
};

export function drawZombie(ctx, z) {
  const s = ZSTYLE[z.type] || ZSTYLE.walker;
  const scale = s.scale;
  const hit = z.hitFlash || 0;
  const step = Math.sin(z.anim) * 3.6;
  const step2 = Math.sin(z.anim + Math.PI) * 3.6;

  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.beginPath();
  ctx.ellipse(z.x + 4 * scale, z.y + 7 * scale, 15 * scale, 8 * scale, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.angle);
  ctx.scale(scale, scale);

  // legs
  ctx.strokeStyle = s.pants;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(-9 + step, -7);
  ctx.moveTo(-6, 6);
  ctx.lineTo(-9 + step2, 7);
  ctx.stroke();
  ctx.strokeStyle = "#1a1d18";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-9 + step, -7);
  ctx.lineTo(-12 + step, -7.5);
  ctx.moveTo(-9 + step2, 7);
  ctx.lineTo(-12 + step2, 7.5);
  ctx.stroke();

  // arms reaching forward
  ctx.strokeStyle = s.skin;
  ctx.lineWidth = 5.2;
  ctx.beginPath();
  ctx.moveTo(3, -9);
  ctx.lineTo(14 + Math.sin(z.anim * 0.8) * 1.4, -10);
  ctx.moveTo(3, 9);
  ctx.lineTo(14 + Math.sin(z.anim * 0.8 + 1) * 1.4, 10);
  ctx.stroke();
  ctx.fillStyle = s.skin;
  circle(ctx, 15.5, -10, 2.7);
  ctx.fill();
  circle(ctx, 15.5, 10, 2.7);
  ctx.fill();

  // torso
  ctx.fillStyle = s.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 10.5, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = "rgba(190,215,170,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // shirt tears and blood
  ctx.fillStyle = "rgba(88,16,12,0.55)";
  ctx.beginPath();
  ctx.ellipse(-2, 3.4, 5, 3, 0.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(25,30,24,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(-1, -2);
  ctx.lineTo(-4, 1);
  ctx.stroke();

  // head
  ctx.fillStyle = s.skin;
  circle(ctx, 8.5, 0, 6.6);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(30,28,20,0.55)";
  ctx.beginPath();
  ctx.ellipse(6.4, -2.2, 4.3, 3, -0.2, 0, TAU);
  ctx.fill();

  // mouth / jaw
  ctx.fillStyle = "rgba(40,12,10,0.8)";
  ctx.beginPath();
  ctx.ellipse(12.2, 0, 2.2, 1.4, 0, 0, TAU);
  ctx.fill();

  if (z.type === "spitter") {
    ctx.fillStyle = "rgba(150,205,72,0.55)";
    circle(ctx, -4, -7, 3.4);
    ctx.fill();
    circle(ctx, -5, 7, 3);
    ctx.fill();
    circle(ctx, -8, 0, 2.6);
    ctx.fill();
  }
  if (z.type === "brute") {
    ctx.strokeStyle = "rgba(180,190,160,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(5, -3);
    ctx.moveTo(-8, 6);
    ctx.lineTo(5, 3);
    ctx.stroke();
  }

  if (hit > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55 * hit;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(1, 0, 14, 11, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();

  if (z.type === "brute" && z.hp < z.maxHp) {
    const w = 34;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(z.x - w / 2, z.y - 30, w, 3);
    ctx.fillStyle = "#e8693d";
    ctx.fillRect(z.x - w / 2, z.y - 30, w * clamp(z.hp / z.maxHp, 0, 1), 3);
  }
}

/* -------------------------------------------------------------- player */

export function drawPlayer(ctx) {
  // dash ghosts
  for (const t of player.trail) {
    ctx.save();
    ctx.globalAlpha = 0.16 * t.life;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.aim);
    ctx.fillStyle = "#ffc35c";
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 11, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath();
  ctx.ellipse(player.x + 4, player.y + 8, 16, 9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  const blink = player.invuln > 0 ? 0.55 + Math.sin(game.time * 40) * 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = blink;
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aim);

  // legs
  const step = Math.sin(player.walk) * 5;
  const step2 = Math.sin(player.walk + Math.PI) * 5;
  ctx.strokeStyle = "#222b27";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.lineTo(-11 + step, -7);
  ctx.moveTo(-7, 6);
  ctx.lineTo(-11 + step2, 7);
  ctx.stroke();
  ctx.strokeStyle = "#101413";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-11 + step, -7);
  ctx.lineTo(-14 + step, -7.4);
  ctx.moveTo(-11 + step2, 7);
  ctx.lineTo(-14 + step2, 7.4);
  ctx.stroke();

  // backpack
  ctx.fillStyle = "#26352c";
  rr(ctx, -19, -10, 12, 20, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,140,120,0.2)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#405746";
  rr(ctx, -17, -7, 7, 14, 3);
  ctx.fill();

  // torso / jacket
  ctx.fillStyle = "#3b5344";
  ctx.beginPath();
  ctx.ellipse(-1, 0, 15, 11.5, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = "rgba(235,210,165,0.2)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Amber rim keeps the survivor readable in the dark.
  ctx.save();
  ctx.strokeStyle = "rgba(255,178,63,0.3)";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 16.5, 13, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,196,96,0.6)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 16, 12.4, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  const jg = ctx.createLinearGradient(0, -11, 0, 11);
  jg.addColorStop(0, "rgba(190,215,190,0.14)");
  jg.addColorStop(0.5, "rgba(0,0,0,0)");
  jg.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 14, 10.5, 0, 0, TAU);
  ctx.fill();

  // shoulders / straps
  ctx.strokeStyle = "#1b241f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  ctx.lineTo(2, -9);
  ctx.moveTo(-10, 8);
  ctx.lineTo(2, 9);
  ctx.stroke();
  ctx.fillStyle = "#c4a13e";
  ctx.fillRect(-4, -10, 3, 3);

  // arms
  ctx.strokeStyle = "#33483b";
  ctx.lineWidth = 5.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(3, -9);
  ctx.lineTo(15, -7);
  ctx.moveTo(3, 9);
  ctx.lineTo(13, 6);
  ctx.stroke();
  ctx.strokeStyle = "#c99c73";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(15, -7);
  ctx.lineTo(19, -5);
  ctx.moveTo(13, 6);
  ctx.lineTo(17, 4);
  ctx.stroke();

  // pistol
  ctx.fillStyle = "#151a1b";
  rr(ctx, 17, -3.6, 13, 4.8, 1.5);
  ctx.fill();
  ctx.fillStyle = "#3a4444";
  rr(ctx, 18, -3, 8, 2.2, 1);
  ctx.fill();
  ctx.fillStyle = "#0d1111";
  rr(ctx, 18, 0, 3.4, 5, 1);
  ctx.fill();

  // head
  ctx.fillStyle = "#d8ad80";
  circle(ctx, 3.5, 0, 7.2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#26302a";
  ctx.beginPath();
  ctx.ellipse(2.2, -1.4, 6.2, 5.3, -0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#3b4d41";
  ctx.beginPath();
  ctx.ellipse(1.6, -1.8, 5.3, 4.1, -0.2, 0, TAU);
  ctx.fill();

  // scarf
  ctx.fillStyle = "#a23828";
  rr(ctx, 1, 4, 6, 3, 1.5);
  ctx.fill();

  // flashlight body
  ctx.fillStyle = "#20292a";
  rr(ctx, 16, 4, 7, 3, 1.4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,244,200,0.9)";
  circle(ctx, 23.4, 5.5, 1.4);
  ctx.fill();

  // muzzle flash
  if (player.muzzle > 0) {
    const m = player.muzzle;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = m;
    const g = ctx.createRadialGradient(31, -1, 0, 31, -1, 16);
    g.addColorStop(0, "rgba(255,255,225,0.8)");
    g.addColorStop(0.25, "rgba(255,200,90,0.62)");
    g.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(31, -1, 16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,246,200,0.8)";
    ctx.beginPath();
    ctx.moveTo(28, -1);
    ctx.lineTo(37, -4.5);
    ctx.lineTo(34, -1);
    ctx.lineTo(39, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  if (player.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 * player.hitFlash;
    ctx.fillStyle = "#ff3b2c";
    circle(ctx, player.x, player.y, 22);
    ctx.fill();
    ctx.restore();
  }
}

/* ------------------------------------------------------------- bullets */

export function drawBullets(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const b of bullets) {
    const tx = b.x - b.vx * 0.016;
    const ty = b.y - b.vy * 0.016;
    ctx.strokeStyle = "rgba(255,150,40,0.34)";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,238,190,0.95)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEnemyProjectiles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of enemyProjectiles) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
    g.addColorStop(0, "rgba(210,255,120,0.95)");
    g.addColorStop(0.35, "rgba(150,230,60,0.55)");
    g.addColorStop(1, "rgba(100,200,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(230,255,180,0.9)";
    circle(ctx, p.x, p.y, 3.4);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------ particles */

export function drawParticles(ctx) {
  for (const p of particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    if (p.type === "spark" || p.type === "ember" || p.type === "acid") continue;
    ctx.globalAlpha = a * (p.alpha ?? 1);
    ctx.fillStyle = p.color;
    if (p.type === "blood") {
      circle(ctx, p.x, p.y, p.size);
      ctx.fill();
    } else if (p.type === "smoke") {
      circle(ctx, p.x, p.y, p.size * (1.8 - a * 0.8));
      ctx.fill();
    } else if (p.type === "casing") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-2.4, -1, 4.8, 2);
      ctx.restore();
    } else {
      circle(ctx, p.x, p.y, p.size);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const p of particles) {
    if (p.type !== "spark" && p.type !== "ember" && p.type !== "acid") continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.type === "spark" ? 1.4 : p.size;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawDamageNumbers(ctx) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const n of damageNumbers) {
    const a = clamp(n.life / n.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `700 ${n.size}px Rajdhani, Arial, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(n.text, n.x, n.y);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.x, n.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------ glow pass */

export function drawZombieEyes(ctx, camera, zoom, toScreen) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const z of zombies) {
    const s = ZSTYLE[z.type] || ZSTYLE.walker;
    const scale = s.scale;
    const ca = Math.cos(z.angle);
    const sa = Math.sin(z.angle);
    const hx = z.x + ca * 8.5 * scale;
    const hy = z.y + sa * 8.5 * scale;
    const ex = -sa * 2.4 * scale;
    const ey = ca * 2.4 * scale;
    const p1 = toScreen(hx + ex, hy + ey);
    const p2 = toScreen(hx - ex, hy - ey);
    const r = Math.max(1.1, 1.7 * zoom * scale);
    ctx.fillStyle = s.eye;
    ctx.shadowColor = s.eye;
    ctx.shadowBlur = 8 * zoom;
    circle(ctx, p1.x, p1.y, r);
    ctx.fill();
    circle(ctx, p2.x, p2.y, r);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPlayerLens(ctx, toScreen, zoom) {
  const ca = Math.cos(player.aim);
  const sa = Math.sin(player.aim);
  const x = player.x + ca * 23 - sa * 5.5;
  const y = player.y + sa * 23 + ca * 5.5;
  const p = toScreen(x, y);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22 * zoom);
  g.addColorStop(0, "rgba(255,248,214,0.9)");
  g.addColorStop(0.35, "rgba(255,228,150,0.4)");
  g.addColorStop(1, "rgba(255,220,140,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 22 * zoom, 0, TAU);
  ctx.fill();
  ctx.restore();
}
