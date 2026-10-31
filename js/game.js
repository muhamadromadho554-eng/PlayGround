/* Boot, input, tilt, UI wiring and the main loop. */

import { clamp, pad, formatTime, store, lerp } from "./util.js";
import { buildWorldBackground } from "./world.js";
import {
  game,
  player,
  upgrades,
  view,
  camera,
  input,
  tilt,
  zombies,
} from "./state.js";
import { SoundEngine } from "./audio.js";
import { pickPerks } from "./perks.js";
import { render } from "./render.js";
import {
  initSim,
  startRun,
  startDemo,
  updateSim,
  doDash,
  reload,
  choosePerk,
} from "./sim.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
const lightCanvas = document.createElement("canvas");
const lctx = lightCanvas.getContext("2d");
const sound = new SoundEngine();

const dom = {
  hud: $("hud"),
  hpText: $("hpText"),
  hpFill: $("hpFill"),
  ammoText: $("ammoText"),
  reloadTrack: $("reloadTrack"),
  reloadFill: $("reloadFill"),
  waveNum: $("waveNum"),
  hostiles: $("hostiles"),
  score: $("score"),
  combo: $("combo"),
  pauseBtn: $("pauseBtn"),
  tiltBadge: $("tiltBadge"),
  dashBtn: $("dashBtn"),
  dashRing: $("dashRing"),
  desktopHint: $("desktopHint"),
  waveBanner: $("waveBanner"),
  toast: $("toast"),
  damageFlash: $("damageFlash"),
  lowHealth: $("lowHealth"),
  menu: $("menu"),
  bestScore: $("bestScore"),
  bestWave: $("bestWave"),
  startBtn: $("startBtn"),
  tiltBtn: $("tiltBtn"),
  tiltState: $("tiltState"),
  soundBtn: $("soundBtn"),
  soundState: $("soundState"),
  motionNote: $("motionNote"),
  upgrade: $("upgrade"),
  upgradeKicker: $("upgradeKicker"),
  perkCards: $("perkCards"),
  pause: $("pause"),
  pauseWave: $("pauseWave"),
  pauseScore: $("pauseScore"),
  pauseKills: $("pauseKills"),
  resumeBtn: $("resumeBtn"),
  pauseTiltBtn: $("pauseTiltBtn"),
  pauseSoundBtn: $("pauseSoundBtn"),
  restartBtn: $("restartBtn"),
  quitBtn: $("quitBtn"),
  gameover: $("gameover"),
  finalWave: $("finalWave"),
  finalKills: $("finalKills"),
  finalTime: $("finalTime"),
  finalScore: $("finalScore"),
  newBest: $("newBest"),
  retryBtn: $("retryBtn"),
  toMenuBtn: $("toMenuBtn"),
};

const DASH_CIRCUMFERENCE = 2 * Math.PI * 33;
let currentPerks = [];
let toastTimer = 0;
let bannerTimer = 0;
let comboBumpTimer = 0;

/* ---------------------------------------------------------------- canvas */

function resize() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.zoom = clamp(Math.min(view.w, view.h) / 560, 0.95, 1.6);
  view.isTouchLayout = window.matchMedia("(pointer: coarse)").matches || view.w < 900;

  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  canvas.style.width = `${view.w}px`;
  canvas.style.height = `${view.h}px`;
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;

  dom.desktopHint.classList.toggle("is-hidden", view.isTouchLayout);
  layoutSticks();
}

function layoutSticks() {
  const radius = clamp(Math.min(view.w, view.h) * 0.14, 48, 68);
  const knob = radius * 0.4;
  const bottom = 28 + radius;
  for (const key of ["move", "aim"]) {
    const s = input.sticks[key];
    s.radius = radius;
    s.knob = knob;
    s.defX = key === "move" ? 24 + radius : view.w - 24 - radius;
    s.defY = view.h - bottom;
    if (s.active) {
      s.baseX = clamp(s.baseX, radius + 8, view.w - radius - 8);
      s.baseY = clamp(s.baseY, radius + 8, view.h - radius - 8);
    }
  }
}

/* ----------------------------------------------------------------- input */

function releaseInputs() {
  for (const key of ["move", "aim"]) {
    const s = input.sticks[key];
    s.active = false;
    s.id = null;
    s.mag = 0;
    s.dx = 0;
    s.dy = 0;
  }
  input.keys.clear();
  input.mouse.down = false;
}

