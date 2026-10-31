/* Frame composition: camera, lighting, glows, joysticks and screen effects. */

import { TAU, clamp } from "./util.js";
import { obstacles, drawPropShadow } from "./world.js";
import {
  game,
  player,
  camera,
  view,
  input,
  tilt,
  zombies,
  pickups,
  enemyProjectiles,
} from "./state.js";
import {
  drawGround,
  drawObstacles,
  drawDecals,
  drawPickups,
  drawZombie,
  drawPlayer,
  drawBullets,
  drawEnemyProjectiles,
  drawParticles,
  drawDamageNumbers,
  drawZombieEyes,
  drawPlayerLens,
} from "./draw.js";

let grainPattern = null;

function makeGrain(ctx) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  g.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(c, "repeat");
}

export function render(ctx, lctx, lightCanvas) {
  const { w, h, dpr, zoom } = view;
  if (!grainPattern) makeGrain(ctx);

  const shake = game.shake;
  const sx = shake > 0.1 ? (Math.random() * 2 - 1) * shake : 0;
  const sy = shake > 0.1 ? (Math.random() * 2 - 1) * shake : 0;
  const cam = { x: camera.x + sx, y: camera.y + sy };

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#050809";
  ctx.fillRect(0, 0, w, h);

  const toScreen = (x, y) => ({
    x: (x - cam.x) * zoom + w / 2,
    y: (y - cam.y) * zoom + h / 2,
  });

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  drawGround(ctx);
  drawDecals(ctx);

  for (const o of obstacles) drawPropShadow(ctx, o);
  drawObstacles(ctx);

  drawPickups(ctx);

  const actors = zombies.slice();
  actors.push(player);
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) {
    if (a === player) drawPlayer(ctx);
    else drawZombie(ctx, a);
  }

  drawBullets(ctx);
  drawEnemyProjectiles(ctx);
  drawParticles(ctx);
  drawDamageNumbers(ctx);

  ctx.restore();

  drawLighting(ctx, lctx, lightCanvas, cam);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(58,92,106,0.045)";
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.restore();
  drawGlows(ctx, cam);
  drawZombieEyes(ctx, cam, zoom, toScreen);
  drawPlayerLens(ctx, toScreen, zoom);
  drawVignette(ctx);
  drawGrain(ctx);
  drawJoysticks(ctx);
  drawReticle(ctx);
}

/* -------------------------------------------------------------- lighting */

