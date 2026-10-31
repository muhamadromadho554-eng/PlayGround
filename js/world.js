/* Procedural world: ruined city block, road, props and static backdrop. */

import { TAU, clamp, mulberry32, rr, circle } from "./util.js";

export const WORLD = 2600;
export const PLAY_MIN = 150;
export const PLAY_MAX = WORLD - 150;
export const CENTER = WORLD / 2;

/* Cars, barricades, dumpsters and crates are rotated rectangles.
   Barrels are circles. Every prop blocks movement and bullets. */
export const obstacles = [
  { type: "car", x: 820, y: 870, w: 152, h: 74, angle: 0.05, color: "#56584b", trim: "#2b2d26", variant: 1 },
  { type: "car", x: 1740, y: 800, w: 152, h: 74, angle: -0.04, color: "#3e5059", trim: "#222c30", variant: 2 },
  { type: "car", x: 2080, y: 1320, w: 74, h: 152, angle: 0.02, color: "#5a4036", trim: "#2d201b", variant: 3 },
  { type: "car", x: 700, y: 1600, w: 152, h: 74, angle: -0.03, color: "#4b4c4a", trim: "#252625", variant: 1 },
  { type: "car", x: 1530, y: 1840, w: 152, h: 74, angle: 0.04, color: "#3d4a3e", trim: "#202820", variant: 2 },
  { type: "car", x: 1000, y: 2110, w: 152, h: 74, angle: 0.02, color: "#5b4f3b", trim: "#2c251a", variant: 3 },
  { type: "car", x: 2180, y: 2090, w: 152, h: 74, angle: -0.02, color: "#43494c", trim: "#23282a", variant: 1 },
  { type: "car", x: 430, y: 1260, w: 74, h: 152, angle: 0.03, color: "#4c3f45", trim: "#261f22", variant: 2 },
  { type: "van", x: 980, y: 1100, w: 88, h: 174, angle: 0.02, color: "#6b6555", trim: "#2f2c24", variant: 4 },
  { type: "police", x: 1640, y: 1060, w: 156, h: 76, angle: -0.05, color: "#394b5d", trim: "#1d2831", variant: 5 },
  { type: "barricade", x: 1450, y: 1510, w: 126, h: 30, angle: 0.02 },
  { type: "barricade", x: 1190, y: 780, w: 30, h: 126, angle: -0.02 },
  { type: "barricade", x: 550, y: 1200, w: 126, h: 30, angle: 0.03 },
  { type: "barricade", x: 2040, y: 1640, w: 126, h: 30, angle: -0.03 },
  { type: "barricade", x: 1450, y: 2220, w: 126, h: 30, angle: 0.01 },
  { type: "barricade", x: 800, y: 1990, w: 30, h: 126, angle: 0.02 },
  { type: "barricade", x: 1920, y: 1180, w: 30, h: 126, angle: -0.02 },
  { type: "dumpster", x: 520, y: 680, w: 102, h: 68, angle: 0.03, color: "#3c4a3d" },
  { type: "dumpster", x: 2140, y: 1740, w: 102, h: 68, angle: -0.04, color: "#39433f" },
  { type: "dumpster", x: 1560, y: 420, w: 102, h: 68, angle: 0.02, color: "#44413a" },
  { type: "crate", x: 1470, y: 1600, w: 58, h: 58, angle: 0.04 },
  { type: "crate", x: 1532, y: 1600, w: 58, h: 58, angle: -0.03 },
  { type: "crate", x: 640, y: 1360, w: 58, h: 58, angle: 0.02 },
  { type: "crate", x: 2250, y: 1520, w: 58, h: 58, angle: -0.02 },
  { type: "barrel", x: 900, y: 1730, r: 22 },
  { type: "barrel", x: 1080, y: 1830, r: 22 },
  { type: "barrel", x: 1780, y: 1550, r: 22 },
  { type: "barrel", x: 340, y: 1410, r: 22 },
  { type: "barrel", x: 2320, y: 1250, r: 22 },
  { type: "barrel", x: 1300, y: 760, r: 22 },
  { type: "barrel", x: 1200, y: 2150, r: 22 },
  { type: "firebarrel", x: 1720, y: 1240, r: 23 },
];