function beginStick(stick, e) {
  stick.active = true;
  stick.id = e.pointerId;
  stick.baseX = clamp(e.clientX, stick.radius + 8, view.w - stick.radius - 8);
  stick.baseY = clamp(e.clientY, stick.radius + 8, view.h - stick.radius - 8);
  stick.dx = 0;
  stick.dy = 0;
  stick.mag = 0;
  stick.angle = 0;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* pointer capture can fail on old browsers */
  }
}

function moveStick(stick, e) {
  const dx = e.clientX - stick.baseX;
  const dy = e.clientY - stick.baseY;
  const d = Math.hypot(dx, dy);
  const max = stick.radius * 0.8;
  stick.mag = Math.min(1, d / max);
  if (d > 3) {
    stick.dx = dx / d;
    stick.dy = dy / d;
    stick.angle = Math.atan2(dy, dx);
  }
}

canvas.addEventListener("pointerdown", (e) => {
  if (game.state !== "playing") return;
  e.preventDefault();
  if (e.pointerType === "mouse") {
    input.mouse.active = true;
    input.mouse.down = true;
    input.mouse.x = e.clientX;
    input.mouse.y = e.clientY;
    return;
  }
  input.touchSeen = true;
  const move = input.sticks.move;
  const aim = input.sticks.aim;
  if (e.clientX < view.w * 0.5 && !move.active) beginStick(move, e);
  else if (e.clientX >= view.w * 0.5 && !aim.active) beginStick(aim, e);
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") {
    input.mouse.active = true;
    input.mouse.x = e.clientX;
    input.mouse.y = e.clientY;
    return;
  }
  const move = input.sticks.move;
  const aim = input.sticks.aim;
  if (move.active && move.id === e.pointerId) moveStick(move, e);
  else if (aim.active && aim.id === e.pointerId) moveStick(aim, e);
});

function endPointer(e) {
  if (e.pointerType === "mouse") {
    input.mouse.down = false;
    return;
  }
  for (const key of ["move", "aim"]) {
    const s = input.sticks[key];
    if (s.active && s.id === e.pointerId) {
      s.active = false;
      s.id = null;
      s.mag = 0;
      s.dx = 0;
      s.dy = 0;
    }
  }
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
window.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse") input.mouse.down = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  const code = e.code;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) e.preventDefault();
  input.keys.add(code);
  if (e.repeat) return;

  if (code === "Space" && game.state === "playing") {
    doDash();
    pulseDash();
  } else if (code === "ShiftLeft" || code === "ShiftRight") {
    if (game.state === "playing") {
      doDash();
      pulseDash();
    }
  } else if (code === "KeyR") {
    reload();
  } else if (code === "KeyP" || code === "Escape") {
    if (game.state === "playing") pauseGame();
    else if (game.state === "paused") resumeGame();
  } else if (code === "KeyM") {
    toggleSound();
  } else if (code === "Enter") {
    if (game.state === "menu" || game.state === "gameover") startGame();
    else if (game.state === "paused") resumeGame();
  } else if (game.state === "upgrade" && (code === "Digit1" || code === "Digit2" || code === "Digit3")) {
    const index = Number(code.slice(-1)) - 1;
    const perk = currentPerks[index];
    if (perk) selectPerk(perk.id);
  }
});

window.addEventListener("keyup", (e) => input.keys.delete(e.code));
window.addEventListener("blur", releaseInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === "playing") pauseGame();
});

/* ------------------------------------------------------------------ tilt */

function deadzone(v) {
  const d = 3;
  const range = 22;
  const s = Math.sign(v);
  return s * clamp((Math.abs(v) - d) / (range - d), 0, 1);
}

function onOrientation(e) {
  if (e.beta === null && e.gamma === null) return;
  tilt.rawBeta = e.beta || 0;
  tilt.rawGamma = e.gamma || 0;
  tilt.gotData = true;
  if (tilt.baseBeta === null || tilt.baseGamma === null) {
    tilt.baseBeta = tilt.rawBeta;
    tilt.baseGamma = tilt.rawGamma;
  }
  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const db = tilt.rawBeta - tilt.baseBeta;
  const dg = tilt.rawGamma - tilt.baseGamma;
  let rx = dg;
  let ry = db;
  if (angle === 90) {
    rx = db;
    ry = -dg;
  } else if (angle === -90 || angle === 270) {
    rx = -db;
    ry = dg;
  }
  tilt.x = lerp(tilt.x, deadzone(rx), 0.3);
  tilt.y = lerp(tilt.y, deadzone(ry), 0.3);
}