function drawLighting(ctx, lctx, lightCanvas, cam) {
  const { w, h, dpr, zoom } = view;
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.clearRect(0, 0, w, h);
  lctx.globalCompositeOperation = "source-over";
  lctx.fillStyle = game.state === "menu" ? "rgba(2,5,8,0.73)" : "rgba(2,5,8,0.755)";
  lctx.fillRect(0, 0, w, h);

  const px = (player.x - cam.x) * zoom + w / 2;
  const py = (player.y - cam.y) * zoom + h / 2;
  lctx.globalCompositeOperation = "destination-out";

  // Ambient halo.
  let g = lctx.createRadialGradient(px, py, 0, px, py, 320 * zoom);
  g.addColorStop(0, "rgba(0,0,0,0.94)");
  g.addColorStop(0.4, "rgba(0,0,0,0.7)");
  g.addColorStop(0.78, "rgba(0,0,0,0.26)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  lctx.fillStyle = g;
  lctx.beginPath();
  lctx.arc(px, py, 320 * zoom, 0, TAU);
  lctx.fill();

  // Flashlight: a chain of soft pools that merge into a beam.
  const ca = Math.cos(player.aim);
  const sa = Math.sin(player.aim);
  const pools = [
    [0, 158, 0.56],
    [92, 184, 0.5],
    [190, 210, 0.42],
    [296, 236, 0.34],
    [408, 258, 0.25],
    [520, 276, 0.16],
  ];
  for (const [d, r, a] of pools) {
    const x = px + ca * d * zoom;
    const y = py + sa * d * zoom;
    const rr2 = r * zoom;
    const cg = lctx.createRadialGradient(x, y, 0, x, y, rr2);
    cg.addColorStop(0, `rgba(0,0,0,${a})`);
    cg.addColorStop(0.42, `rgba(0,0,0,${a * 0.74})`);
    cg.addColorStop(0.74, `rgba(0,0,0,${a * 0.3})`);
    cg.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = cg;
    lctx.beginPath();
    lctx.arc(x, y, rr2, 0, TAU);
    lctx.fill();
  }

  // Muzzle flash light.
  if (player.muzzle > 0) {
    const ca = Math.cos(player.aim);
    const sa = Math.sin(player.aim);
    const mx = (player.x + ca * 34 - sa * 1 - cam.x) * zoom + w / 2;
    const my = (player.y + sa * 34 + ca * 1 - cam.y) * zoom + h / 2;
    const mr = 240 * zoom * (0.6 + player.muzzle * 0.4);
    g = lctx.createRadialGradient(mx, my, 0, mx, my, mr);
    g.addColorStop(0, `rgba(0,0,0,${0.95 * player.muzzle})`);
    g.addColorStop(0.4, `rgba(0,0,0,${0.55 * player.muzzle})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.arc(mx, my, mr, 0, TAU);
    lctx.fill();
  }

  // Fire barrels and pickups carve small holes in the night.
  for (const o of obstacles) {
    if (o.type !== "firebarrel") continue;
    const x = (o.x - cam.x) * zoom + w / 2;
    const y = (o.y - cam.y) * zoom + h / 2;
    const r = (150 + Math.sin(game.time * 7 + o.x) * 18) * zoom;
    g = lctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.78)");
    g.addColorStop(0.55, "rgba(0,0,0,0.34)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.arc(x, y, r, 0, TAU);
    lctx.fill();
  }
  for (const p of pickups) {
    const x = (p.x - cam.x) * zoom + w / 2;
    const y = (p.y - cam.y) * zoom + h / 2;
    g = lctx.createRadialGradient(x, y, 0, x, y, 58 * zoom);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.arc(x, y, 58 * zoom, 0, TAU);
    lctx.fill();
  }
  for (const p of enemyProjectiles) {
    const x = (p.x - cam.x) * zoom + w / 2;
    const y = (p.y - cam.y) * zoom + h / 2;
    g = lctx.createRadialGradient(x, y, 0, x, y, 46 * zoom);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.arc(x, y, 46 * zoom, 0, TAU);
    lctx.fill();
  }

  lctx.globalCompositeOperation = "source-over";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(lightCanvas, 0, 0, w, h);
}

/* ---------------------------------------------------------------- glows */

function drawGlows(ctx, cam) {
  const { w, h, dpr, zoom } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Flashlight spill and a soft hero light around the survivor.
  const hx = (player.x - cam.x) * zoom + w / 2;
  const hy = (player.y - cam.y) * zoom + h / 2;
  const hero = ctx.createRadialGradient(hx, hy, 0, hx, hy, 52 * zoom);
  hero.addColorStop(0, "rgba(255,196,110,0.2)");
  hero.addColorStop(0.45, "rgba(255,160,70,0.08)");
  hero.addColorStop(1, "rgba(255,140,50,0)");
  ctx.fillStyle = hero;
  ctx.beginPath();
  ctx.arc(hx, hy, 52 * zoom, 0, TAU);
  ctx.fill();

  // Warm spill following the same soft pools as the flashlight.
  const ca = Math.cos(player.aim);
  const sa = Math.sin(player.aim);
  const spill = [
    [48, 82, 0.14],
    [150, 100, 0.105],
    [270, 122, 0.075],
    [400, 142, 0.048],
    [520, 158, 0.028],
  ];
  for (const [d, r, a] of spill) {
    const x = hx + ca * d * zoom;
    const y = hy + sa * d * zoom;
    const rr2 = r * zoom;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr2);
    g.addColorStop(0, `rgba(255,234,176,${a})`);
    g.addColorStop(0.5, `rgba(255,206,130,${a * 0.55})`);
    g.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr2, 0, TAU);
    ctx.fill();
  }

  // Fire barrels
  for (const o of obstacles) {
    if (o.type !== "firebarrel") continue;
    const x = (o.x - cam.x) * zoom + w / 2;
    const y = (o.y - cam.y) * zoom + h / 2;
    const flick = 0.82 + Math.sin(game.time * 11 + o.x) * 0.12 + Math.sin(game.time * 23) * 0.06;
    const r = 95 * zoom * flick;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,185,80,0.34)");
    g.addColorStop(0.35, "rgba(255,120,30,0.18)");
    g.addColorStop(1, "rgba(255,90,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(255,205,120,0.55)";
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(game.time * (9 + i * 2.3) + i * 2) * 3;
      ctx.beginPath();
      ctx.ellipse(x + (i - 1) * 5 * zoom, y - (7 + i * 3) * zoom + f, 4 * zoom, (9 + i * 2) * zoom, 0.2 * (i - 1), 0, TAU);
      ctx.fill();
    }
  }

  // Pickup glow
  for (const p of pickups) {
    const x = (p.x - cam.x) * zoom + w / 2;
    const y = (p.y - cam.y) * zoom + h / 2;
    const col = p.type === "medkit" ? "255,80,60" : p.type === "ammo" ? "255,190,90" : "110,230,255";
    const g = ctx.createRadialGradient(x, y, 0, x, y, 34 * zoom);
    g.addColorStop(0, `rgba(${col},0.3)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 34 * zoom, 0, TAU);
    ctx.fill();
  }

  // Acid glow
  for (const p of enemyProjectiles) {
    const x = (p.x - cam.x) * zoom + w / 2;
    const y = (p.y - cam.y) * zoom + h / 2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 24 * zoom);
    g.addColorStop(0, "rgba(180,255,90,0.4)");
    g.addColorStop(1, "rgba(120,230,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 24 * zoom, 0, TAU);
    ctx.fill();
  }

  // Muzzle glow
  if (player.muzzle > 0) {
    const ca = Math.cos(player.aim);
    const sa = Math.sin(player.aim);
    const x = (player.x + ca * 33 - cam.x) * zoom + w / 2;
    const y = (player.y + sa * 33 - cam.y) * zoom + h / 2;
    const mr = 40 * zoom * player.muzzle;
    const g = ctx.createRadialGradient(x, y, 0, x, y, mr);
    g.addColorStop(0, "rgba(255,240,190,0.36)");
    g.addColorStop(0.3, "rgba(255,170,60,0.15)");
    g.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, mr, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

/* --------------------------------------------------------------- screen */

function drawVignette(ctx) {
  const { w, h } = view;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.72, "rgba(0,0,0,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0.66)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (player.hitFlash > 0) {
    const r = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.7);
    r.addColorStop(0, "rgba(190,20,12,0)");
    r.addColorStop(0.7, `rgba(190,20,12,${0.16 * player.hitFlash})`);
    r.addColorStop(1, `rgba(150,8,4,${0.5 * player.hitFlash})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawGrain(ctx) {
  if (!grainPattern) return;
  const { w, h } = view;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.translate(-Math.random() * 64, -Math.random() * 64);
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, w + 128, h + 128);
  ctx.restore();
}

/* ------------------------------------------------------------- joysticks */

function stickBase(stick, fallback) {
  return stick.active ? { x: stick.baseX, y: stick.baseY } : fallback;
}

function drawStick(ctx, stick, defX, defY, label, color, tiltMode) {
  const active = stick.active;
  const bx = active ? stick.baseX : defX;
  const by = active ? stick.baseY : defY;
  const r = stick.radius;
  const knobR = stick.knob;
  const alpha = active ? 1 : 0.52;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Outer rings
  ctx.strokeStyle = active ? "rgba(255,178,63,0.4)" : "rgba(236,230,214,0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = active ? "rgba(255,178,63,0.16)" : "rgba(236,230,214,0.08)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.arc(bx, by, r * 0.72, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cross ticks
  ctx.strokeStyle = active ? "rgba(255,178,63,0.3)" : "rgba(236,230,214,0.12)";
  ctx.beginPath();
  ctx.moveTo(bx - r - 6, by);
  ctx.lineTo(bx - r + 2, by);
  ctx.moveTo(bx + r - 2, by);
  ctx.lineTo(bx + r + 6, by);
  ctx.moveTo(bx, by - r - 6);
  ctx.lineTo(bx, by - r + 2);
  ctx.moveTo(bx, by + r - 2);
  ctx.lineTo(bx, by + r + 6);
  ctx.stroke();

  // Knob
  let kx = bx;
  let ky = by;
  if (tiltMode) {
    kx = bx + tilt.x * r * 0.5;
    ky = by + tilt.y * r * 0.5;
  } else if (active) {
    kx = bx + stick.dx * stick.mag * r * 0.62;
    ky = by + stick.dy * stick.mag * r * 0.62;
  }

  const grad = ctx.createRadialGradient(kx - knobR * 0.3, ky - knobR * 0.35, 1, kx, ky, knobR);
  grad.addColorStop(0, active || tiltMode ? "rgba(255,226,164,0.9)" : "rgba(236,230,214,0.42)");
  grad.addColorStop(0.55, active || tiltMode ? color : "rgba(236,230,214,0.2)");
  grad.addColorStop(1, active || tiltMode ? "rgba(120,72,20,0.85)" : "rgba(236,230,214,0.08)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(kx, ky, knobR, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = active || tiltMode ? "rgba(255,226,164,0.75)" : "rgba(236,230,214,0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Label
  ctx.globalAlpha = active ? 0.8 : 0.4;
  ctx.fillStyle = active ? "rgba(255,226,164,0.9)" : "rgba(236,230,214,0.6)";
  ctx.font = "700 8px Rajdhani, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bx, by + r + 16);
  ctx.restore();
}

function drawJoysticks(ctx) {
  const { w, h, dpr, isTouchLayout } = view;
  if (!isTouchLayout) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const move = input.sticks.move;
  const aim = input.sticks.aim;

  if (tilt.enabled && !move.active) {
    drawStick(ctx, move, move.defX, move.defY, "TILT", "rgba(255,178,63,0.85)", true);
  } else {
    drawStick(ctx, move, move.defX, move.defY, "MOVE", "rgba(255,178,63,0.85)", false);
  }
  drawStick(ctx, aim, aim.defX, aim.defY, "AIM / FIRE", "rgba(255,120,70,0.9)", false);

  // Aim direction chevrons on the right stick.
  if (aim.active && aim.mag > 0.15) {
    ctx.save();
    ctx.translate(aim.baseX, aim.baseY);
    ctx.rotate(aim.angle);
    ctx.strokeStyle = "rgba(255,150,90,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, aim.radius * 0.92, -0.22, 0.22);
    ctx.stroke();
    ctx.restore();
  }
}

function drawReticle(ctx) {
  if (view.isTouchLayout || !input.mouse.active) return;
  const { dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const x = input.mouse.x;
  const y = input.mouse.y;
  ctx.save();
  ctx.strokeStyle = "rgba(255,190,100,0.7)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, TAU);
  ctx.moveTo(x - 15, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 15, y);
  ctx.moveTo(x, y - 15);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 15);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,190,100,0.8)";
  ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
}