export function obstacleAABB(o) {
  if (o.type === "barrel" || o.type === "firebarrel") {
    return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
  }
  const a = o.angle || 0;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const hw = (o.w * c + o.h * s) / 2;
  const hh = (o.w * s + o.h * c) / 2;
  return { x: o.x - hw, y: o.y - hh, w: hw * 2, h: hh * 2 };
}

export function circleHitsObstacle(x, y, radius, o) {
  if (o.type === "barrel" || o.type === "firebarrel") {
    const r = radius + o.r;
    return (x - o.x) * (x - o.x) + (y - o.y) * (y - o.y) < r * r;
  }
  const b = obstacleAABB(o);
  const cx = clamp(x, b.x, b.x + b.w);
  const cy = clamp(y, b.y, b.y + b.h);
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius;
}

export function resolveObstacles(ent) {
  for (const o of obstacles) {
    if (o.type === "barrel" || o.type === "firebarrel") {
      const min = ent.r + o.r;
      let dx = ent.x - o.x;
      let dy = ent.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        ent.x = o.x + (dx / d) * min;
        ent.y = o.y + (dy / d) * min;
      }
    } else {
      const b = obstacleAABB(o);
      const cx = clamp(ent.x, b.x, b.x + b.w);
      const cy = clamp(ent.y, b.y, b.y + b.h);
      let dx = ent.x - cx;
      let dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < ent.r * ent.r) {
        if (d2 < 0.0001) {
          // Center is inside the rect: push out on the shortest axis.
          const left = ent.x - b.x;
          const right = b.x + b.w - ent.x;
          const top = ent.y - b.y;
          const bottom = b.y + b.h - ent.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) ent.x = b.x - ent.r;
          else if (m === right) ent.x = b.x + b.w + ent.r;
          else if (m === top) ent.y = b.y - ent.r;
          else ent.y = b.y + b.h + ent.r;
        } else {
          const d = Math.sqrt(d2);
          ent.x = cx + (dx / d) * ent.r;
          ent.y = cy + (dy / d) * ent.r;
        }
      }
    }
  }
  ent.x = clamp(ent.x, PLAY_MIN + ent.r, PLAY_MAX - ent.r);
  ent.y = clamp(ent.y, PLAY_MIN + ent.r, PLAY_MAX - ent.r);
}

export function pointBlocked(x, y, pad = 0) {
  if (x < PLAY_MIN + pad || x > PLAY_MAX - pad || y < PLAY_MIN + pad || y > PLAY_MAX - pad) return true;
  for (const o of obstacles) if (circleHitsObstacle(x, y, pad, o)) return true;
  return false;
}

/* ------------------------------------------------------------------ art */

export const bgCanvas = document.createElement("canvas");
bgCanvas.width = 1300;
bgCanvas.height = 1300;
export const bgCtx = bgCanvas.getContext("2d");

function splat(ctx, x, y, radius, rng, color) {
  ctx.fillStyle = color;
  const count = 7 + Math.floor(rng() * 7);
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * radius;
    const r = radius * (0.08 + rng() * 0.34);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, TAU);
    ctx.fill();
  }
}

