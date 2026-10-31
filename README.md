# LAST LIGHT — Zombie Survival

A top-down twin-stick survival shooter built for phones and tablets. Hold the line against escalating waves of the dead, collect supply drops, and see how long you can keep the light on.

Everything is procedural: the city block, the horde, the audio, and the effects. No build step, no framework, and no runtime network requests.

## Play

Serve the folder over HTTP and open it in a browser:

```bash
python3 -m http.server 3002
# then visit http://localhost:3002
```

## Controls

**Touch (phone / tablet)**

- Left joystick: move
- Right joystick: aim and fire
- `DASH` button: dodge with brief invulnerability
- Auto-fire targets the nearest zombie when you are not using the right stick
- Optional **TILT** toggle steers movement with the accelerometer. On iOS, motion access is requested from a user gesture; if no sensor data arrives the toggle turns itself off.

**Desktop**

- `WASD` / arrow keys: move
- Mouse: aim
- Hold left mouse button: fire
- `Space` / `Shift`: dash
- `R`: reload
- `P` / `Esc`: pause
- `M`: mute
- `1` `2` `3`: choose an upgrade

## Features

- Four zombie types: walkers, runners, brutes, and spitters
- Wave-based spawning with a supply-drop upgrade choice between waves
- Perks for damage, fire rate, multishot, pierce, reload speed, movement, health, lifesteal, magnet, and dash cooldown
- Pickups, combo scoring, damage numbers, gore, decals, and a persistent best score
- Dynamic flashlight pools, fire-barrel light, muzzle flash, screen shake, and grain
- Procedural WebAudio sound effects and ambience
- Responsive HUD and safe-area support for notched phones
- Installable PWA manifest and local fonts

## Project layout

```
index.html            DOM shell, HUD, menus
css/style.css         UI, overlays, responsive layout
js/game.js            boot, input, tilt permission, HUD wiring, main loop
js/sim.js             simulation: player, zombies, waves, pickups, perks
js/render.js          frame composition, lighting, glows, joysticks
js/draw.js            world actors, effects, particles
js/world.js           world constants, obstacles, procedural background
js/state.js           shared mutable state
js/perks.js           perk definitions and application
js/audio.js           procedural WebAudio engine
js/util.js            math, random, canvas, storage helpers
assets/fonts/         bundled Bebas Neue and Rajdhani
```

## Notes

- The game is designed for landscape or portrait; the HUD adapts to both.
- Audio starts on the first user gesture, as required by mobile browsers.
- Best score is stored in `localStorage` under `lastlight.best`.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/muhamadromadho554-eng/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/muhamadromadho554-eng/PlayGround)

- 🎮 [Open the project](https://omgithub.com/muhamadromadho554-eng/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=muhamadromadho554-eng%2FPlayGround).
- 💻 [Explore the source](https://github.com/muhamadromadho554-eng/PlayGround).
- 🛠️ [Check build runs](https://github.com/muhamadromadho554-eng/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/muhamadromadho554-eng/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/muhamadromadho554-eng).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