async function enableTilt() {
  if (!tilt.supported) {
    showToast("MOTION SENSORS UNAVAILABLE");
    return false;
  }
  if (tilt.needsPermission && tilt.permission !== "granted") {
    try {
      const result = await window.DeviceOrientationEvent.requestPermission();
      if (result !== "granted") {
        tilt.permission = "denied";
        showToast("MOTION ACCESS DENIED");
        return false;
      }
      tilt.permission = "granted";
    } catch (err) {
      showToast("MOTION ACCESS BLOCKED");
      return false;
    }
  }
  if (!tilt.listening) {
    window.addEventListener("deviceorientation", onOrientation);
    tilt.listening = true;
  }
  tilt.enabled = true;
  tilt.gotData = false;
  tilt.baseBeta = null;
  tilt.baseGamma = null;
  tilt.x = 0;
  tilt.y = 0;
  updateTiltUI();
  showToast("TILT STEERING ON · HOLD NATURALLY");
  setTimeout(() => {
    if (tilt.enabled && !tilt.gotData) {
      showToast("NO MOTION DATA · TILT DISABLED");
      disableTilt();
    }
  }, 3200);
  return true;
}

function disableTilt() {
  tilt.enabled = false;
  tilt.x = 0;
  tilt.y = 0;
  if (tilt.listening) {
    window.removeEventListener("deviceorientation", onOrientation);
    tilt.listening = false;
  }
  updateTiltUI();
}

async function toggleTilt() {
  if (tilt.enabled) disableTilt();
  else await enableTilt();
}

function calibrateTilt() {
  if (!tilt.enabled) {
    toggleTilt();
    return;
  }
  tilt.baseBeta = tilt.rawBeta;
  tilt.baseGamma = tilt.rawGamma;
  tilt.x = 0;
  tilt.y = 0;
  showToast("TILT RECALIBRATED");
}

function updateTiltUI() {
  dom.tiltBtn.setAttribute("aria-pressed", String(tilt.enabled));
  dom.tiltState.textContent = tilt.enabled ? "ON" : "OFF";
  dom.tiltBadge.classList.toggle("is-hidden", !tilt.enabled || game.state !== "playing");
  dom.pauseTiltBtn.textContent = tilt.enabled ? "RECALIBRATE TILT" : "ENABLE TILT";
  if (tilt.enabled && game.state === "playing") {
    tilt.baseBeta = tilt.rawBeta;
    tilt.baseGamma = tilt.rawGamma;
  }
}

/* ------------------------------------------------------------------ sound */

function updateSoundUI() {
  dom.soundBtn.setAttribute("aria-pressed", String(sound.on));
  dom.soundState.textContent = sound.on ? "ON" : "OFF";
  dom.pauseSoundBtn.textContent = `SOUND: ${sound.on ? "ON" : "OFF"}`;
}

function toggleSound() {
  sound.init();
  sound.toggle();
  store("lastlight.muted", sound.on ? "0" : "1");
  updateSoundUI();
  if (sound.on && game.state === "playing") sound.startAmbient();
  if (!sound.on) showToast("AUDIO MUTED");
}

/* -------------------------------------------------------------------- UI */

function updateHUD() {
  const ratio = clamp(player.hp / player.maxHp, 0, 1);
  const hp = Math.ceil(player.hp);
  if (hp !== updateHUD.lastHp) {
    dom.hpText.textContent = String(hp);
    updateHUD.lastHp = hp;
  }
  dom.hpFill.style.transform = `scaleX(${ratio})`;
  dom.hpFill.classList.toggle("warn", ratio <= 0.55 && ratio > 0.28);
  dom.hpFill.classList.toggle("crit", ratio <= 0.28);

  if (player.mag !== updateHUD.lastMag) {
    dom.ammoText.textContent = String(player.mag);
    dom.ammoText.classList.toggle("empty", player.mag === 0);
    updateHUD.lastMag = player.mag;
  }
  const reloading = player.reloading;
  dom.reloadTrack.classList.toggle("active", reloading);
  if (reloading) {
    dom.reloadFill.style.width = `${clamp(player.reloadT / upgrades.reloadTime, 0, 1) * 100}%`;
  } else {
    dom.reloadFill.style.width = "0%";
  }

  if (game.wave !== updateHUD.lastWave) {
    dom.waveNum.textContent = pad(game.wave);
    updateHUD.lastWave = game.wave;
  }
  const hostiles = zombies.length + game.spawnBudget;
  if (hostiles !== updateHUD.lastHostiles) {
    dom.hostiles.textContent = `${hostiles} HOSTILE${hostiles === 1 ? "" : "S"}`;
    updateHUD.lastHostiles = hostiles;
  }
  if (game.score !== updateHUD.lastScore) {
    dom.score.textContent = pad(game.score, 6);
    updateHUD.lastScore = game.score;
  }
  if (game.combo !== updateHUD.lastCombo) {
    dom.combo.textContent = game.combo > 1 ? `x${game.combo}` : " ";
    if (game.combo > 1) {
      dom.combo.classList.add("bump");
      clearTimeout(comboBumpTimer);
      comboBumpTimer = setTimeout(() => dom.combo.classList.remove("bump"), 110);
    }
    updateHUD.lastCombo = game.combo;
  }

  const cd = player.dashCd;
  dom.dashRing.style.strokeDashoffset = String(DASH_CIRCUMFERENCE * clamp(cd / upgrades.dashCd, 0, 1));
  dom.dashBtn.classList.toggle("cooling", cd > 0.02);

  dom.tiltBadge.classList.toggle("is-hidden", !tilt.enabled || game.state !== "playing");
  dom.lowHealth.classList.toggle("active", ratio < 0.3 && game.state === "playing");
  dom.damageFlash.style.opacity = String(clamp(game.hitPulse * 0.9, 0, 1));
}