export function buildWorldBackground() {
  const c = bgCtx;
  const rng = mulberry32(0xdead11);
  c.setTransform(0.5, 0, 0, 0.5, 0, 0);
  c.clearRect(0, 0, WORLD, WORLD);

  c.fillStyle = "#151a1b";
  c.fillRect(0, 0, WORLD, WORLD);

  // Broad tonal patches under the asphalt.
  for (let i = 0; i < 26; i++) {
    const x = rng() * WORLD;
    const y = rng() * WORLD;
    const r = 160 + rng() * 520;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const light = rng() > 0.45;
    g.addColorStop(0, light ? "rgba(72,82,80,0.09)" : "rgba(0,0,0,0.16)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Sidewalks / curbs framing the intersection.
  c.fillStyle = "#202626";
  c.fillRect(0, 1074, WORLD, 46);
  c.fillRect(0, 1480, WORLD, 46);
  c.fillRect(1074, 0, 46, WORLD);
  c.fillRect(1480, 0, 46, WORLD);
  c.strokeStyle = "rgba(150,160,152,0.12)";
  c.lineWidth = 2;
  c.strokeRect(0, 1074, WORLD, 46);
  c.strokeRect(0, 1480, WORLD, 46);
  c.strokeRect(1074, 0, 46, WORLD);
  c.strokeRect(1480, 0, 46, WORLD);

  // Roadway.
  c.fillStyle = "#101516";
  c.fillRect(0, 1120, WORLD, 360);
  c.fillRect(1120, 0, 360, WORLD);
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.fillRect(0, 1120, WORLD, 8);
  c.fillRect(0, 1472, WORLD, 8);
  c.fillRect(1120, 0, 8, WORLD);
  c.fillRect(1472, 0, 8, WORLD);

  // Faded lane paint.
  c.save();
  c.strokeStyle = "rgba(198,178,112,0.19)";
  c.lineWidth = 4;
  c.setLineDash([46, 44]);
  c.beginPath();
  c.moveTo(0, 1300);
  c.lineTo(WORLD, 1300);
  c.moveTo(1300, 0);
  c.lineTo(1300, WORLD);
  c.stroke();
  c.setLineDash([]);
  c.strokeStyle = "rgba(216,220,206,0.1)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, 1152);
  c.lineTo(WORLD, 1152);
  c.moveTo(0, 1448);
  c.lineTo(WORLD, 1448);
  c.moveTo(1152, 0);
  c.lineTo(1152, WORLD);
  c.moveTo(1448, 0);
  c.lineTo(1448, WORLD);
  c.stroke();
  c.restore();

  // Crosswalk stripes at the intersection.
  c.save();
  c.fillStyle = "rgba(205,210,195,0.13)";
  for (let i = 0; i < 9; i++) {
    const x = 1160 + i * 34;
    c.fillRect(x, 1052, 17, 22);
    c.fillRect(x, 1526, 17, 22);
    const y = 1160 + i * 34;
    c.fillRect(1052, y, 22, 17);
    c.fillRect(1526, y, 22, 17);
  }
  c.restore();

  // Asphalt grain.
  for (let i = 0; i < 6200; i++) {
    const x = rng() * WORLD;
    const y = rng() * WORLD;
    const a = 0.02 + rng() * 0.08;
    c.fillStyle = rng() > 0.55 ? `rgba(180,190,180,${a})` : `rgba(0,0,0,${a})`;
    c.fillRect(x, y, 1 + rng() * 2.6, 1 + rng() * 2.6);
  }

  // Cracks and seams.
  for (let i = 0; i < 64; i++) {
    let x = rng() * WORLD;
    let y = rng() * WORLD;
    let a = rng() * TAU;
    c.strokeStyle = `rgba(0,0,0,${0.18 + rng() * 0.22})`;
    c.lineWidth = 0.8 + rng() * 1.8;
    c.beginPath();
    c.moveTo(x, y);
    const steps = 3 + Math.floor(rng() * 8);
    for (let j = 0; j < steps; j++) {
      a += (rng() - 0.5) * 1.1;
      x += Math.cos(a) * (10 + rng() * 30);
      y += Math.sin(a) * (10 + rng() * 30);
      c.lineTo(x, y);
    }
    c.stroke();
  }

  // Manholes.
  for (const [x, y] of [
    [620, 1240],
    [1840, 1380],
    [1360, 620],
    [1240, 2010],
  ]) {
    c.fillStyle = "rgba(5,7,7,0.55)";
    c.beginPath();
    c.ellipse(x, y, 27, 27, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(120,130,124,0.18)";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(x, y, 21, 21, 0, 0, TAU);
    c.stroke();
    c.strokeStyle = "rgba(90,98,94,0.15)";
    c.beginPath();
    c.moveTo(x - 14, y);
    c.lineTo(x + 14, y);
    c.moveTo(x, y - 14);
    c.lineTo(x, y + 14);
    c.stroke();
  }

  // Puddles.
  for (let i = 0; i < 15; i++) {
    const x = rng() * WORLD;
    const y = rng() * WORLD;
    const rx = 24 + rng() * 86;
    const ry = 12 + rng() * 38;
    const rot = rng() * TAU;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, "rgba(35,54,58,0.38)");
    g.addColorStop(0.72, "rgba(20,32,35,0.24)");
    g.addColorStop(1, "rgba(12,18,20,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, rx, ry, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(140,170,170,0.09)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.ellipse(-rx * 0.16, -ry * 0.2, rx * 0.55, ry * 0.5, 0, 0.2, 2.6);
    c.stroke();
    c.restore();
  }

  // Old blood and grime.
  for (let i = 0; i < 14; i++) {
    splat(c, rng() * WORLD, rng() * WORLD, 12 + rng() * 34, rng, `rgba(${60 + rng() * 22},${8 + rng() * 8},${6 + rng() * 6},${0.18 + rng() * 0.18})`);
  }
  for (let i = 0; i < 500; i++) {
    const x = rng() * WORLD;
    const y = rng() * WORLD;
    const s = 1 + rng() * 3.4;
    const palette = ["rgba(72,64,43,0.5)", "rgba(92,88,68,0.38)", "rgba(48,54,46,0.5)", "rgba(120,106,74,0.28)"];
    c.fillStyle = palette[Math.floor(rng() * palette.length)];
    c.save();
    c.translate(x, y);
    c.rotate(rng() * TAU);
    c.fillRect(-s / 2, -s / 4, s, s / 2);
    c.restore();
  }

  // Scorch marks.
  for (const [x, y, r] of [
    [300, 1820, 90],
    [2210, 520, 70],
    [760, 240, 54],
  ]) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.4)");
    g.addColorStop(0.6, "rgba(0,0,0,0.14)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }

  // Perimeter buildings.
  c.fillStyle = "#0a0e0f";
  c.fillRect(0, 0, WORLD, 120);
  c.fillRect(0, WORLD - 120, WORLD, 120);
  c.fillRect(0, 0, 120, WORLD);
  c.fillRect(WORLD - 120, 0, 120, WORLD);
  c.strokeStyle = "rgba(126,136,130,0.14)";
  c.lineWidth = 4;
  c.strokeRect(118, 118, WORLD - 236, WORLD - 236);

  // Rooftop details on the border buildings.
  for (let i = 0; i < 34; i++) {
    const side = Math.floor(rng() * 4);
    let x;
    let y;
    if (side === 0) {
      x = 14 + rng() * (WORLD - 28);
      y = 16 + rng() * 88;
    } else if (side === 1) {
      x = 14 + rng() * (WORLD - 28);
      y = WORLD - 104 + rng() * 88;
    } else if (side === 2) {
      x = 16 + rng() * 88;
      y = 14 + rng() * (WORLD - 28);
    } else {
      x = WORLD - 104 + rng() * 88;
      y = 14 + rng() * (WORLD - 28);
    }
    const w = 18 + rng() * 50;
    const h = 12 + rng() * 34;
    c.fillStyle = "rgba(36,42,42,0.65)";
    c.fillRect(x, y, w, h);
    c.strokeStyle = "rgba(120,130,124,0.1)";
    c.lineWidth = 1.5;
    c.strokeRect(x, y, w, h);
    c.fillStyle = "rgba(0,0,0,0.28)";
    c.fillRect(x + 4, y + 4, w - 8, h - 8);
  }

  // Faint emergency graffiti near one wall.
  c.save();
  c.translate(176, 206);
  c.rotate(-0.03);
  c.font = "700 36px Arial Black, Arial, sans-serif";
  c.fillStyle = "rgba(140,40,28,0.22)";
  c.fillText("NO EXIT", 0, 0);
  c.restore();

  // Traffic arrows at the intersection.
  c.save();
  c.fillStyle = "rgba(205,210,195,0.11)";
  c.translate(1300, 1200);
  c.beginPath();
  c.moveTo(0, -26);
  c.lineTo(18, 2);
  c.lineTo(7, 2);
  c.lineTo(7, 26);
  c.lineTo(-7, 26);
  c.lineTo(-7, 2);
  c.lineTo(-18, 2);
  c.closePath();
  c.fill();
  c.restore();
}

/* Small decorative helper used by the renderer for ground-level shadows. */
export function drawPropShadow(ctx, o) {
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  if (o.type === "barrel" || o.type === "firebarrel") {
    ctx.beginPath();
    ctx.ellipse(o.x + 6, o.y + 9, o.r * 1.12, o.r * 0.9, 0, 0, TAU);
    ctx.fill();
  } else {
    const a = o.angle || 0;
    ctx.save();
    ctx.translate(o.x + 7, o.y + 10);
    ctx.rotate(a);
    rr(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 8);
    ctx.fill();
    ctx.restore();
  }
}

export { circle };
