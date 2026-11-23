// Mara Voss's nine jobs: the story of Solmar Heat. Each mission is a small state
// machine of steps — go somewhere, do something, get paid — with a glowing
// beacon in the world, a blip on the minimap, and an objective line on the HUD.
import * as THREE from 'three';
import { saveGame } from './save.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: '1 — First Wheels',
    brief: 'Mara Voss needs a getaway car. Steal any car and bring it to the marina.',
    reward: 500,
    steps: [
      { type: 'stealCar', text: 'Steal a car — walk up to one and press E.' },
      { type: 'reach', at: 'marina', radius: 10, text: 'Drive the stolen car to the marina marker.' },
    ],
  },
  {
    id: 'package-run',
    title: '2 — Package Run',
    brief: 'A package is waiting at the market. Pick it up on foot, then deliver it to the docks — fast.',
    reward: 800,
    steps: [
      { type: 'reach', at: 'market', radius: 6, onFoot: true, text: 'Go to the market on foot and pick up the package.' },
      { type: 'reach', at: 'docks', radius: 10, timer: 90, text: 'Deliver the package to the docks before the timer runs out.' },
    ],
  },
  {
    id: 'lose-the-tail',
    title: '3 — Lose the Tail',
    brief: 'The police are onto Mara\'s crew. Get a wanted level, then lose it completely.',
    reward: 700,
    steps: [
      { type: 'wanted', min: 2, text: 'Get the police after you — steal a car or cause trouble (2 stars).' },
      { type: 'clearWanted', text: 'Now lose them. Break line of sight and stay clean until the stars are gone.' },
    ],
  },
  {
    id: 'repo-job',
    title: '4 — Repo Job',
    brief: 'A red sports car is parked at the beach lot. It belongs to Mara now. Bring it to the garage.',
    reward: 1200,
    steps: [
      { type: 'stealTarget', at: 'beachLot', text: 'Steal the red sports car at the beach lot.' },
      { type: 'reach', at: 'garage', radius: 10, inTargetCar: true, text: 'Drive the red sports car to the garage.' },
    ],
  },
  {
    id: 'street-heat',
    title: '5 — Street Heat',
    brief: 'Mara\'s crew needs breathing room. Disable three patrol cars — shoot them or ram them hard.',
    reward: 1500,
    steps: [
      { type: 'disablePolice', count: 3, text: 'Disable 3 patrol cars (0/3). Shoot them or ram them at speed.' },
    ],
  },
  {
    id: 'marina-score',
    title: '6 — The Marina Score',
    brief: 'The big one: grab the cash from the marina van, then escape to the hideout with the whole department after you.',
    reward: 3000,
    steps: [
      { type: 'reach', at: 'marina', radius: 6, onFoot: true, text: 'Get to the marina van on foot and grab the cash.' },
      { type: 'reach', at: 'hideout', radius: 10, wanted: 3, text: 'Escape to the hideout in the hills. The police will be all over you.' },
    ],
  },
  {
    id: 'marina-to-hills',
    title: '7 — Marina to Hills Run',
    brief: 'A buyer in the hills is paying cash for what is sitting at the marina. Pick it up on foot, then get it across the city against the clock.',
    reward: 2000,
    steps: [
      { type: 'reach', at: 'marina', radius: 6, onFoot: true, text: 'Get to the marina on foot and pick up the buyer\'s package.' },
      { type: 'reach', at: 'hills', radius: 12, timer: 110, text: 'Deliver the package to the buyer in the hills before the timer runs out.' },
    ],
  },
  {
    id: 'roadblock-run',
    title: '8 — Roadblock Run',
    brief: 'Dispatch is setting roadblocks across Solmar Bay tonight. Draw four stars, punch through the heat, and reach the hideout.',
    reward: 2500,
    steps: [
      { type: 'wanted', min: 4, text: 'Draw the whole department out — get a 4-star wanted level.' },
      { type: 'reach', at: 'hideout', radius: 12, wanted: 4, text: 'Run the roadblocks and escape to the hideout in the hills.' },
    ],
  },
  {
    id: 'the-big-score',
    title: '9 — The Big Score',
    brief: 'The finale: an armored van is loading vault cash at the docks. Take the cash, then run it to Mara\'s garage with four stars on you.',
    reward: 5000,
    steps: [
      { type: 'reach', at: 'docks', radius: 8, onFoot: true, text: 'Get to the armored van at the docks on foot and grab the vault cash.' },
      { type: 'reach', at: 'garage', radius: 10, timer: 120, wanted: 4, text: 'Run the vault cash to Mara\'s garage. Every patrol car in Solmar Bay is coming.' },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,            // current mission, or MISSIONS.length when the story is done
    step: 0,
    active: false,
    timer: 0,
    timerMax: 0,
    completed: [],
    targetCar: null,     // the red sports car for the repo job
    beacon: null,        // THREE.Group shown at the current target
    beaconMat: null,
  };
}

export function currentMission(missions) {
  return missions.index < MISSIONS.length ? MISSIONS[missions.index] : null;
}

export function currentStep(missions) {
  const m = currentMission(missions);
  return m ? m.steps[missions.step] : null;
}