updateHUD.lastHp = -1;
updateHUD.lastMag = -1;
updateHUD.lastWave = -1;
updateHUD.lastHostiles = -1;
updateHUD.lastScore = -1;
updateHUD.lastCombo = -1;

function showToast(message, duration = 1800) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove("show"), duration);
}

function showWaveBanner(wave) {
  dom.waveBanner.innerHTML = `<span>WAVE</span><b>${pad(wave)}</b><i>${wave === 1 ? "THEY'RE COMING" : "INCOMING"}</i>`;
  dom.waveBanner.classList.remove("show");
  void dom.waveBanner.offsetWidth;
  dom.waveBanner.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => dom.waveBanner.classList.remove("show"), 3200);
}

const PERK_ICONS = {
  damage: '<path d="M12 2v12"/><path d="M8 14h8l-1.5 7h-5L8 14Z"/>',
  firerate: '<path d="M13 2 5 14h5l-1 8 8-12h-5l1-8Z"/>',
  speed: '<path d="M4 17h8"/><path d="M6 12h7"/><path d="M8 7h6"/><path d="M17 6l3 6-3 6"/>',
  health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  pierce: '<path d="M3 12h15"/><path d="m15 8 4 4-4 4"/><circle cx="7" cy="12" r="2"/>',
  multishot: '<path d="M4 12h6"/><path d="m10 12 8-6"/><path d="m10 12 8 6"/><path d="M10 12h10"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  dash: '<path d="M4 6h10"/><path d="M3 11h9"/><path d="M4 16h10"/><path d="m15 9 4 3-4 3"/>',
  lifesteal: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z"/><path d="M12 8v6"/><path d="M9 11h6"/>',
  magnet: '<path d="M6 3v9a6 6 0 0 0 12 0V3"/><path d="M6 8h4"/><path d="M14 8h4"/><path d="M6 3h4v5H6z"/><path d="M14 3h4v5h-4z"/>',
};

function showUpgrade(wave) {
  currentPerks = pickPerks(3);
  dom.upgradeKicker.textContent = `WAVE ${pad(wave)} CLEARED · +12 HP`;
  dom.perkCards.innerHTML = currentPerks
    .map(
      (perk, index) => `
      <button class="perk-card" type="button" data-perk="${perk.id}">
        <span class="perk-key">${index + 1}</span>
        <span class="perk-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${PERK_ICONS[perk.icon] || ""}</svg></span>
        <span class="perk-copy"><b>${perk.name}</b><small>${perk.desc}</small></span>
        <span class="perk-level">LV ${(upgrades.levels[perk.id] || 0) + 1}</span>
      </button>`
    )
    .join("");
  dom.upgrade.classList.remove("is-hidden");
}

function selectPerk(id) {
  if (game.state !== "upgrade") return;
  const perk = choosePerk(id);
  if (!perk) return;
  dom.upgrade.classList.add("is-hidden");
  game.state = "playing";
  releaseInputs();
  updateTiltUI();
  updateHUD();
}

function showGameOver(stats) {
  releaseInputs();
  dom.hud.classList.add("is-hidden");
  dom.gameover.classList.remove("is-hidden");
  dom.finalWave.textContent = pad(stats.wave);
  dom.finalKills.textContent = String(stats.kills);
  dom.finalTime.textContent = formatTime(stats.time);
  dom.finalScore.textContent = pad(stats.score, 6);
  dom.newBest.classList.toggle("is-hidden", !stats.newBest);
  updateMenuBest();
  updateTiltUI();
}

