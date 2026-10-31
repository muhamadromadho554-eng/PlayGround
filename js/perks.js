/* Supply-drop upgrades. Each card can stack up to its own cap. */

import { clamp } from "./util.js";
import { player, upgrades } from "./state.js";

export const PERKS = [
  {
    id: "damage",
    name: "HOLLOW POINTS",
    desc: "+30% bullet damage",
    icon: "damage",
    max: 6,
    apply() {
      upgrades.damage *= 1.3;
    },
  },
  {
    id: "firerate",
    name: "TRIGGER FINGER",
    desc: "+22% fire rate",
    icon: "firerate",
    max: 6,
    apply() {
      upgrades.fireRate *= 1.22;
    },
  },
  {
    id: "speed",
    name: "LIGHT FEET",
    desc: "+12% movement speed",
    icon: "speed",
    max: 5,
    apply() {
      upgrades.speed *= 1.12;
    },
  },
  {
    id: "health",
    name: "THICK SKIN",
    desc: "+25 max HP · heal 40",
    icon: "health",
    max: 5,
    apply() {
      player.maxHp += 25;
      player.hp = clamp(player.hp + 40, 0, player.maxHp);
    },
  },
  {
    id: "pierce",
    name: "PIERCING ROUNDS",
    desc: "Bullets punch through +1 body",
    icon: "pierce",
    max: 3,
    apply() {
      upgrades.pierce += 1;
    },
  },
  {
    id: "multishot",
    name: "SPLIT SHOT",
    desc: "+1 bullet per trigger pull",
    icon: "multishot",
    max: 3,
    apply() {
      upgrades.shots += 1;
      upgrades.spread = 0.07 + upgrades.shots * 0.025;
    },
  },
  {
    id: "reload",
    name: "QUICK HANDS",
    desc: "-22% reload time",
    icon: "reload",
    max: 4,
    apply() {
      upgrades.reloadTime = Math.max(0.34, upgrades.reloadTime * 0.78);
    },
  },
  {
    id: "dash",
    name: "ADRENALINE RUSH",
    desc: "-20% dash cooldown",
    icon: "dash",
    max: 3,
    apply() {
      upgrades.dashCd = Math.max(1.1, upgrades.dashCd * 0.8);
    },
  },
  {
    id: "lifesteal",
    name: "BLOOD TITHE",
    desc: "Heal 2 HP per kill",
    icon: "lifesteal",
    max: 4,
    apply() {
      upgrades.lifesteal += 2;
    },
  },
  {
    id: "magnet",
    name: "SCAVENGER",
    desc: "Bigger pickup magnet · better drops",
    icon: "magnet",
    max: 3,
    apply() {
      upgrades.magnet += 85;
      upgrades.dropBoost += 0.18;
    },
  },
];

export function pickPerks(count = 3) {
  const pool = PERKS.filter((p) => (upgrades.levels[p.id] || 0) < p.max);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function applyPerk(id) {
  const perk = PERKS.find((p) => p.id === id);
  if (!perk) return null;
  const level = upgrades.levels[id] || 0;
  if (level >= perk.max) return null;
  perk.apply();
  upgrades.levels[id] = level + 1;
  return perk;
}