export function startMission(missions, world) {
  const m = currentMission(missions);
  if (!m) return;
  missions.active = true;
  missions.step = 0;
  missions.timer = 0;
  missions.timerMax = 0;
  setupStep(missions, world);
  world.hud.banner(m.title, m.brief);
  world.hud.toast(`New job: ${m.title}`);
  world.audio.jingle();
}

function setupStep(missions, world) {
  const step = currentStep(missions);
  const m = currentMission(missions);
  if (!step) return;
  if (step.timer) {
    missions.timer = step.timer;
    missions.timerMax = step.timer;
  }
  if (step.type === 'wanted' && world.police.level < step.min) {
    // Give the player a head start on the trouble: the stars, on the house.
    world.police.level = step.min;
    world.police.heat = 0;
  }
  if (step.type === 'reach' && step.wanted) {
    world.police.level = Math.max(world.police.level, step.wanted);
    world.police.heat = 0;
  }
  placeBeacon(missions, world, stepTargetPos(missions, world, step));
  void m;
}

export function stepTargetPos(missions, world, step) {
  if (!step) return null;
  if (step.type === 'stealCar' || step.type === 'stealTarget') {
    if (step.type === 'stealTarget' && missions.targetCar) return missions.targetCar.pos;
    const lm = world.city.landmarks;
    return new THREE.Vector3(lm.beachLot.x, 0, lm.beachLot.z);
  }
  if (step.at) {
    const lm = world.city.landmarks[step.at];
    return new THREE.Vector3(lm.x, 0, lm.z);
  }
  return null;
}

// The beacon: a glowing pillar and a spinning diamond over the target.
export function placeBeacon(missions, world, pos) {
  removeBeacon(missions, world);
  if (!pos) return;
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 12, 1, true), mat);
  pillar.position.y = 30;
  group.add(pillar);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  diamond.position.y = 6;
  group.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.position.set(pos.x, 0, pos.z);
  world.scene.add(group);
  missions.beacon = group;
  missions.beaconMat = mat;
  missions.beaconDiamond = diamond;
}

export function removeBeacon(missions, world) {
  if (missions.beacon) {
    world.scene.remove(missions.beacon);
    missions.beacon = null;
  }
}

function completeStep(missions, world) {
  const m = currentMission(missions);
  missions.step += 1;
  world.audio.pickup();
  if (missions.step >= m.steps.length) {
    completeMission(missions, world);
    return;
  }
  setupStep(missions, world);
  const step = currentStep(missions);
  world.hud.toast(step.text);
}

function completeMission(missions, world) {
  const m = currentMission(missions);
  world.cash += m.reward;
  missions.completed.push(m.id);
  missions.index += 1;
  missions.active = false;
  removeBeacon(missions, world);
  world.hud.banner('JOB DONE', `+ $${m.reward} — ${m.title}`);
  world.hud.toast(`Job complete! +$${m.reward}`);
  world.audio.jingle();
  world.effects.sparkle(world.player.pos.clone().setY(1.5));
  saveGame(world); // A finished job autosaves, so progress is never lost.
  if (missions.index >= MISSIONS.length) {
    world.hud.banner('SOLMAR HEAT — STORY COMPLETE', 'You pulled off every job Mara had. The city is yours, Jax.');
  }
}

function failMission(missions, world, reason) {
  missions.active = false;
  missions.step = 0;
  removeBeacon(missions, world);
  world.hud.banner('JOB FAILED', reason);
  world.hud.toast(`Job failed: ${reason}`);
  world.audio.fail();
}

// Called every frame while a mission is active. Returns nothing; it moves the
// state machine and talks to the HUD.
export function updateMissions(missions, world, dt) {
  if (missions.beacon) {
    missions.beacon.rotation.y += dt * 0.8;
    if (missions.beaconDiamond) missions.beaconDiamond.position.y = 6 + Math.sin(performance.now() / 350) * 0.5;
  }
  if (!missions.active) return;
  const step = currentStep(missions);
  if (!step) return;
  const player = world.player;
  const playerPos = player.inCar ? player.inCar.pos : player.pos;
  if (step.timer) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      failMission(missions, world, 'Out of time on the delivery.');
      return;
    }
  }
  const targetPos = stepTargetPos(missions, world, step);
  const dist = targetPos ? Math.hypot(targetPos.x - playerPos.x, targetPos.z - playerPos.z) : 0;
  switch (step.type) {
    case 'stealCar':
      if (player.inCar) completeStep(missions, world);
      break;
    case 'stealTarget':
      if (player.inCar === missions.targetCar) completeStep(missions, world);
      break;
    case 'reach':
      if (step.onFoot && player.inCar) break;
      if (step.inTargetCar && player.inCar !== missions.targetCar) break;
      if (dist < step.radius) completeStep(missions, world);
      break;
    case 'wanted':
      if (world.police.level >= step.min) completeStep(missions, world);
      break;
    case 'clearWanted':
      if (world.police.level === 0) completeStep(missions, world);
      break;
    case 'disablePolice': {
      const done = world.missionProgress.policeDisabled || 0;
      if (done >= step.count) completeStep(missions, world);
      break;
    }
    default:
      break;
  }
}