function pauseGame() {
  if (game.state !== "playing") return;
  game.state = "paused";
  releaseInputs();
  dom.pauseWave.textContent = pad(game.wave);
  dom.pauseScore.textContent = pad(game.score, 6);
  dom.pauseKills.textContent = String(game.kills);
  dom.pause.classList.remove("is-hidden");
  updateTiltUI();
}

function resumeGame() {
  if (game.state !== "paused") return;
  dom.pause.classList.add("is-hidden");
  game.state = "playing";
  updateTiltUI();
  if (tilt.enabled) calibrateTiltQuiet();
}

function calibrateTiltQuiet() {
  tilt.baseBeta = tilt.rawBeta;
  tilt.baseGamma = tilt.rawGamma;
  tilt.x = 0;
  tilt.y = 0;
}

function startGame() {
  sound.init();
  if (!sound.muted) sound.startAmbient();
  dom.menu.classList.add("is-hidden");
  dom.gameover.classList.add("is-hidden");
  dom.pause.classList.add("is-hidden");
  dom.upgrade.classList.add("is-hidden");
  dom.hud.classList.remove("is-hidden");
  void dom.hud.offsetWidth;
  dom.toast.classList.remove("show");
  dom.waveBanner.classList.remove("show");
  game.hitPulse = 0;
  releaseInputs();
  startRun();
  game.state = "playing";
  updateTiltUI();
  if (tilt.enabled) calibrateTiltQuiet();
  updateHUD();
}

function showMenu() {
  dom.menu.classList.remove("is-hidden");
  dom.gameover.classList.add("is-hidden");
  dom.pause.classList.add("is-hidden");
  dom.upgrade.classList.add("is-hidden");
  dom.hud.classList.add("is-hidden");
  dom.toast.classList.remove("show");
  sound.stopAmbient();
  releaseInputs();
  startDemo();
  updateMenuBest();
  updateTiltUI();
}

function updateMenuBest() {
  dom.bestScore.textContent = pad(game.best.score, 6);
  dom.bestWave.textContent = String(game.best.wave);
}

function pulseDash() {
  dom.dashBtn.classList.add("pressed");
  setTimeout(() => dom.dashBtn.classList.remove("pressed"), 120);
}

/* ----------------------------------------------------------------- wiring */

dom.startBtn.addEventListener("click", startGame);
dom.retryBtn.addEventListener("click", startGame);
dom.toMenuBtn.addEventListener("click", showMenu);
dom.resumeBtn.addEventListener("click", resumeGame);
dom.restartBtn.addEventListener("click", startGame);
dom.quitBtn.addEventListener("click", showMenu);
dom.pauseBtn.addEventListener("click", pauseGame);
dom.pauseSoundBtn.addEventListener("click", toggleSound);
dom.pauseTiltBtn.addEventListener("click", () => (tilt.enabled ? calibrateTilt() : toggleTilt()));
dom.soundBtn.addEventListener("click", toggleSound);
dom.tiltBtn.addEventListener("click", toggleTilt);

dom.dashBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (game.state === "playing") {
    doDash();
    pulseDash();
  }
});
dom.dashBtn.addEventListener("keydown", (e) => {
  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    if (game.state === "playing") {
      doDash();
      pulseDash();
    }
  }
});

dom.perkCards.addEventListener("click", (e) => {
  const card = e.target.closest(".perk-card");
  if (card) selectPerk(card.dataset.perk);
});

/* ------------------------------------------------------------------ boot */

function loadBest() {
  try {
    const raw = store("lastlight.best");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.score)) {
      game.best = { score: Math.max(0, parsed.score), wave: Math.max(0, parsed.wave || 0) };
    }
  } catch (e) {
    /* corrupt storage is ignored */
  }
}

function boot() {
  buildWorldBackground();
  loadBest();
  sound.setMuted(store("lastlight.muted") === "1");
  if (tilt.needsPermission) dom.motionNote.classList.remove("is-hidden");

  initSim({
    sound,
    toast: showToast,
    updateHUD,
    onWaveClear: showUpgrade,
    onDeath: showGameOver,
    showWaveBanner,
    onRunStart: () => {
      dom.hud.classList.remove("is-hidden");
    },
  });

  resize();
  startDemo();
  updateMenuBest();
  updateSoundUI();
  updateTiltUI();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 250));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.034, Math.max(0.0001, (now - last) / 1000));
    last = now;
    updateSim(dt);
    if (game.state === "playing" || game.state === "upgrade") updateHUD();
    render(ctx, lctx, lightCanvas);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
