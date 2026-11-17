// Save and load: cash, missions, position and pickups, in localStorage. The
// pause menu saves on demand; missions also autosave when they complete.
import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const player = world.player;
    const data = {
      version: 1,
      cash: world.cash,
      missionIndex: world.missions.index,
      completed: world.missions.completed,
      health: player.health,
      ammo: world.combat.ammo,
      wanted: world.police.level,
      pos: { x: player.pos.x, z: player.pos.z },
      inCar: !!player.inCar,
      pickups: world.pickups.filter((p) => p.taken).map((p) => p.id),
      playedSeconds: world.playedSeconds,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
